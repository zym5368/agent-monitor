import { useEffect, useState, useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useServersStore } from '@/store/servers'
import { useAlertsStore } from '@/store/alerts'
import { fetchMetrics } from '@/api/client'
import { alertEngine } from '@/utils/alertEngine'
import { getMetricLabel, getAlertLevelColor, getAlertLevelLabel } from '@/api/alerts'
import type { MetricsResponse, ActiveAlert } from '@/shared/types'

function barColorClass(percent: number): 'low' | 'mid' | 'high' {
  if (percent >= 90) return 'high'
  if (percent >= 70) return 'mid'
  return 'low'
}

function mountShortLabel(path: string): string {
  const clean = path.replace(/\/+$/, '')
  const parts = clean.split('/').filter(Boolean)
  const last = parts.length > 0 ? parts[parts.length - 1] : path
  const poolMatch = /^CACHEDEV(\d+)_DATA$/i.exec(last)
  if (poolMatch != null) {
    return `存储池${poolMatch[1]}`
  }
  return last
}


function HwItem({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: 'low' | 'mid' | 'high' | 'temp' | 'neutral'
}) {
  return (
    <div className="hw-item">
      <span className="hw-label">{label}</span>
      <span className={`hw-value ${valueClass ?? 'neutral'}`}>{value}</span>
    </div>
  )
}


function AlertBanner({ alert }: { alert: ActiveAlert }) {
  const { acknowledgeAlert } = useAlertsStore()
  const bgColor = getAlertLevelColor(alert.level)
  const unit = alert.units || (typeof alert.metric === 'string' && alert.metric.includes('temp') ? '°C' : '%')
  const bannerClass = alert.level === 'critical' ? 'alert-banner alert-banner-critical' : 'alert-banner alert-banner-warning'

  return (
    <div className={bannerClass}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: bgColor,
        }}
      />
      <div className="alert-banner-row">
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-ink)' }}>
              {alert.serverName}
            </span>
            <span
              className="badge"
              style={{
                background: bgColor + '25',
                color: bgColor,
              }}
            >
              {getAlertLevelLabel(alert.level)}
            </span>
            <span
              className={`badge ${alert.status === 'acknowledged' ? 'badge-success' : 'badge-danger'}`}
            >
              {alert.status === 'acknowledged' ? '已确认' : '触发中'}
            </span>
          </div>
          <div style={{ color: 'var(--color-ink-muted)', fontSize: 14, marginBottom: 4 }}>
            <span style={{ color: 'var(--color-ink-subtle)' }}>指标：</span>
            {getMetricLabel(alert.metric)} = {alert.value.toFixed(1)}{unit}
            <span style={{ margin: '0 8px', color: 'var(--color-ink-tertiary)' }}>•</span>
            阈值：{alert.condition === 'above' ? '>' : '<'} {alert.threshold}{unit}
          </div>
          <div style={{ color: 'var(--color-ink-tertiary)', fontSize: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {new Date(alert.startedAt).toLocaleString('zh-CN')}
            </span>
          </div>
        </div>
        {alert.status === 'firing' && (
          <button
            onClick={() => acknowledgeAlert(alert.id)}
            className="btn btn-primary"
          >
            确认告警
          </button>
        )}
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
  trend,
}: {
  icon: ReactNode
  label: string
  value: string | number
  color: string
  trend?: 'up' | 'down'
}) {
  return (
    <div className="stat-card">
      <div
        className="stat-card-icon"
        style={{ background: color + '20', color }}
      >
        {icon}
      </div>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value" style={{ color }}>{value}</div>
      {trend && (
        <div className={`stat-card-trend ${trend === 'up' ? 'text-success' : 'text-danger'}`}>
          {trend === 'up' ? '↑' : '↓'} 较上次
        </div>
      )}
    </div>
  )
}

