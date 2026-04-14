package alerts

import "time"

// AlertMetric 告警指标类型 - 预设快速选项
type AlertMetric string

const (
	AlertMetricCPU     AlertMetric = "cpu"
	AlertMetricMemory  AlertMetric = "memory"
	AlertMetricDisk    AlertMetric = "disk"
	AlertMetricGPU     AlertMetric = "gpu"
	AlertMetricCPUTemp AlertMetric = "cpu_temp"
	AlertMetricGPUTemp AlertMetric = "gpu_temp"
)

// AlertCondition 告警比较条件
type AlertCondition string

const (
	AlertConditionAbove AlertCondition = "above"
	AlertConditionBelow AlertCondition = "below"
)

// AlertLevel 告警级别
type AlertLevel string

const (
	AlertLevelWarning  AlertLevel = "warning"
	AlertLevelCritical AlertLevel = "critical"
)

// AlertStatus 告警状态
type AlertStatus string

const (
	AlertStatusPending      AlertStatus = "pending"
	AlertStatusFiring       AlertStatus = "firing"
	AlertStatusAcknowledged AlertStatus = "acknowledged"
	AlertStatusResolved     AlertStatus = "resolved"
)

// NotificationChannelType 通知渠道类型
type NotificationChannelType string

const (
	NotificationChannelTypeWebhook    NotificationChannelType = "webhook"
	NotificationChannelTypeEmail      NotificationChannelType = "email"
	NotificationChannelTypeWechat     NotificationChannelType = "wechat"
	NotificationChannelTypeDingtalk   NotificationChannelType = "dingtalk"
	NotificationChannelTypeServerchan NotificationChannelType = "serverchan"
	NotificationChannelTypeServerchan3 NotificationChannelType = "serverchan3"
)

// NetdataChartInfo Netdata Chart 信息
type NetdataChartInfo struct {
	ID         string                 `json:"id"`
	Name       string                 `json:"name"`
	Title      string                 `json:"title"`
	Units      string                 `json:"units"`
	Family     string                 `json:"family"`
	Dimensions []NetdataDimensionInfo `json:"dimensions"`
}

// NetdataDimensionInfo Netdata Dimension 信息
type NetdataDimensionInfo struct {
	Name  string `json:"name"`
	Label string `json:"label,omitempty"`
}

// NetdataMetricConfig 自定义Netdata指标配置
type NetdataMetricConfig struct {
	ChartID       string `json:"chartId"`
	DimensionName string `json:"dimensionName"`
	ChartTitle    string `json:"chartTitle,omitempty"`
	DimensionLabel string `json:"dimensionLabel,omitempty"`
	Units         string `json:"units,omitempty"`
}

// AlertRule 告警规则
type AlertRule struct {
	ID               string               `json:"id"`
	Name             string               `json:"name"`
	ServerID         string               `json:"serverId,omitempty"`
	Metric           AlertMetric          `json:"metric,omitempty"`
	NetdataMetric    *NetdataMetricConfig `json:"netdataMetric,omitempty"`
	Condition        AlertCondition       `json:"condition"`
	Threshold        float64              `json:"threshold"`
	Level            AlertLevel           `json:"level"`
	Enabled          bool                 `json:"enabled"`
	ConsecutiveCount int                  `json:"consecutiveCount"`
}

// NotificationChannel 通知渠道
type NotificationChannel struct {
	ID      string                 `json:"id"`
	Name    string                 `json:"name"`
	Type    NotificationChannelType `json:"type"`
	Config  map[string]string      `json:"config"`
	Enabled bool                   `json:"enabled"`
}

// ActiveAlert 活跃告警
type ActiveAlert struct {
	ID               string      `json:"id"`
	RuleID           string      `json:"ruleId"`
	ServerID         string      `json:"serverId"`
	ServerName       string      `json:"serverName"`
	Metric           interface{} `json:"metric"` // AlertMetric or {netdataMetric: {...}}
	MetricLabel      string      `json:"metricLabel,omitempty"`
	Value            float64     `json:"value"`
	Threshold        float64     `json:"threshold"`
	Condition        AlertCondition `json:"condition"`
	Level            AlertLevel  `json:"level"`
	Status           AlertStatus `json:"status"`
	StartedAt        int64       `json:"startedAt"`
	AcknowledgedAt   *int64      `json:"acknowledgedAt,omitempty"`
	ResolvedAt       *int64      `json:"resolvedAt,omitempty"`
	ConsecutiveHits  int         `json:"consecutiveHits"`
	Units            string      `json:"units,omitempty"`
}

// SyncRequest 同步规则和渠道的请求
type SyncRequest struct {
	Rules    []AlertRule          `json:"rules"`
	Channels []NotificationChannel `json:"channels"`
}

// RulesResponse 获取规则的响应
type RulesResponse struct {
	Rules    []AlertRule          `json:"rules"`
	Channels []NotificationChannel `json:"channels"`
}

// AlertState 持久化的告警状态
type AlertState struct {
	Rules       []AlertRule          `json:"rules"`
	Channels    []NotificationChannel `json:"channels"`
	ActiveAlerts []ActiveAlert        `json:"activeAlerts"`
}

// ruleState 内部规则执行状态
type ruleState struct {
	consecutiveHits int
	lastAlertID     string
}

// Engine 告警引擎
type Engine struct {
	stateDir         string
	checkInterval    time.Duration
	metricsCollector MetricsCollector
	state            AlertState
	ruleStates       map[string]*ruleState
	stopCh           chan struct{}
}

// MetricsCollector 指标采集器接口
type MetricsCollector interface {
	Collect() (*MetricsSnapshot, error)
}

// MetricsSnapshot 指标快照
type MetricsSnapshot struct {
	CPUPercent      float64
	CPUTemperatureC *float64
	MemoryUsed      uint64
	MemoryTotal     uint64
	MemoryPercent   float64
	DiskUsed        uint64
	DiskTotal       uint64
	DiskPercent     float64
	GPU             *GPUSnapshot
}

// GPUSnapshot GPU快照
type GPUSnapshot struct {
	UtilizationPercent float64
	MemoryUsedBytes    uint64
	MemoryTotalBytes   uint64
	TemperatureC       float64
}
