import type {
  MetricsResponse,
  AlertRule,
  ActiveAlert,
  NotificationChannel,
  AlertMetric,
  AlertCondition,
  AlertLevel,
} from '@/shared/types'
import { encryptSctDesp, postServerChan, renderNotificationTemplate } from '@/utils/serverchan'

/** 从指标中提取指定指标的值 (预设指标) */
export function getMetricValue(metrics: MetricsResponse, metric: AlertMetric): number | null {
  switch (metric) {
    case 'cpu':
      return metrics.cpu_percent
    case 'memory':
      return metrics.memory_percent
    case 'disk':
      return metrics.disk_percent
    case 'gpu':
      return metrics.gpu?.utilization_percent ?? null
    case 'cpu_temp':
      return metrics.cpu_temperature_c ?? null
    case 'gpu_temp':
      return metrics.gpu?.temperature_c ?? null
    default:
      return null
  }
}

/** 获取指标的显示名称 (支持预设和自定义Netdata指标) */
export function getMetricLabel(
  metricOrRule: AlertMetric | AlertRule | { netdataMetric?: { chartId: string; dimensionName: string; chartTitle?: string; dimensionLabel?: string } } | { metric?: AlertMetric }
): string {
  if (typeof metricOrRule === 'object' && 'netdataMetric' in metricOrRule && metricOrRule.netdataMetric) {
    const nm = metricOrRule.netdataMetric
    if (nm.chartTitle && nm.dimensionLabel) {
      return `${nm.chartTitle} - ${nm.dimensionLabel}`
    }
    if (nm.dimensionLabel) {
      return nm.dimensionLabel
    }
    return `${nm.chartId} - ${nm.dimensionName}`
  }

  const metric = typeof metricOrRule === 'string' ? metricOrRule : metricOrRule.metric
  const labels: Record<AlertMetric, string> = {
    cpu: 'CPU 使用率',
    memory: '内存使用率',
    disk: '磁盘使用率',
    gpu: 'GPU 使用率',
    cpu_temp: 'CPU 温度',
    gpu_temp: 'GPU 温度',
  }
  return metric ? (labels[metric] || metric) : '自定义指标'
}

/** 获取指标的单位 */
export function getMetricUnit(rule: AlertRule): string {
  if (rule.netdataMetric?.units) {
    return rule.netdataMetric.units
  }
  if (rule.metric?.includes('temp')) {
    return '°C'
  }
  return '%'
}

/** 检查指标是否触发告警条件 */
export function checkThreshold(
  value: number,
  condition: AlertCondition,
  threshold: number
): boolean {
  switch (condition) {
    case 'above':
      return value > threshold
    case 'below':
      return value < threshold
    default:
      return false
  }
}

/** 获取告警级别的显示名称 */
export function getAlertLevelLabel(level: AlertLevel): string {
  return level === 'warning' ? '警告' : '严重'
}

/** 获取告警级别的颜色 */
export function getAlertLevelColor(level: AlertLevel): string {
  return level === 'warning' ? '#ff9800' : '#f44336'
}

/** 格式化告警消息 (支持自定义Netdata指标) */
export function formatAlertMessage(
  serverName: string,
  ruleOrMetric: AlertRule | AlertMetric,
  value: number,
  condition: AlertCondition,
  threshold: number,
  level: AlertLevel,
  units?: string
): string {
  const rule = typeof ruleOrMetric === 'object' ? ruleOrMetric : { metric: ruleOrMetric }
  const metricLabel = getMetricLabel(rule)
  const conditionLabel = condition === 'above' ? '高于' : '低于'
  const unit = units || (typeof ruleOrMetric === 'object' ? getMetricUnit(ruleOrMetric) : (ruleOrMetric.includes('temp') ? '°C' : '%'))
  const levelLabel = getAlertLevelLabel(level)

  return `[${levelLabel}] ${serverName} - ${metricLabel} ${value.toFixed(1)}${unit} ${conditionLabel} ${threshold}${unit}`
}