export function Dashboard() {
  const { servers, add } = useServersStore()
  const { activeAlerts } = useAlertsStore()
  const [metrics, setMetrics] = useState<Record<string, MetricsResponse | null>>({})

  const addLocalAgent = () => {
    add({
      name: '本地 Agent',
      dataSource: 'agent',
      host: 'localhost',
      port: 9100,
      apiKey: '',
      dockgeUrl: '',
    })
  }

  useEffect(() => {
    alertEngine.start()
    alertEngine.updateServers(servers)
    return () => alertEngine.stop()
  }, [servers])

  useEffect(() => {
    if (servers.length === 0) return
    const run = async () => {
      const next: Record<string, MetricsResponse | null> = {}
      for (const s of servers) {
        const m = await fetchMetrics(s)
        next[s.id] = m
        if (m) {
          alertEngine.checkServer(s, m)
        }
      }
      setMetrics((m) => ({ ...m, ...next }))
    }
    run()
    const t = setInterval(run, 8000)
    return () => clearInterval(t)
  }, [servers])

  const firingAlerts = activeAlerts.filter((a) => a.status === 'firing' || a.status === 'acknowledged')
  const pendingAlerts = activeAlerts.filter((a) => a.status === 'pending')

  const stats = useMemo(() => {
    const onlineCount = servers.filter((s) => metrics[s.id] != null).length
    const avgCpu = servers.length > 0
      ? servers.reduce((sum, s) => sum + (metrics[s.id]?.cpu_percent || 0), 0) / servers.length
      : 0
    const avgMem = servers.length > 0
      ? servers.reduce((sum, s) => sum + (metrics[s.id]?.memory_percent || 0), 0) / servers.length
      : 0

    return {
      totalServers: servers.length,
      onlineServers: onlineCount,
      avgCpu,
      avgMem,
      criticalAlerts: firingAlerts.filter((a) => a.level === 'critical').length,
      warningAlerts: firingAlerts.filter((a) => a.level === 'warning').length,
    }
  }, [servers, metrics, firingAlerts])

  return (
    <div style={{ paddingBottom: 40 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">集群概览</h1>
          <p className="page-subtitle">实时监控您的服务器集群</p>
        </div>
        <div className="page-header-actions">
          <Link
            to="/alerts"
            className="btn btn-secondary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            告警规则
          </Link>
          <Link
            to="/alert-history"
            className="btn btn-primary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="14 2 18 6 7 17 3 17 3 13 14 2" />
              <line x1="3" y1="22" x2="21" y2="22" />
            </svg>
            告警历史
          </Link>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          }
          label="服务器总数"
          value={stats.totalServers}
          color="#6366f1"
        />
        <StatCard
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }
          label="在线服务器"
          value={`${stats.onlineServers}/${stats.totalServers}`}
          color="#22c55e"
        />
        <StatCard
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          }
          label="平均 CPU"
          value={`${stats.avgCpu.toFixed(1)}%`}
          color={stats.avgCpu >= 80 ? '#ef4444' : stats.avgCpu >= 60 ? '#f59e0b' : '#22c55e'}
        />
        <StatCard
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
          }
          label="平均内存"
          value={`${stats.avgMem.toFixed(1)}%`}
          color={stats.avgMem >= 80 ? '#ef4444' : stats.avgMem >= 60 ? '#f59e0b' : '#22c55e'}
        />
      </div>

      {firingAlerts.length > 0 && (
        <div className="alert-section">
          <div className="alert-section-header">
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: stats.criticalAlerts > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stats.criticalAlerts > 0 ? 'var(--color-danger)' : 'var(--color-warning)'} strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--color-ink)' }}>
                活跃告警 ({firingAlerts.length})
              </h3>
              <p style={{ margin: '4px 0 0', color: 'var(--color-ink-subtle)', fontSize: 13 }}>
                {stats.criticalAlerts > 0 && <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{stats.criticalAlerts} 严重</span>}
                {stats.criticalAlerts > 0 && stats.warningAlerts > 0 && ' · '}
                {stats.warningAlerts > 0 && <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>{stats.warningAlerts} 警告</span>}
              </p>
            </div>
          </div>
          {firingAlerts.map((alert) => (
            <AlertBanner key={alert.id} alert={alert} />
          ))}
        </div>
      )}

      {pendingAlerts.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--color-warning)',
              animation: 'pulse 2s infinite',
            }} />
            <h3 style={{ margin: 0, fontSize: 14, color: 'var(--color-warning)', fontWeight: 500 }}>
              待确认 ({pendingAlerts.length})
            </h3>
          </div>
        </div>
      )}

      <div className="server-cards-grid">
        {servers.map((s) => {
          const m = metrics[s.id]
          const serverAlerts = activeAlerts.filter(
            (a) => a.serverId === s.id && (a.status === 'firing' || a.status === 'acknowledged')
          )
          const hasAlert = serverAlerts.length > 0
          const highestLevel = hasAlert
            ? serverAlerts.some((a) => a.level === 'critical')
              ? 'critical'
              : 'warning'
            : null

          return (
            <div
              key={s.id}
              className={`server-card ${hasAlert ? (highestLevel === 'critical' ? 'server-card-alert-critical' : 'server-card-alert-warning') : ''}`}
            >
              {hasAlert && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: highestLevel === 'critical'
                      ? 'linear-gradient(90deg, var(--color-danger), #f87171)'
                      : 'linear-gradient(90deg, var(--color-warning), #facc15)',
                  }}
                />
              )}
              <div className="server-card-header">
                <div className="server-card-title">
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: m ? 'rgba(34, 197, 94, 0.15)' : 'rgba(100, 116, 139, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={m ? 'var(--color-success)' : 'var(--color-ink-subtle)'} strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="server-card-name">
                      {s.name}
                    </h3>
                    <p className="server-card-host">
                      {s.host}:{s.port}
                    </p>
                  </div>
                </div>
                {hasAlert && (
                  <span
                    className={`badge ${highestLevel === 'critical' ? 'badge-danger' : 'badge-warning'}`}
                  >
                    <span className="status-dot" />
                    {serverAlerts.length} 告警
                  </span>
                )}
              </div>
              {m == null ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#64748b',
                }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px', opacity: 0.5 }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p style={{ margin: 0, fontSize: 14 }}>无法获取指标</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#475569' }}>请检查服务器连接</p>
                  <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8', textAlign: 'left', background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 4 }}>
                    <p style={{ margin: 0 }}>调试信息：</p>
                    <p style={{ margin: '4px 0 0' }}>数据源: {s.dataSource ?? 'agent'}</p>
                    <p style={{ margin: 0 }}>Host: {s.host}</p>
                    <p style={{ margin: 0 }}>Port: {s.port}</p>
                    <p style={{ margin: 0 }}>请求URL: http://{s.host.replace(/:\d+$/, '')}:{s.port}/api/metrics</p>
                    <p style={{ margin: 0 }}>Netdata URL: {s.netdataUrl || '(未设置)'}</p>
                    <p style={{ margin: '8px 0 0', color: '#f59e0b' }}>请按 F12 打开控制台查看详细日志</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="hw-bar">
                    <div className="hw-row hw-row-wrap">
                      <HwItem label="CPU" value={`${m.cpu_percent.toFixed(1)}%`} valueClass={barColorClass(m.cpu_percent)} />
                      {m.cpu_temperature_c != null && !Number.isNaN(m.cpu_temperature_c) && (
                        <HwItem label="CPU-T" value={`${m.cpu_temperature_c.toFixed(0)}°C`} valueClass="temp" />
                      )}
                      <HwItem label="MEM" value={`${m.memory_percent.toFixed(1)}%`} valueClass={barColorClass(m.memory_percent)} />
                      <HwItem label="DSK" value={`${m.disk_percent.toFixed(1)}%`} valueClass={barColorClass(m.disk_percent)} />
                      {m.gpu != null && (
                        <>
                          <HwItem label="GPU" value={`${m.gpu.utilization_percent.toFixed(1)}%`} valueClass={barColorClass(m.gpu.utilization_percent)} />
                          <HwItem label="GPU-T" value={`${m.gpu.temperature_c.toFixed(0)}°C`} valueClass="temp" />
                        </>
                      )}
                      <HwItem label="MEM" value={`${formatBytes(m.memory_used_bytes)}/${formatBytes(m.memory_total_bytes)}`} valueClass="neutral" />
                      <HwItem label="DSK" value={`${formatBytes(m.disk_used_bytes)}/${formatBytes(m.disk_total_bytes)}`} valueClass="neutral" />
                      {m.gpu != null && (
                        <HwItem label="VRAM" value={`${formatBytes(m.gpu.memory_used_bytes)}/${formatBytes(m.gpu.memory_total_bytes)}`} valueClass="neutral" />
                      )}
                    </div>
                  </div>
                  {m.disk_mounts != null && m.disk_mounts.length > 0 && (
                    <div className="dashboard-mounts">
                      <div className="dashboard-mounts-label">挂载点明细</div>
                      <div className="hw-bar hw-bar-mounts">
                        <div className="hw-row hw-row-wrap">
                          {m.disk_mounts.map((mount) => (
                            <HwItem
                              key={mount.path}
                              label={mountShortLabel(mount.path)}
                              value={`${mount.used_percent.toFixed(1)}%`}
                              valueClass={barColorClass(mount.used_percent)}
                            />
                          ))}
                          {m.disk_mounts.map((mount) => (
                            <HwItem
                              key={mount.path + '_sz'}
                              label={mountShortLabel(mount.path)}
                              value={`${formatBytes(mount.used_bytes)}/${formatBytes(mount.total_bytes)}`}
                              valueClass="neutral"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
      {servers.length === 0 && (
        <div className="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 16px', opacity: 0.4 }}>
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <h3 className="empty-state-title">还没有添加服务器</h3>
          <p className="empty-state-text">请先在「服务器」页面中添加服务器</p>
          <button
            type="button"
            onClick={addLocalAgent}
            className="btn btn-primary"
          >
            快速添加本地 Agent (localhost:9100)
          </button>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

function formatBytes(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + ' TB'
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + ' KB'
  return n + ' B'
}
