package alerts

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"time"
)

// DefaultCheckInterval 默认检查间隔（秒）
const DefaultCheckInterval = 30

// NewEngine 创建告警引擎
func NewEngine(stateDir string, metricsCollector MetricsCollector) *Engine {
	// 从环境变量读取检查间隔
	checkInterval := DefaultCheckInterval
	if intervalStr := os.Getenv("ALERT_CHECK_INTERVAL_SEC"); intervalStr != "" {
		if i, err := strconv.Atoi(intervalStr); err == nil && i > 0 {
			checkInterval = i
		}
	}

	// 从环境变量读取状态目录
	if stateDir == "" {
		stateDir = os.Getenv("ALERT_STATE_DIR")
		if stateDir == "" {
			stateDir = DefaultStateDir
		}
	}

	return &Engine{
		stateDir:         stateDir,
		checkInterval:    time.Duration(checkInterval) * time.Second,
		metricsCollector: metricsCollector,
		ruleStates:       make(map[string]*ruleState),
		stopCh:           make(chan struct{}),
	}
}

// Start 启动告警引擎
func (e *Engine) Start() error {
	// 加载状态
	state, err := LoadState(e.stateDir)
	if err != nil {
		return fmt.Errorf("load state: %w", err)
	}
	e.state = state

	// 初始化规则状态
	for _, rule := range e.state.Rules {
		e.ruleStates[rule.ID] = &ruleState{}
	}

	go e.run()
	log.Printf("[告警引擎] 已启动，检查间隔: %v", e.checkInterval)
	return nil
}

// Stop 停止告警引擎
func (e *Engine) Stop() {
	close(e.stopCh)
	log.Println("[告警引擎] 已停止")
}

// GetRules 获取当前规则
func (e *Engine) GetRules() []AlertRule {
	return e.state.Rules
}

// GetChannels 获取当前渠道
func (e *Engine) GetChannels() []NotificationChannel {
	return e.state.Channels
}

// GetActiveAlerts 获取活跃告警
func (e *Engine) GetActiveAlerts() []ActiveAlert {
	return e.state.ActiveAlerts
}

// Sync 同步规则和渠道
func (e *Engine) Sync(rules []AlertRule, channels []NotificationChannel) error {
	e.state.Rules = rules
	e.state.Channels = channels

	// 更新规则状态
	newRuleStates := make(map[string]*ruleState)
	for _, rule := range rules {
		if rs, ok := e.ruleStates[rule.ID]; ok {
			newRuleStates[rule.ID] = rs
		} else {
			newRuleStates[rule.ID] = &ruleState{}
		}
	}
	e.ruleStates = newRuleStates

	// 保存状态
	if err := SaveState(e.stateDir, e.state); err != nil {
		return fmt.Errorf("save state: %w", err)
	}

	log.Printf("[告警引擎] 已同步 %d 条规则, %d 个渠道", len(rules), len(channels))
	return nil
}

// AcknowledgeAlert 确认告警
func (e *Engine) AcknowledgeAlert(id string) error {
	now := time.Now().UnixMilli()
	found := false

	for i, alert := range e.state.ActiveAlerts {
		if alert.ID == id {
			found = true
			e.state.ActiveAlerts[i].Status = AlertStatusAcknowledged
			e.state.ActiveAlerts[i].AcknowledgedAt = &now
			break
		}
	}

	if !found {
		return fmt.Errorf("alert not found: %s", id)
	}

	// 保存状态
	if err := SaveState(e.stateDir, e.state); err != nil {
		return fmt.Errorf("save state: %w", err)
	}

	log.Printf("[告警引擎] 告警已确认: %s", id)
	return nil
}

func (e *Engine) run() {
	ticker := time.NewTicker(e.checkInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			e.checkOnce()
		case <-e.stopCh:
			return
		}
	}
}

func (e *Engine) checkOnce() {
	// 采集指标
	metrics, err := e.metricsCollector.Collect()
	if err != nil {
		log.Printf("[告警引擎] 采集指标失败: %v", err)
		return
	}

	// 检查每条规则
	for _, rule := range e.state.Rules {
		if !rule.Enabled {
			continue
		}

		// 跳过 Netdata 指标规则
		if rule.NetdataMetric != nil {
			log.Printf("[告警引擎] 跳过 Netdata 指标规则: %s (MVP 暂不支持)", rule.Name)
			continue
		}

		// 检查预设指标
		e.checkRule(rule, metrics)
	}
}

