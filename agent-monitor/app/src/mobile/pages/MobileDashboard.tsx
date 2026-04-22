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

function MetricStripItem({
  label,
  percent,
  mainSuffix,
  subValue,
}: {
  label: string
  percent: number
  mainSuffix?: string
  subValue?: string
}) {
  const pct = Math.min(100, Math.max(0, percent))
  const colorClass = barColorClass(pct)
  return (
    <div className="mobile-strip-item">
      <div className="mobile-strip-label">{label}</div>
      <div className="mobile-strip-main">
        {pct.toFixed(1)}%
        {mainSuffix != null && <span className="mobile-strip-suffix">{mainSuffix}</span>}
      </div>
      {subValue != null && <div className="mobile-strip-sub">{subValue}</div>}
      <div className="mobile-strip-bar-outer">
        <div className={`mobile-strip-bar-inner ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}


function AlertBanner({ alert }: { alert: ActiveAlert }) {
  const { acknowledgeAlert } = useAlertsStore()
  const bgColor = getAlertLevelColor(alert.level)
  const unit = alert.units || (typeof alert.metric === 'string' && alert.metric.includes('temp') ? '°C' : '%')

  return (
    <div
      className={`mobile-alert-banner ${alert.level === 'critical' ? 'critical' : 'warning'}`}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: '#f8fafc' }}>
              {alert.serverName}
            </span>
            <span
              style={{
                fontSize: 10,
                padding: '3px 8px',
                borderRadius: 20,
                background: bgColor + '25',
                color: bgColor,
                fontWeight: 600,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
              }}
            >
              {getAlertLevelLabel(alert.level)}
            </span>
            <span
              style={{
                fontSize: 10,
                padding: '3px 8px',
                borderRadius: 20,
                background: alert.status === 'acknowledged' ? '#22c55e20' : '#ef444420',
                color: alert.status === 'acknowledged' ? '#22c55e' : '#ef4444',
                fontWeight: 500,
              }}
            >
              {alert.status === 'acknowledged' ? '已确认' : '触发中'}
            </span>
          </div>
          <div style={{ color: '#cbd5e1', fontSize: 13, marginBottom: 4 }}>
            <span style={{ color: '#94a3b8' }}>指标：</span>
            {getMetricLabel(alert.metric)} = {alert.value.toFixed(1)}{unit}
            <span style={{ margin: '0 6px', color: '#64748b' }}>•</span>
            阈值：{alert.condition === 'above' ? '>' : '<'} {alert.threshold}{unit}
          </div>
          <div style={{ color: '#64748b', fontSize: 11 }}>
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
            className="mobile-button mobile-button-primary"
            style={{ padding: '8px 16px', fontSize: 13, minHeight: 36 }}
          >
            确认
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
}: {
  icon: ReactNode
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="mobile-stat-card">
      <div className="mobile-stat-icon" style={{ background: color + '20', color }}>
        {icon}
      </div>
      <div className="mobile-stat-label">{label}</div>
      <div className="mobile-stat-value">{value}</div>
    </div>
  )
}

export function MobileDashboard() {
  const { servers } = useServersStore()
  const { activeAlerts } = useAlertsStore()
  const [metrics, setMetrics] = useState<Record<string, MetricsResponse | null>>({})

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

  const stats = useMemo(() => {
    const onlineCount = servers.filter((s) => metrics[s.id] != null).length
    const avgCpu = servers.length > 0
      ? servers.reduce((sum, s) => sum + (metrics[s.id]?.cpu_percent || 0), 0) / servers.length
      : 0
    const avgMem = servers.length > 0
      ? servers.reduce((sum, s) => sum + (metrics[s.id]?.memory_percent || 0), 0) / servers.length
      : 0
    const criticalAlerts = firingAlerts.filter((a) => a.level === 'critical').length
    const warningAlerts = firingAlerts.filter((a) => a.level === 'warning').length

    return {
      totalServers: servers.length,
      onlineServers: onlineCount,
      avgCpu,
      avgMem,
      criticalAlerts,
      warningAlerts,
    }
  }, [servers, metrics, firingAlerts])

  return (
    <div className="mobile-page mobile-page-enter">
      <div className="mobile-page-header">
        <h1 className="mobile-page-title">仪表台</h1>
        <p className="mobile-page-subtitle">实时监控您的服务器集群</p>
      </div>

      {/* 统计卡片 */}
      <div className="mobile-stats-grid">
        <StatCard
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          }
          label="服务器"
          value={`${stats.onlineServers}/${stats.totalServers}`}
          color="#6366f1"
        />
        <StatCard
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
            </svg>
          }
          label="平均CPU"
          value={`${stats.avgCpu.toFixed(1)}%`}
          color={stats.avgCpu >= 80 ? '#ef4444' : stats.avgCpu >= 60 ? '#f59e0b' : '#22c55e'}
        />
        <StatCard
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
          }
          label="平均内存"
          value={`${stats.avgMem.toFixed(1)}%`}
          color={stats.avgMem >= 80 ? '#ef4444' : stats.avgMem >= 60 ? '#f59e0b' : '#22c55e'}
        />
        <StatCard
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
            </svg>
          }
          label="活跃告警"
          value={firingAlerts.length}
          color={stats.criticalAlerts > 0 ? '#ef4444' : stats.warningAlerts > 0 ? '#f59e0b' : '#22c55e'}
        />
      </div>

      {/* 活跃告警 */}
      {firingAlerts.length > 0 && (
        <>
          <div className="mobile-section-header">
            <div className="mobile-section-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <h2 className="mobile-section-title">活跃告警 ({firingAlerts.length})</h2>
          </div>
          {firingAlerts.map((alert) => (
            <AlertBanner key={alert.id} alert={alert} />
          ))}
        </>
      )}

      {/* 服务器卡片 */}
      {servers.length > 0 && (
        <div className="mobile-section-header">
          <div className="mobile-section-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <h2 className="mobile-section-title">服务器</h2>
        </div>
      )}

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
            className="mobile-card"
            style={{
              borderColor: hasAlert
                ? (highestLevel === 'critical' ? '#ef4444' : '#f59e0b')
                : 'rgba(71, 85, 105, 0.4)',
            }}
          >
            <div className="mobile-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: m ? 'rgba(34, 197, 94, 0.15)' : 'rgba(100, 116, 139, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={m ? '#22c55e' : '#64748b'} strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#f8fafc' }}>
                    {s.name}
                  </h3>
                  <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: 12 }}>
                    {s.host}:{s.port}
                  </p>
                </div>
              </div>
              {hasAlert && (
                <span className="mobile-status-badge" style={{ color: highestLevel === 'critical' ? '#f87171' : '#fbbf24' }}>
                  <span className="mobile-status-dot" />
                  {serverAlerts.length} 告警
                </span>
              )}
            </div>

            {m == null ? (
              <div style={{ textAlign: 'center', padding: '30px 20px', color: '#64748b' }}>
                <p style={{ margin: 0, fontSize: 13 }}>无法获取指标</p>
              </div>
            ) : (
              <>
                <div className="mobile-strip">
                  <MetricStripItem
                    label="CPU"
                    percent={m.cpu_percent}
                    mainSuffix={m.cpu_temperature_c != null && !Number.isNaN(m.cpu_temperature_c)
                      ? `${m.cpu_temperature_c.toFixed(0)}°C`
                      : undefined}
                  />
                  <MetricStripItem
                    label="内存"
                    percent={m.memory_percent}
                    subValue={`${formatBytes(m.memory_used_bytes)} / ${formatBytes(m.memory_total_bytes)}`}
                  />
                  <MetricStripItem
                    label="磁盘"
                    percent={m.disk_percent}
                    subValue={`${formatBytes(m.disk_used_bytes)} / ${formatBytes(m.disk_total_bytes)}`}
                  />
                  {m.gpu != null && (
                    <MetricStripItem
                      label="GPU"
                      percent={m.gpu.utilization_percent}
                      mainSuffix={`${m.gpu.temperature_c.toFixed(0)}°C`}
                      subValue={`显存 ${formatBytes(m.gpu.memory_used_bytes)} / ${formatBytes(m.gpu.memory_total_bytes)}`}
                    />
                  )}
                </div>
                {m.disk_mounts != null && m.disk_mounts.length > 0 && (
                  <div className="mobile-mounts">
                    <div className="mobile-mounts-label">挂载点明细</div>
                    <div className="mobile-strip mobile-strip-scroll">
                      {m.disk_mounts.map((mount) => (
                        <MetricStripItem
                          key={mount.path}
                          label={mountShortLabel(mount.path)}
                          percent={mount.used_percent}
                          subValue={`${formatBytes(mount.used_bytes)} / ${formatBytes(mount.total_bytes)}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}

      {servers.length === 0 && (
        <div className="mobile-empty-state">
          <div className="mobile-empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <h3 className="mobile-empty-title">还没有添加服务器</h3>
          <p className="mobile-empty-text">请在「更多」→「服务器管理」中添加服务器</p>
          <Link to="/servers" className="mobile-button mobile-button-primary" style={{ textDecoration: 'none' }}>
            添加服务器
          </Link>
        </div>
      )}
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