/** 发送 Webhook 通知 */
export async function sendWebhookNotification(
  channel: NotificationChannel,
  alert: ActiveAlert,
  message: string
): Promise<boolean> {
  try {
    const url = channel.config.url
    if (!url) throw new Error('Webhook URL 未配置')

    const payload = {
      title: `服务器告警 - ${getAlertLevelLabel(alert.level)}`,
      message,
      alert: {
        id: alert.id,
        serverName: alert.serverName,
        metric: alert.metricLabel || (typeof alert.metric === 'string' ? getMetricLabel(alert.metric as AlertMetric) : getMetricLabel(alert.metric)),
        value: alert.value,
        threshold: alert.threshold,
        condition: alert.condition,
        level: alert.level,
        status: alert.status,
        startedAt: new Date(alert.startedAt).toISOString(),
      },
      timestamp: new Date().toISOString(),
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(channel.config.headers ? JSON.parse(channel.config.headers) : {}),
      },
      body: JSON.stringify(payload),
    })

    return response.ok
  } catch (error) {
    console.error('Webhook 通知发送失败:', error)
    throw error
  }
}

/** 发送邮件通知 (通过 Webhook 或邮件服务) */
export async function sendEmailNotification(
  channel: NotificationChannel,
  alert: ActiveAlert,
  message: string
): Promise<boolean> {
  try {
    const smtpUrl = channel.config.smtpUrl
    const to = channel.config.to

    if (smtpUrl && to) {
      const payload = {
        to,
        subject: `服务器告警 - ${getAlertLevelLabel(alert.level)}: ${alert.serverName}`,
        body: message,
        html: `
          <h2>服务器告警</h2>
          <p><strong>服务器:</strong> ${alert.serverName}</p>
          <p><strong>级别:</strong> ${getAlertLevelLabel(alert.level)}</p>
          <p><strong>指标:</strong> ${alert.metricLabel || (typeof alert.metric === 'string' ? getMetricLabel(alert.metric as AlertMetric) : getMetricLabel(alert.metric))}</p>
          <p><strong>当前值:</strong> ${alert.value.toFixed(1)}${alert.units || (typeof alert.metric === 'string' && alert.metric.includes('temp') ? '°C' : '%')}</p>
          <p><strong>阈值:</strong> ${alert.condition === 'above' ? '>' : '<'} ${alert.threshold}${alert.units || (typeof alert.metric === 'string' && alert.metric.includes('temp') ? '°C' : '%')}</p>
          <p><strong>时间:</strong> ${new Date(alert.startedAt).toLocaleString()}</p>
        `,
      }

      const response = await fetch(smtpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return response.ok
    }

    if (channel.config.webhookUrl) {
      const webhookChannel: NotificationChannel = {
        ...channel,
        config: { url: channel.config.webhookUrl },
      }
      return await sendWebhookNotification(webhookChannel, alert, message)
    }

    throw new Error('邮件配置不完整')
  } catch (error) {
    console.error('邮件通知发送失败:', error)
    throw error
  }
}

/** 发送企业微信通知 */
export async function sendWechatNotification(
  channel: NotificationChannel,
  alert: ActiveAlert,
  message: string
): Promise<boolean> {
  try {
    const webhookUrl = channel.config.webhookUrl
    if (!webhookUrl) throw new Error('企业微信 Webhook URL 未配置')

    const payload = {
      msgtype: 'markdown',
      markdown: {
        content: `## <font color="${alert.level === 'critical' ? 'warning' : 'info'}">服务器告警</font>\n` +
          `> **服务器:** ${alert.serverName}\n` +
          `> **级别:** <font color="${alert.level === 'critical' ? 'red' : 'orange'}">${getAlertLevelLabel(alert.level)}</font>\n` +
          `> **指标:** ${alert.metricLabel || (typeof alert.metric === 'string' ? getMetricLabel(alert.metric as AlertMetric) : getMetricLabel(alert.metric))}\n` +
          `> **当前值:** ${alert.value.toFixed(1)}${alert.units || (typeof alert.metric === 'string' && alert.metric.includes('temp') ? '°C' : '%')}\n` +
          `> **阈值:** ${alert.condition === 'above' ? '>' : '<'} ${alert.threshold}${alert.units || (typeof alert.metric === 'string' && alert.metric.includes('temp') ? '°C' : '%')}\n` +
          `> **时间:** ${new Date(alert.startedAt).toLocaleString()}`,
      },
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    return response.ok
  } catch (error) {
    console.error('企业微信通知发送失败:', error)
    throw error
  }
}

function buildServerChanVars(alert: ActiveAlert, message: string): Record<string, string> {
  const metricLabel =
    alert.metricLabel ||
    (typeof alert.metric === 'string'
      ? getMetricLabel(alert.metric as AlertMetric)
      : getMetricLabel(alert.metric as AlertMetric | AlertRule))
  const units =
    alert.units ||
    (typeof alert.metric === 'string' && alert.metric.includes('temp') ? '°C' : '%')
  return {
    serverName: alert.serverName,
    level: alert.level,
    levelLabel: getAlertLevelLabel(alert.level),
    metric: metricLabel,
    value: alert.value.toFixed(1),
    threshold: String(alert.threshold),
    condition: alert.condition === 'above' ? '高于' : '低于',
    units,
    message,
    time: new Date(alert.startedAt).toLocaleString('zh-CN'),
    alertId: alert.id,
  }
}

function defaultServerChanTitle(vars: Record<string, string>): string {
  return `[${vars.levelLabel}] ${vars.serverName}`.slice(0, 32)
}

function defaultServerChanDesp(vars: Record<string, string>): string {
  return [
    '## 服务器告警',
    '',
    `**服务器** ${vars.serverName}`,
    `**级别** ${vars.levelLabel}`,
    `**指标** ${vars.metric}`,
    `**当前值** ${vars.value}${vars.units}`,
    `**阈值** ${vars.condition} ${vars.threshold}${vars.units}`,
    `**时间** ${vars.time}`,
    '',
    `**摘要** ${vars.message}`,
  ].join('\n')
}

/** Server酱（SCT，sctapi.ftqq.com），支持 Markdown、端对端加密 */
export async function sendServerchanNotification(
  channel: NotificationChannel,
  alert: ActiveAlert,
  message: string
): Promise<boolean> {
  const sendKey = channel.config.sendKey?.trim()
  if (!sendKey) throw new Error('SendKey 未配置')
  if (sendKey.startsWith('sctp')) {
    throw new Error('该 Key 以 sctp 开头，属于 Server酱³，请改用「Server酱³」渠道')
  }

  const vars = buildServerChanVars(alert, message)
  const titleTpl = channel.config.titleTemplate?.trim()
  const despTpl = channel.config.despTemplate?.trim()
  let title = titleTpl ? renderNotificationTemplate(titleTpl, vars) : defaultServerChanTitle(vars)
  title = title.slice(0, 32)
  let desp = despTpl ? renderNotificationTemplate(despTpl, vars) : defaultServerChanDesp(vars)

  const body: Record<string, unknown> = { title, desp }

  if (channel.config.encryptEnabled === 'true') {
    const pwd = channel.config.encryptPassword?.trim()
    const ivSeed = channel.config.encryptIvSeed?.trim()
    if (!pwd || !ivSeed) {
      throw new Error('开启端对端加密时请填写「阅读密码」和「IV 种子」（文档：SCT 与 UID 拼接，如 SCT54264）')
    }
    body.desp = await encryptSctDesp(desp, pwd, ivSeed)
    body.encoded = 1
  }

  if (channel.config.noip === '1') body.noip = 1
  if (channel.config.channel?.trim()) body.channel = channel.config.channel.trim()
  if (channel.config.openid?.trim()) body.openid = channel.config.openid.trim()
  if (channel.config.short?.trim()) body.short = channel.config.short.trim().slice(0, 64)

  await postServerChan('sct', sendKey, body)
  return true
}

/** Server酱³（sc3，push.ft07.com），Markdown；SendKey 须 sctp 开头 */
export async function sendServerchan3Notification(
  channel: NotificationChannel,
  alert: ActiveAlert,
  message: string
): Promise<boolean> {
  const sendKey = channel.config.sendKey?.trim()
  if (!sendKey) throw new Error('SendKey 未配置')
  if (!sendKey.startsWith('sctp')) {
    throw new Error('Server酱³ 的 SendKey 须以 sctp 开头，请在 SendKey 页面复制完整 Key')
  }

  const vars = buildServerChanVars(alert, message)
  const titleTpl = channel.config.titleTemplate?.trim()
  const despTpl = channel.config.despTemplate?.trim()
  let title = titleTpl ? renderNotificationTemplate(titleTpl, vars) : defaultServerChanTitle(vars)
  title = title.slice(0, 32)
  const desp = despTpl ? renderNotificationTemplate(despTpl, vars) : defaultServerChanDesp(vars)

  const body: Record<string, unknown> = { title, desp }
  if (channel.config.tags?.trim()) body.tags = channel.config.tags.trim()
  if (channel.config.short?.trim()) body.short = channel.config.short.trim().slice(0, 64)

  await postServerChan('sc3', sendKey, body)
  return true
}

/** 发送钉钉通知 */
export async function sendDingtalkNotification(
  channel: NotificationChannel,
  alert: ActiveAlert,
  message: string
): Promise<boolean> {
  try {
    const webhookUrl = channel.config.webhookUrl
    if (!webhookUrl) throw new Error('钉钉 Webhook URL 未配置')

    const payload = {
      msgtype: 'markdown',
      markdown: {
        title: `服务器告警 - ${alert.serverName}`,
        text: `## 服务器告警\n\n` +
          `**服务器:** ${alert.serverName}\n\n` +
          `**级别:** ${getAlertLevelLabel(alert.level)}\n\n` +
          `**指标:** ${alert.metricLabel || (typeof alert.metric === 'string' ? getMetricLabel(alert.metric as AlertMetric) : getMetricLabel(alert.metric))}\n\n` +
          `**当前值:** ${alert.value.toFixed(1)}${alert.units || (typeof alert.metric === 'string' && alert.metric.includes('temp') ? '°C' : '%')}\n\n` +
          `**阈值:** ${alert.condition === 'above' ? '>' : '<'} ${alert.threshold}${alert.units || (typeof alert.metric === 'string' && alert.metric.includes('temp') ? '°C' : '%')}\n\n` +
          `**时间:** ${new Date(alert.startedAt).toLocaleString()}`,
      },
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    return response.ok
  } catch (error) {
    console.error('钉钉通知发送失败:', error)
    throw error
  }
}

/** 发送通知 */
export async function sendNotification(
  channel: NotificationChannel,
  alert: ActiveAlert,
  message: string
): Promise<boolean> {
  switch (channel.type) {
    case 'webhook':
      return await sendWebhookNotification(channel, alert, message)
    case 'email':
      return await sendEmailNotification(channel, alert, message)
    case 'wechat':
      return await sendWechatNotification(channel, alert, message)
    case 'dingtalk':
      return await sendDingtalkNotification(channel, alert, message)
    case 'serverchan':
      return await sendServerchanNotification(channel, alert, message)
    case 'serverchan3':
      return await sendServerchan3Notification(channel, alert, message)
    default:
      throw new Error(`不支持的通知渠道类型: ${channel.type}`)
  }
}