func (e *Engine) checkRule(rule AlertRule, metrics *MetricsSnapshot) {
	// 获取指标值
	value, ok := getMetricValue(metrics, rule.Metric)
	if !ok {
		return
	}

	// 检查阈值
	isTriggered := checkThreshold(value, rule.Condition, rule.Threshold)

	// 查找现有的未解决告警
	var existingAlert *ActiveAlert
	for i, alert := range e.state.ActiveAlerts {
		if alert.RuleID == rule.ID && alert.Status != AlertStatusResolved {
			existingAlert = &e.state.ActiveAlerts[i]
			break
		}
	}

	rs := e.ruleStates[rule.ID]

	if isTriggered {
		if existingAlert != nil {
			e.handleExistingAlert(existingAlert, value, rule, rs)
		} else {
			e.handleNewAlert(value, rule, rs)
		}
	} else {
		if existingAlert != nil && existingAlert.Status == AlertStatusFiring {
			e.handleRecovery(existingAlert, rule)
		} else if existingAlert != nil && existingAlert.Status == AlertStatusPending {
			// 清除 pending 状态的告警
			e.removeActiveAlert(existingAlert.ID)
			rs.consecutiveHits = 0
		} else {
			rs.consecutiveHits = 0
		}
	}
}

func (e *Engine) handleNewAlert(value float64, rule AlertRule, rs *ruleState) {
	metricLabel := getMetricLabel(rule.Metric)
	units := getMetricUnit(rule.Metric)

	rs.consecutiveHits = 1

	alert := ActiveAlert{
		ID:              genID(),
		RuleID:          rule.ID,
		ServerID:        rule.ServerID,
		ServerName:      "本地服务器",
		Metric:          rule.Metric,
		MetricLabel:     metricLabel,
		Value:           value,
		Threshold:       rule.Threshold,
		Condition:       rule.Condition,
		Level:           rule.Level,
		Status:          AlertStatusPending,
		StartedAt:       time.Now().UnixMilli(),
		ConsecutiveHits: 1,
		Units:           units,
	}

	e.state.ActiveAlerts = append(e.state.ActiveAlerts, alert)
	rs.lastAlertID = alert.ID

	log.Printf("[告警引擎] 检测到潜在告警: %s %s = %.2f", alert.ServerName, metricLabel, value)

	// 检查是否达到连续触发次数
	if rule.ConsecutiveCount <= 1 {
		e.triggerAlert(&alert, rule)
	}

	_ = SaveState(e.stateDir, e.state)
}

func (e *Engine) handleExistingAlert(alert *ActiveAlert, value float64, rule AlertRule, rs *ruleState) {
	rs.consecutiveHits = alert.ConsecutiveHits + 1
	alert.ConsecutiveHits = rs.consecutiveHits
	alert.Value = value

	// 如果达到连续触发次数且状态还是 pending，则触发告警
	if alert.Status == AlertStatusPending && rs.consecutiveHits >= rule.ConsecutiveCount {
		e.triggerAlert(alert, rule)
	}

	_ = SaveState(e.stateDir, e.state)
}

func (e *Engine) triggerAlert(alert *ActiveAlert, rule AlertRule) {
	alert.Status = AlertStatusFiring

	message := formatAlertMessage(alert.ServerName, rule, alert.Value, alert.Condition, alert.Threshold, alert.Level, alert.Units)
	log.Printf("[告警引擎] 触发告警: %s", message)

	// 发送通知
	e.sendNotifications(alert, message)

	_ = SaveState(e.stateDir, e.state)
}

func (e *Engine) handleRecovery(alert *ActiveAlert, rule AlertRule) {
	now := time.Now().UnixMilli()
	alert.Status = AlertStatusResolved
	alert.ResolvedAt = &now

	metricLabel := alert.MetricLabel
	if metricLabel == "" {
		metricLabel = getMetricLabel(rule.Metric)
	}
	message := fmt.Sprintf("%s - %s 已恢复正常", alert.ServerName, metricLabel)
	log.Printf("[告警引擎] %s", message)

	// 发送恢复通知
	e.sendNotifications(alert, message)

	// 延迟删除
	go func(id string) {
		time.Sleep(60 * time.Second)
		e.removeActiveAlert(id)
	}(alert.ID)

	_ = SaveState(e.stateDir, e.state)
}

