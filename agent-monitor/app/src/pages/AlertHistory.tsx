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
    <div className="alert-history-page">
      <div className="alert-history-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ marginTop: 0, marginBottom: 0 }}>告警历史</h1>
        <button
          onClick={() => activeTab === 'alerts' ? clearHistory() : clearLogs()}
          style={{
            padding: '8px 16px',
            background: '#16213e',
            border: '1px solid #555',
            borderRadius: 6,
            color: '#f44336',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          清空{activeTab === 'alerts' ? '历史' : '日志'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab('alerts')}
          style={{
            padding: '8px 16px',
            background: activeTab === 'alerts' ? '#2a3f5f' : '#16213e',
            border: '1px solid #333',
            borderRadius: 6,
            color: activeTab === 'alerts' ? '#0f0' : '#aaa',
            cursor: 'pointer',
          }}
        >
          告警记录
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          style={{
            padding: '8px 16px',
            background: activeTab === 'notifications' ? '#2a3f5f' : '#16213e',
            border: '1px solid #333',
            borderRadius: 6,
            color: activeTab === 'notifications' ? '#0f0' : '#aaa',
            cursor: 'pointer',
          }}
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
    return <p style={{ color: '#888' }}>暂无告警历史记录。</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {history.map((entry) => (
        <AlertHistoryItem key={entry.id} entry={entry} />
      ))}
    </div>
  )
}

function AlertHistoryItem({ entry }: { entry: AlertHistory }) {
  const eventColors: Record<string, string> = {
    firing: '#f44336',
    acknowledged: '#ff9800',
    resolved: '#4caf50',
  }

  const eventLabels: Record<string, string> = {
    firing: '触发告警',
    acknowledged: '已确认',
    resolved: '已恢复',
  }

  return (
    <div
      className="alert-history-item"
      style={{
        background: '#16213e',
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontWeight: 'bold' }}>{entry.serverName}</span>
            <span
              style={{
                fontSize: 12,
                padding: '2px 8px',
                borderRadius: 4,
                background: eventColors[entry.event] + '30',
                color: eventColors[entry.event],
              }}
            >
              {eventLabels[entry.event]}
            </span>
            <span
              style={{
                fontSize: 12,
                padding: '2px 8px',
                borderRadius: 4,
                background: getAlertLevelColor(entry.level) + '30',
                color: getAlertLevelColor(entry.level),
              }}
            >
              [{getAlertLevelLabel(entry.level)}]
            </span>
          </div>
          <div style={{ color: '#888', fontSize: 13 }}>
            {entry.message}
          </div>
        </div>
        <div style={{ color: '#888', fontSize: 13, textAlign: 'right' }}>
          {new Date(entry.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  )
}

function NotificationLogsList({ logs }: { logs: NotificationLog[] }) {
  if (logs.length === 0) {
    return <p style={{ color: '#888' }}>暂无通知日志记录。</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
    <div
      className="notification-log-item"
      style={{
        background: '#16213e',
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontWeight: 'bold' }}>{log.channelName}</span>
            <span style={{ color: '#888', fontSize: 14 }}>({typeLabels[log.channelType]})</span>
            <span
              style={{
                fontSize: 12,
                padding: '2px 8px',
                borderRadius: 4,
                background: log.status === 'success' ? '#4caf5030' : '#f4433630',
                color: log.status === 'success' ? '#4caf50' : '#f44336',
              }}
            >
              {log.status === 'success' ? '发送成功' : '发送失败'}
            </span>
          </div>
          {log.error && (
            <div style={{ color: '#f44336', fontSize: 13, marginTop: 4 }}>
              错误: {log.error}
            </div>
          )}
        </div>
        <div style={{ color: '#888', fontSize: 13, textAlign: 'right' }}>
          {new Date(log.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  )
}
