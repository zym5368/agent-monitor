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
  return parts.length > 0 ? parts[parts.length - 1] : path
}

function MetricBar({
  label,
  percent,
  detail,
  extra,
}: { label: string; percent: number; detail?: string; extra?: React.ReactNode }) {
  const pct = Math.min(100, Math.max(0, percent))
  const colorClass = barColorClass(pct)
  return (
    <div className="dashboard-metric-bar">
      <div className="label-row">
        <span>{label}</span>
        <span>
          {pct.toFixed(1)}%{extra != null && <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 400, color: '#94a3b8' }}>{extra}</span>}
        </span>
      </div>
      <div className="bar-outer">
        <div
          className={`bar-inner ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {detail != null && <div className="detail">{detail}</div>}
    </div>
  )
}

function AlertBanner({ alert }: { alert: ActiveAlert }) {
  const { acknowledgeAlert } = useAlertsStore()
  const bgColor = getAlertLevelColor(alert.level)
  const unit = alert.units || (typeof alert.metric === 'string' && alert.metric.includes('temp') ? '°C' : '%')

  return (
    <div
      style={{
        background: bgColor + '15',
        border: `1px solid ${bgColor}40`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        backdropFilter: 'blur(10px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
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
      <div className="alert-banner-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingLeft: 12, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: '#f8fafc' }}>
              {alert.serverName}
            </span>
            <span
              style={{
                fontSize: 11,
                padding: '3px 10px',
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
                fontSize: 11,
                padding: '3px 10px',
                borderRadius: 20,
                background: alert.status === 'acknowledged' ? '#22c55e20' : '#ef444420',
                color: alert.status === 'acknowledged' ? '#22c55e' : '#ef4444',
                fontWeight: 500,
              }}
            >
              {alert.status === 'acknowledged' ? '已确认' : '触发中'}
            </span>
          </div>
          <div style={{ color: '#cbd5e1', fontSize: 14, marginBottom: 4 }}>
            <span style={{ color: '#94a3b8' }}>指标：</span>
            {getMetricLabel(alert.metric)} = {alert.value.toFixed(1)}{unit}
            <span style={{ margin: '0 8px', color: '#64748b' }}>•</span>
            阈值：{alert.condition === 'above' ? '>' : '<'} {alert.threshold}{unit}
          </div>
          <div style={{ color: '#64748b', fontSize: 12 }}>
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
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)'
            }}
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
      <div className="stat-card-value">{value}</div>
      {trend && (
        <div className={`stat-card-trend ${trend}`}>
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
    <div className="dashboard-page" style={{ paddingBottom: 40 }}>
      <div className="dashboard-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 28,
        paddingBottom: 20,
        borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            background: 'linear-gradient(135deg, #f8fafc, #94a3b8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.5px',
          }}>
            集群概览
          </h1>
          <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 14 }}>
            实时监控您的服务器集群
          </p>
        </div>
        <div className="dashboard-header-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link
            to="/alerts"
            style={{
              background: 'rgba(30, 41, 59, 0.8)',
              padding: '12px 20px',
              borderRadius: 10,
              color: '#94a3b8',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
              border: '1px solid rgba(71, 85, 105, 0.4)',
              transition: 'all 0.2s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)'
              e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)'
              e.currentTarget.style.color = '#a5b4fc'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(30, 41, 59, 0.8)'
              e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.4)'
              e.currentTarget.style.color = '#94a3b8'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            告警规则
          </Link>
          <Link
            to="/alert-history"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              padding: '12px 20px',
              borderRadius: 10,
              color: '#fff',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 600,
              border: 'none',
              transition: 'all 0.2s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="14 2 18 6 7 17 3 17 3 13 14 2" />
              <line x1="3" y1="22" x2="21" y2="22" />
            </svg>
            告警历史
          </Link>
        </div>
      </div>

      <div className="dashboard-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
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
        <div className="dashboard-alerts-section" style={{ marginBottom: 28 }}>
          <div className="dashboard-alert-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: stats.criticalAlerts > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stats.criticalAlerts > 0 ? '#ef4444' : '#f59e0b'} strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#f8fafc' }}>
                活跃告警 ({firingAlerts.length})
              </h3>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
                {stats.criticalAlerts > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}>{stats.criticalAlerts} 严重</span>}
                {stats.criticalAlerts > 0 && stats.warningAlerts > 0 && ' · '}
                {stats.warningAlerts > 0 && <span style={{ color: '#f59e0b', fontWeight: 600 }}>{stats.warningAlerts} 警告</span>}
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
              background: '#f59e0b',
              animation: 'pulse 2s infinite',
            }} />
            <h3 style={{ margin: 0, fontSize: 14, color: '#f59e0b', fontWeight: 500 }}>
              待确认 ({pendingAlerts.length})
            </h3>
          </div>
        </div>
      )}

      <div className="dashboard-server-cards-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 20,
      }}>
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
              style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
                borderRadius: 16,
                padding: 24,
                border: `2px solid ${hasAlert ? (highestLevel === 'critical' ? '#ef4444' : '#f59e0b') : 'rgba(71, 85, 105, 0.3)'}`,
                backdropFilter: 'blur(20px)',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = hasAlert
                  ? `0 20px 40px ${highestLevel === 'critical' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`
                  : '0 20px 40px rgba(0, 0, 0, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
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
                      ? 'linear-gradient(90deg, #ef4444, #f87171)'
                      : 'linear-gradient(90deg, #f59e0b, #facc15)',
                  }}
                />
              )}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 20,
                paddingBottom: 16,
                borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: m ? 'rgba(34, 197, 94, 0.15)' : 'rgba(100, 116, 139, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={m ? '#22c55e' : '#64748b'} strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#f8fafc' }}>
                      {s.name}
                    </h3>
                    <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: 13 }}>
                      {s.host}:{s.port}
                    </p>
                  </div>
                </div>
                {hasAlert && (
                  <span
                    style={{
                      fontSize: 12,
                      padding: '4px 10px',
                      borderRadius: 20,
                      background: highestLevel === 'critical' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: highestLevel === 'critical' ? '#f87171' : '#fbbf24',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: highestLevel === 'critical' ? '#ef4444' : '#f59e0b',
                    }} />
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
                  <MetricBar
                    label="CPU"
                    percent={m.cpu_percent}
                    extra={m.cpu_temperature_c != null && !Number.isNaN(m.cpu_temperature_c) ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
                        </svg>
                        {m.cpu_temperature_c.toFixed(0)}°C
                      </span>
                    ) : undefined}
                  />
                  <MetricBar
                    label="内存"
                    percent={m.memory_percent}
                    detail={`${formatBytes(m.memory_used_bytes)} / ${formatBytes(m.memory_total_bytes)}`}
                  />
                  <MetricBar
                    label="磁盘"
                    percent={m.disk_percent}
                    detail={`${formatBytes(m.disk_used_bytes)} / ${formatBytes(m.disk_total_bytes)}`}
                  />
                  {m.disk_mounts != null && m.disk_mounts.length > 0 && (
                    <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(15, 23, 42, 0.45)', border: '1px solid rgba(71, 85, 105, 0.28)' }}>
                      <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>挂载点明细</div>
                      {m.disk_mounts.map((mount) => (
                        <MetricBar
                          key={mount.path}
                          label={mountShortLabel(mount.path)}
                          percent={mount.used_percent}
                          detail={`${formatBytes(mount.used_bytes)} / ${formatBytes(mount.total_bytes)} · ${mount.path}`}
                        />
                      ))}
                    </div>
                  )}
                  {m.gpu != null && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(71, 85, 105, 0.3)' }}>
                      <MetricBar
                        label="GPU"
                        percent={m.gpu.utilization_percent}
                        detail={`显存 ${formatBytes(m.gpu.memory_used_bytes)} / ${formatBytes(m.gpu.memory_total_bytes)}`}
                        extra={
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
                            </svg>
                            {m.gpu.temperature_c.toFixed(0)}°C
                          </span>
                        }
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
      {servers.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '80px 20px',
          color: '#64748b',
        }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 16px', opacity: 0.4 }}>
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#94a3b8' }}>还没有添加服务器</h3>
          <p style={{ margin: '0 0 20px', fontSize: 14 }}>请先在「服务器」页面中添加服务器</p>
          <button
            type="button"
            onClick={addLocalAgent}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
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