func (e *Engine) removeActiveAlert(id string) {
	var newAlerts []ActiveAlert
	for _, alert := range e.state.ActiveAlerts {
		if alert.ID != id {
			newAlerts = append(newAlerts, alert)
		}
	}
	e.state.ActiveAlerts = newAlerts
	_ = SaveState(e.stateDir, e.state)
}

func (e *Engine) sendNotifications(alert *ActiveAlert, message string) {
	for _, channel := range e.state.Channels {
		if !channel.Enabled {
			continue
		}

		if channel.Type == NotificationChannelTypeWebhook {
			e.sendWebhook(channel, alert, message)
		} else {
			log.Printf("[告警引擎] 通知渠道 %s (%s) 暂未实现", channel.Name, channel.Type)
		}
	}
}

func (e *Engine) sendWebhook(channel NotificationChannel, alert *ActiveAlert, message string) {
	url, ok := channel.Config["url"]
	if !ok || url == "" {
		log.Printf("[告警引擎] Webhook 渠道 %s 缺少 url 配置", channel.Name)
		return
	}

	payload := map[string]interface{}{
		"alertId":   alert.ID,
		"ruleId":    alert.RuleID,
		"serverId":  alert.ServerID,
		"serverName": alert.ServerName,
		"metric":    alert.Metric,
		"value":     alert.Value,
		"threshold": alert.Threshold,
		"condition": alert.Condition,
		"level":     alert.Level,
		"status":    alert.Status,
		"message":   message,
		"timestamp": time.Now().UnixMilli(),
	}

	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[告警引擎] Webhook 序列化失败: %v", err)
		return
	}

	resp, err := http.Post(url, "application/json", bytes.NewReader(data))
	if err != nil {
		log.Printf("[告警引擎] Webhook 发送失败: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		log.Printf("[告警引擎] Webhook 通知成功: %s", channel.Name)
	} else {
		log.Printf("[告警引擎] Webhook 通知失败 (状态码: %d)", resp.StatusCode)
	}
}

// 辅助函数

func getMetricValue(metrics *MetricsSnapshot, metric AlertMetric) (float64, bool) {
	switch metric {
	case AlertMetricCPU:
		return metrics.CPUPercent, true
	case AlertMetricMemory:
		return metrics.MemoryPercent, true
	case AlertMetricDisk:
		return metrics.DiskPercent, true
	case AlertMetricGPU:
		if metrics.GPU != nil {
			return metrics.GPU.UtilizationPercent, true
		}
		return 0, false
	case AlertMetricCPUTemp:
		if metrics.CPUTemperatureC != nil {
			return *metrics.CPUTemperatureC, true
		}
		return 0, false
	case AlertMetricGPUTemp:
		if metrics.GPU != nil {
			return metrics.GPU.TemperatureC, true
		}
		return 0, false
	default:
		return 0, false
	}
}

func getMetricLabel(metric AlertMetric) string {
	switch metric {
	case AlertMetricCPU:
		return "CPU 使用率"
	case AlertMetricMemory:
		return "内存使用率"
	case AlertMetricDisk:
		return "磁盘使用率"
	case AlertMetricGPU:
		return "GPU 使用率"
	case AlertMetricCPUTemp:
		return "CPU 温度"
	case AlertMetricGPUTemp:
		return "GPU 温度"
	default:
		return string(metric)
	}
}

func getMetricUnit(metric AlertMetric) string {
	switch metric {
	case AlertMetricCPU, AlertMetricMemory, AlertMetricDisk, AlertMetricGPU:
		return "%"
	case AlertMetricCPUTemp, AlertMetricGPUTemp:
		return "°C"
	default:
		return ""
	}
}

func checkThreshold(value float64, condition AlertCondition, threshold float64) bool {
	if condition == AlertConditionAbove {
		return value > threshold
	}
	return value < threshold
}

func formatAlertMessage(serverName string, rule AlertRule, value float64, condition AlertCondition, threshold float64, level AlertLevel, units string) string {
	metricLabel := getMetricLabel(rule.Metric)
	conditionLabel := "高于"
	if condition == AlertConditionBelow {
		conditionLabel = "低于"
	}
	levelLabel := "警告"
	if level == AlertLevelCritical {
		levelLabel = "严重"
	}
	return fmt.Sprintf("[%s] %s - %s %.2f%s %s 阈值 %.2f%s",
		levelLabel, serverName, metricLabel, value, units, conditionLabel, threshold, units)
}

func genID() string {
	return fmt.Sprintf("%x%x", rand.Uint32(), time.Now().UnixNano())
}
