import type { Server, MetricsResponse, AlertRule, ActiveAlert } from '@/shared/types'
import { useAlertsStore } from '@/store/alerts'
import {
  getMetricValue,
  getMetricLabel,
  getMetricUnit,
  checkThreshold,
  formatAlertMessage,
  sendNotification,
} from '@/api/alerts'
import { fetchNetdataChartData, getNetdataDimensionValue } from '@/api/client'

/** 告警检测引擎 */
export class AlertEngine {
  private isRunning = false
  private checkInterval: ReturnType<typeof setInterval> | null = null
  private readonly checkIntervalMs = 30000 // 30秒检查一次
  private serversCache: Server[] = []

  /** 启动告警检测 */
  start() {
    if (this.isRunning) return
    this.isRunning = true
    this.checkInterval = setInterval(() => this.runChecks(), this.checkIntervalMs)
    console.log('[告警引擎] 已启动')
  }

  /** 停止告警检测 */
  stop() {
    this.isRunning = false
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    console.log('[告警引擎] 已停止')
  }

  /** 更新服务器列表（用于自定义Netdata指标检查） */
  updateServers(servers: Server[]) {
    this.serversCache = servers
  }

  /** 检查单个服务器的指标 */
  checkServer(server: Server, metrics: MetricsResponse) {
    const store = useAlertsStore.getState()
    const rules = store.getRulesByServer(server.id)

    for (const rule of rules) {
      this.checkRule(server, metrics, rule)
    }
  }

  /** 检查单个规则 */
  private async checkRule(server: Server, metrics: MetricsResponse | null, rule: AlertRule) {
    const store = useAlertsStore.getState()
    let value: number | null = null

    // 判断是预设指标还是自定义Netdata指标
    if (rule.netdataMetric) {
      // 自定义Netdata指标 - 直接从Netdata获取
      if (!server.netdataUrl) return
      value = await this.fetchNetdataMetricValue(server.netdataUrl, rule.netdataMetric.chartId, rule.netdataMetric.dimensionName)
    } else if (rule.metric && metrics) {
      // 预设指标 - 从已获取的metrics中提取
      value = getMetricValue(metrics, rule.metric)
    }

    if (value == null) return

    const isTriggered = checkThreshold(value, rule.condition, rule.threshold)
    const existingAlert = store.activeAlerts.find(
      (a) => a.ruleId === rule.id && a.serverId === server.id && a.status !== 'resolved'
    )

    if (isTriggered) {
      if (existingAlert) {
        this.handleExistingAlert(existingAlert, value, rule)
      } else {
        this.handleNewAlert(server, value, rule)
      }
    } else {
      if (existingAlert && existingAlert.status === 'firing') {
        this.handleRecovery(existingAlert, rule)
      } else if (existingAlert && existingAlert.status === 'pending') {
        // 条件未满足时清除 pending 状态的告警
        store.removeActiveAlert(existingAlert.id)
      }
    }
  }

  /** 从Netdata获取自定义指标值 */
  private async fetchNetdataMetricValue(
    netdataUrl: string,
    chartId: string,
    dimensionName: string
  ): Promise<number | null> {
    try {
      const chartData = await fetchNetdataChartData(netdataUrl, chartId, 1)
      if (!chartData) return null
      return getNetdataDimensionValue(chartData, dimensionName)
    } catch {
      return null
    }
  }

  /** 处理新告警 */
  private handleNewAlert(server: Server, value: number, rule: AlertRule) {
    const store = useAlertsStore.getState()
    const metricLabel = getMetricLabel(rule)
    const units = getMetricUnit(rule)

    const newAlert = store.addActiveAlert({
      ruleId: rule.id,
      serverId: server.id,
      serverName: server.name,
      metric: rule.netdataMetric
        ? { netdataMetric: { chartId: rule.netdataMetric.chartId, dimensionName: rule.netdataMetric.dimensionName } }
        : (rule.metric as any),
      metricLabel,
      value,
      threshold: rule.threshold,
      condition: rule.condition,
      level: rule.level,
      units,
    })

    console.log(`[告警引擎] 检测到潜在告警: ${server.name} ${metricLabel} = ${value}`)

    // 检查是否达到连续触发次数
    if (rule.consecutiveCount <= 1) {
      this.triggerAlert(newAlert, rule)
    }
  }

  /** 处理现有告警 */
  private handleExistingAlert(existingAlert: ActiveAlert, value: number, rule: AlertRule) {
    const store = useAlertsStore.getState()

    const newConsecutiveHits = existingAlert.consecutiveHits + 1

    store.updateActiveAlert(existingAlert.id, {
      value,
      consecutiveHits: newConsecutiveHits,
    })

    // 如果达到连续触发次数且状态还是 pending，则触发告警
    if (existingAlert.status === 'pending' && newConsecutiveHits >= rule.consecutiveCount) {
      const updatedAlert = store.activeAlerts.find((a) => a.id === existingAlert.id)
      if (updatedAlert) {
        this.triggerAlert(updatedAlert, rule)
      }
    }
  }

  /** 触发告警 */
  private triggerAlert(alert: ActiveAlert, rule: AlertRule) {
    const store = useAlertsStore.getState()

    store.updateActiveAlert(alert.id, {
      status: 'firing',
    })

    const message = formatAlertMessage(
      alert.serverName,
      rule,
      alert.value,
      alert.condition,
      alert.threshold,
      alert.level,
      alert.units
    )

    store.addHistory({
      alertId: alert.id,
      ruleId: rule.id,
      serverId: alert.serverId,
      serverName: alert.serverName,
      metric: rule.metric || 'custom',
      value: alert.value,
      threshold: alert.threshold,
      condition: alert.condition,
      level: alert.level,
      event: 'firing',
      message,
    })

    console.log(`[告警引擎] 触发告警: ${message}`)

    // 发送通知
    this.sendNotifications(alert, message)
  }

  /** 处理恢复 */
  private handleRecovery(alert: ActiveAlert, rule: AlertRule) {
    const store = useAlertsStore.getState()
    store.resolveAlert(alert.id)

    const metricLabel = alert.metricLabel || getMetricLabel(rule)
    const message = `${alert.serverName} - ${metricLabel} 已恢复正常`
    console.log(`[告警引擎] ${message}`)

    // 发送恢复通知
    this.sendNotifications(alert, message)
  }

  /** 发送通知到所有启用的渠道 */
  private async sendNotifications(alert: ActiveAlert, message: string) {
    const store = useAlertsStore.getState()
    const enabledChannels = store.channels.filter((c) => c.enabled)

    for (const channel of enabledChannels) {
      try {
        const success = await sendNotification(channel, alert, message)
        store.addLog({
          alertId: alert.id,
          channelId: channel.id,
          channelName: channel.name,
          channelType: channel.type,
          status: success ? 'success' : 'failed',
        })
      } catch (error) {
        store.addLog({
          alertId: alert.id,
          channelId: channel.id,
          channelName: channel.name,
          channelType: channel.type,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  /** 运行所有检查（定时任务 - 用于自定义Netdata指标） */
  private async runChecks() {
    const store = useAlertsStore.getState()

    for (const server of this.serversCache) {
      const rules = store.getRulesByServer(server.id)
      const customNetdataRules = rules.filter((r) => !!r.netdataMetric)

      for (const rule of customNetdataRules) {
        await this.checkRule(server, null, rule)
      }
    }
  }
}

// 单例实例
export const alertEngine = new AlertEngine()
