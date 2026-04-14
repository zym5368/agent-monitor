import type { AlertMetric, AlertCondition, AlertLevel, NotificationChannelType } from '@/shared/types'

export function metricSelectOptions(): { value: AlertMetric; label: string }[] {
  return [
    { value: 'cpu', label: 'CPU 使用率' },
    { value: 'memory', label: '内存使用率' },
    { value: 'disk', label: '磁盘使用率' },
    { value: 'gpu', label: 'GPU 使用率' },
    { value: 'cpu_temp', label: 'CPU 温度' },
    { value: 'gpu_temp', label: 'GPU 温度' },
  ]
}

export function conditionOptions(): { value: AlertCondition; label: string }[] {
  return [
    { value: 'above', label: '高于' },
    { value: 'below', label: '低于' },
  ]
}

export function levelOptions(): { value: AlertLevel; label: string }[] {
  return [
    { value: 'warning', label: '警告' },
    { value: 'critical', label: '严重' },
  ]
}

export function channelTypeOptions(): { value: NotificationChannelType; label: string }[] {
  return [
    { value: 'webhook', label: 'Webhook' },
    { value: 'email', label: '邮件' },
    { value: 'wechat', label: '企业微信' },
    { value: 'dingtalk', label: '钉钉' },
    { value: 'serverchan', label: 'Server酱 (SCT)' },
    { value: 'serverchan3', label: 'Server酱³ (SC3)' },
  ]
}

export const channelTypeLabels: Record<NotificationChannelType, string> = {
  webhook: 'Webhook',
  email: '邮件',
  wechat: '企业微信',
  dingtalk: '钉钉',
  serverchan: 'Server酱 (SCT)',
  serverchan3: 'Server酱³ (SC3)',
}

export const serverChanTemplateHint =
  '占位符：{serverName} {level} {levelLabel} {metric} {value} {threshold} {condition} {units} {message} {time} {alertId}。留空则用默认 Markdown。标题最长 32 字。'
