import { useState, useEffect, useMemo } from 'react'
import { useServersStore } from '@/store/servers'
import {
  fetchSystemInfo,
  fetchServices,
  startService,
  stopService,
  restartService,
  enableService,
  disableService,
} from '@/api/client'
import type { SystemInfo, ServiceInfo } from '@/shared/types'

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}天 ${hours}小时 ${minutes}分钟`
  if (hours > 0) return `${hours}小时 ${minutes}分钟`
  return `${minutes}分钟`
}

function formatBytes(n: number): string {
  if (n >= 1099511627776) return (n / 1099511627776).toFixed(2) + ' TB'
  if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' GB'
  if (n >= 1048576) return (n / 1048576).toFixed(2) + ' MB'
  if (n >= 1024) return (n / 1024).toFixed(2) + ' KB'
  return n + ' B'
}

function CustomSelect({
  value,
  options,
  onChange,
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mobile-select"
        style={{ textAlign: 'left', paddingRight: 40 }}
      >
        {options.find((opt) => opt.value === value)?.label ?? value}
      </button>
      <span
        style={{
          position: 'absolute',
          right: 14,
          top: '50%',
          transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          color: '#94a3b8',
          pointerEvents: 'none',
          transition: 'transform 0.18s ease',
          fontSize: 12,
        }}
      >
        ▼
      </span>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            zIndex: 1200,
            borderRadius: 10,
            border: '1px solid #334155',
            background: '#0f172a',
            boxShadow: '0 12px 24px rgba(0, 0, 0, 0.45)',
            overflow: 'hidden',
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              style={{
                width: '100%',
                border: 'none',
                textAlign: 'left',
                padding: '12px 14px',
                fontSize: 15,
                color: '#f8fafc',
                background: opt.value === value ? 'rgba(59, 130, 246, 0.55)' : 'transparent',
                cursor: 'pointer',
                minHeight: 44,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function InfoItem({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="mobile-list-item">
      <div className="mobile-list-item-main">
        <p className="mobile-list-item-title">{value}</p>
        <p className="mobile-list-item-subtitle">{label}</p>
      </div>
      {subValue && <span style={{ color: '#64748b', fontSize: 13 }}>{subValue}</span>}
    </div>
  )
}

function ServiceItem({
  service,
  onAction,
}: {
  service: ServiceInfo
  onAction: (name: string, action: 'start' | 'stop' | 'restart' | 'enable' | 'disable') => void
}) {
  return (
    <div className="mobile-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#f8fafc', fontFamily: 'Consolas, Monaco, monospace' }}>
            {service.name}
          </h3>
          <p style={{ margin: '4px 0 0', color: '#cbd5e1', fontSize: 13 }}>
            {service.display_name}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <span className="mobile-status-badge" style={{ color: service.status === 'running' ? '#4ade80' : '#94a3b8' }}>
            <span className="mobile-status-dot" />
            {service.status === 'running' ? '运行中' : service.status === 'stopped' ? '已停止' : service.status}
          </span>
          <span className="mobile-status-badge" style={{ color: service.enabled ? '#a5b4fc' : '#94a3b8' }}>
            {service.enabled ? '已启用' : '已禁用'}
          </span>
        </div>
      </div>
      <div className="mobile-action-row">
        {service.status !== 'running' && (
          <button
            onClick={() => onAction(service.name, 'start')}
            className="mobile-action-button"
            style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }}
          >
            启动
          </button>
        )}
        {service.status === 'running' && (
          <>
            <button
              onClick={() => onAction(service.name, 'stop')}
              className="mobile-action-button"
              style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5' }}
            >
              停止
            </button>
            <button
              onClick={() => onAction(service.name, 'restart')}
              className="mobile-action-button"
              style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' }}
            >
              重启
            </button>
          </>
        )}
        {!service.enabled && (
          <button
            onClick={() => onAction(service.name, 'enable')}
            className="mobile-action-button"
            style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc' }}
          >
            启用
          </button>
        )}
        {service.enabled && (
          <button
            onClick={() => onAction(service.name, 'disable')}
            className="mobile-action-button"
            style={{ background: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8' }}
          >
            禁用
          </button>
        )}
      </div>
    </div>
  )
}

export function MobileSystem() {
  const { servers } = useServersStore()
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null)
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [services, setServices] = useState<ServiceInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [servicesLoading, setServicesLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'services'>('info')
  const [serviceSearchQuery, setServiceSearchQuery] = useState('')

  const selectedServer = servers.find((s) => s.id === selectedServerId)

  const filteredServices = useMemo(() => {
    const sorted = [...services].sort((a, b) => {
      const aRunning = a.status === 'running'
      const bRunning = b.status === 'running'
      if (aRunning !== bRunning) return aRunning ? -1 : 1
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
      return a.name.localeCompare(b.name, 'zh-CN')
    })
    const q = serviceSearchQuery.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.display_name.toLowerCase().includes(q),
    )
  }, [services, serviceSearchQuery])

  const loadSystemInfo = async () => {
    if (!selectedServer) return
    setLoading(true)
    const data = await fetchSystemInfo(selectedServer)
    setSystemInfo(data)
    setLoading(false)
  }

  const loadServices = async () => {
    if (!selectedServer) return
    setServicesLoading(true)
    const data = await fetchServices(selectedServer)
    setServices(data || [])
    setServicesLoading(false)
  }

  const handleServiceAction = async (
    name: string,
    action: 'start' | 'stop' | 'restart' | 'enable' | 'disable',
  ) => {
    if (!selectedServer) return
    let success = false
    switch (action) {
      case 'start':
        success = await startService(selectedServer, name)
        break
      case 'stop':
        success = await stopService(selectedServer, name)
        break
      case 'restart':
        success = await restartService(selectedServer, name)
        break
      case 'enable':
        success = await enableService(selectedServer, name)
        break
      case 'disable':
        success = await disableService(selectedServer, name)
        break
    }
    if (success) {
      loadServices()
    }
  }

  useEffect(() => {
    if (servers.length > 0 && !selectedServerId) {
      setSelectedServerId(servers[0].id)
    }
  }, [servers])

  useEffect(() => {
    setServiceSearchQuery('')
  }, [selectedServerId])

  useEffect(() => {
    if (selectedServer) {
      if (activeTab === 'info') {
        loadSystemInfo()
      } else {
        loadServices()
      }
    }
  }, [selectedServerId, activeTab])

  return (
    <div className="mobile-page mobile-page-enter">
      <div className="mobile-page-header">
        <h1 className="mobile-page-title">系统信息</h1>
        <p className="mobile-page-subtitle">查看系统信息和管理服务</p>
      </div>

      {servers.length === 0 ? (
        <div className="mobile-empty-state">
          <h3 className="mobile-empty-title">还没有添加服务器</h3>
          <p className="mobile-empty-text">请先添加服务器</p>
        </div>
      ) : (
        <>
          {/* 服务器选择器 */}
          <div className="mobile-server-selector">
            <label>选择服务器</label>
            <CustomSelect
              value={selectedServerId || ''}
              onChange={(v) => setSelectedServerId(v)}
              options={servers.map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>

          {/* Tab 切换 */}
          <div className="mobile-tabs">
            <button
              className={`mobile-tab ${activeTab === 'info' ? 'active' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              系统信息
            </button>
            <button
              className={`mobile-tab ${activeTab === 'services' ? 'active' : ''}`}
              onClick={() => setActiveTab('services')}
            >
              系统服务
            </button>
          </div>

          {activeTab === 'info' ? (
            <>
              <button
                onClick={loadSystemInfo}
                disabled={loading}
                className="mobile-button mobile-button-primary"
                style={{ width: '100%', marginBottom: 16 }}
              >
                {loading ? '刷新中…' : '刷新信息'}
              </button>

              {loading ? (
                <div className="mobile-loading">
                  <div className="mobile-spinner" />
                </div>
              ) : !systemInfo ? (
                <div className="mobile-empty-state">
                  <p style={{ color: '#64748b', margin: 0 }}>无法获取系统信息</p>
                </div>
              ) : (
                <>
                  <div className="mobile-section-header">
                    <div className="mobile-section-icon">💻</div>
                    <h2 className="mobile-section-title">基本信息</h2>
                  </div>
                  <InfoItem label="主机名" value={systemInfo.hostname} />
                  <InfoItem
                    label="操作系统"
                    value={`${systemInfo.platform} ${systemInfo.os}`}
                    subValue={systemInfo.platform_family}
                  />
                  <InfoItem label="内核版本" value={systemInfo.kernel_version} />
                  <InfoItem label="架构" value={systemInfo.arch} />

                  <div className="mobile-section-header">
                    <div className="mobile-section-icon">⚡</div>
                    <h2 className="mobile-section-title">硬件</h2>
                  </div>
                  <InfoItem
                    label="CPU"
                    value={systemInfo.cpu_model || '未知'}
                    subValue={`${systemInfo.cpu_cores} 核心`}
                  />
                  <InfoItem label="总内存" value={formatBytes(systemInfo.total_memory_bytes)} />
                  <InfoItem label="运行时间" value={formatUptime(systemInfo.uptime_seconds)} />

                  <div className="mobile-section-header">
                    <div className="mobile-section-icon">📋</div>
                    <h2 className="mobile-section-title">完整信息</h2>
                  </div>
                  <div className="mobile-card">
                    <pre
                      style={{
                        margin: 0,
                        background: 'rgba(15, 23, 42, 0.6)',
                        padding: 12,
                        borderRadius: 10,
                        color: '#e2e8f0',
                        fontSize: 11,
                        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                        lineHeight: 1.6,
                        overflow: 'auto',
                      }}
                    >
                      {JSON.stringify(systemInfo, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <button
                onClick={loadServices}
                disabled={servicesLoading}
                className="mobile-button mobile-button-secondary"
                style={{ width: '100%', marginBottom: 16 }}
              >
                {servicesLoading ? '刷新中…' : '刷新服务'}
              </button>

              {/* 搜索框 */}
              <div style={{ marginBottom: 16 }}>
                <input
                  type="search"
                  value={serviceSearchQuery}
                  onChange={(e) => setServiceSearchQuery(e.target.value)}
                  placeholder="搜索服务…"
                  className="mobile-input"
                  autoComplete="off"
                />
                {serviceSearchQuery.trim() !== '' && (
                  <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 12 }}>
                    匹配 {filteredServices.length} / {services.length} 条
                  </p>
                )}
              </div>

              {servicesLoading ? (
                <div className="mobile-loading">
                  <div className="mobile-spinner" />
                </div>
              ) : services.length === 0 ? (
                <div className="mobile-empty-state">
                  <p style={{ color: '#64748b', margin: 0 }}>无法获取服务列表或无服务</p>
                </div>
              ) : filteredServices.length === 0 ? (
                <div className="mobile-empty-state">
                  <p style={{ color: '#64748b', margin: 0 }}>没有匹配的服务，请调整关键词</p>
                </div>
              ) : (
                filteredServices.map((service) => (
                  <ServiceItem
                    key={service.name}
                    service={service}
                    onAction={handleServiceAction}
                  />
                ))
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
