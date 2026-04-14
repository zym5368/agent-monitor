import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAlertsStore } from '@/store/alerts'
import {
  getAlertLevelLabel,
  getAlertLevelColor,
} from '@/api/alerts'
import type { NotificationChannelType } from '@/shared/types'

export function MobileAlertHistory() {
  const navigate = useNavigate()
  const { history, clearHistory, logs, clearLogs } = useAlertsStore()
  const [activeTab, setActiveTab] = useState<'alerts' | 'notifications'>('alerts')

  return (
    <div className="mobile-page mobile-page-enter">
      <div className="mobile-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="mobile-page-title">告警历史</h1>
          <p className="mobile-page-subtitle">查看告警和通知记录</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: 24,
              cursor: 'pointer',
              minWidth: 44,
              minHeight: 44,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mobile-tabs">
        <button
          className={`mobile-tab ${activeTab === 'alerts' ? 'active' : ''}`}
          onClick={() => setActiveTab('alerts')}
        >
          告警记录
        </button>
        <button
          className={`mobile-tab ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          通知日志
        </button>
      </div>

      <button
        onClick={() => activeTab === 'alerts' ? clearHistory() : clearLogs()}
        className="mobile-button mobile-button-danger"
        style={{ width: '100%', marginBottom: 16 }}
      >
        清空{activeTab === 'alerts' ? '历史' : '日志'}
      </button>

      {activeTab === 'alerts' ? (
        <AlertHistoryList history={history} />
      ) : (
        <NotificationLogsList logs={logs} />
      )}
    </div>
  )
}

function AlertHistoryList({ history }: { history: any[] }) {
  if (history.length === 0) {
    return (
      <div className="mobile-empty-state">
        <p style={{ color: '#64748b', margin: 0 }}>暂无告警历史记录</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {history.map((entry) => (
        <AlertHistoryItem key={entry.id} entry={entry} />
      ))}
    </div>
  )
}

function AlertHistoryItem({ entry }: { entry: any }) {
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
    <div className="mobile-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 'bold', fontSize: 14 }}>{entry.serverName}</span>
            <span
              style={{
                fontSize: 10,
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
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 4,
                background: getAlertLevelColor(entry.level) + '30',
                color: getAlertLevelColor(entry.level),
              }}
            >
              [{getAlertLevelLabel(entry.level)}]
            </span>
          </div>
          <div style={{ color: '#888', fontSize: 12 }}>
            {entry.message}
          </div>
        </div>
        <div style={{ color: '#64748b', fontSize: 11, textAlign: 'right' }}>
          {new Date(entry.timestamp).toLocaleString('zh-CN')}
        </div>
      </div>
    </div>
  )
}

function NotificationLogsList({ logs }: { logs: any[] }) {
  if (logs.length === 0) {
    return (
      <div className="mobile-empty-state">
        <p style={{ color: '#64748b', margin: 0 }}>暂无通知日志记录</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {logs.map((log) => (
        <NotificationLogItem key={log.id} log={log} />
      ))}
    </div>
  )
}

function NotificationLogItem({ log }: { log: any }) {
  const typeLabels: Record<NotificationChannelType, string> = {
    webhook: 'Webhook',
    email: '邮件',
    wechat: '企业微信',
    dingtalk: '钉钉',
    serverchan: 'Server酱 (SCT)',
    serverchan3: 'Server酱³ (SC3)',
  }

  return (
    <div className="mobile-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 'bold', fontSize: 14 }}>{log.channelName}</span>
            <span style={{ color: '#888', fontSize: 13 }}>
              ({(typeLabels as Record<string, string>)[String(log.channelType)] ?? String(log.channelType)})
            </span>
            <span
              style={{
                fontSize: 10,
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
            <div style={{ color: '#f44336', fontSize: 12, marginTop: 4 }}>
              错误: {log.error}
            </div>
          )}
        </div>
        <div style={{ color: '#64748b', fontSize: 11, textAlign: 'right' }}>
          {new Date(log.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  )
}
