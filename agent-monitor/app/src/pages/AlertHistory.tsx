import { useState } from 'react'
import { useAlertsStore } from '@/store/alerts'
import {
  getAlertLevelLabel,
  getAlertLevelColor,
} from '@/api/alerts'
import type { AlertHistory, NotificationLog, NotificationChannelType } from '@/shared/types'

export function AlertHistory() {
  const { history, clearHistory, logs, clearLogs } = useAlertsStore()
  const [activeTab, setActiveTab] = useState<'alerts' | 'notifications'>('alerts')

  return (
    <div className="page-container" style={{ padding: 'var(--space-lg)' }}>
      <div className="page-header">
        <h1 className="page-title">告警历史</h1>
        <button
          onClick={() => activeTab === 'alerts' ? clearHistory() : clearLogs()}
          className="btn btn-danger"
        >
          清空{activeTab === 'alerts' ? '历史' : '日志'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`btn ${activeTab === 'alerts' ? 'btn-primary' : 'btn-secondary'}`}
        >
          告警记录
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`btn ${activeTab === 'notifications' ? 'btn-primary' : 'btn-secondary'}`}
        >
          通知日志
        </button>
      </div>

      {activeTab === 'alerts' && (
        <AlertHistoryList history={history} />
      )}

      {activeTab === 'notifications' && (
        <NotificationLogsList logs={logs} />
      )}
    </div>
  )
}

function AlertHistoryList({ history }: { history: AlertHistory[] }) {
  if (history.length === 0) {
    return <p style={{ color: 'var(--color-ink-subtle)' }}>暂无告警历史记录。</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      {history.map((entry) => (
        <AlertHistoryItem key={entry.id} entry={entry} />
      ))}
    </div>
  )
}

function AlertHistoryItem({ entry }: { entry: AlertHistory }) {
  const eventColors: Record<string, string> = {
    firing: 'var(--color-danger)',
    acknowledged: 'var(--color-warning)',
    resolved: 'var(--color-success)',
  }

  const eventLabels: Record<string, string> = {
    firing: '触发告警',
    acknowledged: '已确认',
    resolved: '已恢复',
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontWeight: 'bold', color: 'var(--color-ink)' }}>{entry.serverName}</span>
            <span
              className="badge"
              style={{
                background: eventColors[entry.event] + '30',
                color: eventColors[entry.event],
              }}
            >
              {eventLabels[entry.event]}
            </span>
            <span
              className="badge"
              style={{
                background: getAlertLevelColor(entry.level) + '30',
                color: getAlertLevelColor(entry.level),
              }}
            >
              [{getAlertLevelLabel(entry.level)}]
            </span>
          </div>
          <div style={{ color: 'var(--color-ink-subtle)', fontSize: 13 }}>
            {entry.message}
          </div>
        </div>
        <div style={{ color: 'var(--color-ink-subtle)', fontSize: 13, textAlign: 'right' }}>
          {new Date(entry.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  )
}

function NotificationLogsList({ logs }: { logs: NotificationLog[] }) {
  if (logs.length === 0) {
    return <p style={{ color: 'var(--color-ink-subtle)' }}>暂无通知日志记录。</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      {logs.map((log) => (
        <NotificationLogItem key={log.id} log={log} />
      ))}
    </div>
  )
}

function NotificationLogItem({ log }: { log: NotificationLog }) {
  const typeLabels: Record<NotificationChannelType, string> = {
    webhook: 'Webhook',
    email: '邮件',
    wechat: '企业微信',
    dingtalk: '钉钉',
    serverchan: 'Server酱 (SCT)',
    serverchan3: 'Server酱³ (SC3)',
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontWeight: 'bold', color: 'var(--color-ink)' }}>{log.channelName}</span>
            <span style={{ color: 'var(--color-ink-subtle)', fontSize: 14 }}>({typeLabels[log.channelType]})</span>
            <span
              className={`badge ${log.status === 'success' ? 'badge-success' : 'badge-danger'}`}
            >
              {log.status === 'success' ? '发送成功' : '发送失败'}
            </span>
          </div>
          {log.error && (
            <div style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 4 }}>
              错误: {log.error}
            </div>
          )}
        </div>
        <div style={{ color: 'var(--color-ink-subtle)', fontSize: 13, textAlign: 'right' }}>
          {new Date(log.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  )
}
