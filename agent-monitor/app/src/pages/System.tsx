import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { useServersStore } from '@/store/servers'
import {
  fetchSystemInfo,
  fetchServices,
  startService,
  stopService,
  restartService,
  enableService,
  disableService,
  updateServiceSubscriptionDetailed,
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

function hasHan(s: string): boolean {
  return /[\u3400-\u9fff]/.test(s)
}

// 兜底修复：将 "å¥½å..." 这类 UTF-8 被当单字节字符读入后的乱码恢复为正常中文。
function recoverMojibakeUTF8Latin1(s: string): string {
  if (!s) return s
  try {
    const bytes = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i += 1) {
      const code = s.charCodeAt(i)
      if (code > 0xff) return s
      bytes[i] = code
    }
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (hasHan(decoded) && !hasHan(s)) return decoded
  } catch {
    // ignore decode failures
  }
  return s
}

/** 选择服务器 / 搜索 外层槽位 */
const toolbarLeftSlot: CSSProperties = {
  flex: '0 0 10%',
  minWidth: 110,
  maxWidth: '100%',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
}

/** 剩余约 60%：Tab + 刷新靠左并排，刷新贴右 */
const toolbarRightSlot: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 12,
  justifyContent: 'flex-start',
}

/** 区块小标题「选择服务器」 */
const sectionHeadingStyle: CSSProperties = {
  display: 'block',
  marginBottom: 16,
  color: '#94a3b8',
  fontSize: 18,
  fontWeight: 500,
}

/** 「搜索服务」标签 */
const searchSectionHeadingStyle: CSSProperties = {
  ...sectionHeadingStyle,
  fontWeight: 'bold',
}

const controlFieldBorder = 'rgba(71, 85, 105, 0.75)'

/** 控件占满左侧槽位 */
const narrowFieldWidth = '100%'

/** 搜索框（与 select 字号协调） */
const narrowFieldBase: CSSProperties = {
  boxSizing: 'border-box',
  width: narrowFieldWidth,
  maxWidth: '100%',
  padding: '10px 14px',
  lineHeight: 1.25,
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  border: `1px solid ${controlFieldBorder}`,
  borderRadius: 10,
  color: '#f8fafc',
  fontSize: 16,
  outline: 'none',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
}

const selectChevronDataUrl =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  )

/** 自定义箭头，避免系统下拉右侧留白导致与输入框文字左缘不一致 */
const serverSelectFieldStyle: CSSProperties = {
  ...narrowFieldBase,
  cursor: 'pointer',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  appearance: 'none',
  paddingRight: 40,
  backgroundImage: `url("${selectChevronDataUrl}")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  backgroundSize: '14px 14px',
}

const searchFieldStyle: CSSProperties = {
  ...narrowFieldBase,
}

function applyControlFocus(el: HTMLInputElement | HTMLSelectElement) {
  el.style.borderColor = 'rgba(129, 140, 248, 0.85)'
  el.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.22)'
}

function clearControlFocus(el: HTMLInputElement | HTMLSelectElement) {
  el.style.borderColor = controlFieldBorder
  el.style.boxShadow = 'none'
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
  const rootRef = useRef<HTMLDivElement | null>(null)
  const selectedLabel = options.find((opt) => opt.value === value)?.label ?? value

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          ...serverSelectFieldStyle,
          width: '100%',
          textAlign: 'left',
          backgroundImage: 'none',
        }}
      >
        {selectedLabel}
      </button>
      <span
        style={{
          position: 'absolute',
          right: 12,
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
      {/* 始终渲染下拉菜单，用 CSS 控制显示/隐藏，以实现过渡动画 */}
      <div
        className={`custom-select-dropdown ${open ? 'open' : ''}`}
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
            className="custom-select-option"
            onClick={() => {
              onChange(opt.value)
              setOpen(false)
            }}
            style={{
              width: '100%',
              border: 'none',
              textAlign: 'left',
              padding: '10px 12px',
              lineHeight: 1.4,
              fontSize: 14,
              color: '#f8fafc',
              background: opt.value === value ? 'rgba(59, 130, 246, 0.55)' : 'transparent',
              cursor: 'pointer',
              transition: 'background-color var(--transition-fast)',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function InfoCard({
  icon,
  label,
  value,
  subValue,
}: {
  icon: string
  label: string
  value: string
  subValue?: string
}) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
      borderRadius: 12,
      padding: 18,
      border: '1px solid rgba(71, 85, 105, 0.4)',
      backdropFilter: 'blur(20px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'rgba(99, 102, 241, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
        }}>
          {icon}
        </div>
        <div>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {label}
          </p>
          <p style={{ margin: '2px 0 0', color: '#f8fafc', fontSize: 16, fontWeight: 600 }}>
            {value}
          </p>
        </div>
      </div>
      {subValue && (
        <p style={{ margin: 0, color: '#64748b', fontSize: 12 }}>
          {subValue}
        </p>
      )}
    </div>
  )
}

export function System() {
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
    action: 'start' | 'stop' | 'restart' | 'enable' | 'disable' | 'update-subscription',
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
      case 'update-subscription':
        {
          const detail = await updateServiceSubscriptionDetailed(selectedServer, name)
          success = Boolean(detail?.success)
          const statusText = detail?.status ? `状态：${detail.status}` : '状态：unknown'
          const scriptText = detail?.script ? `脚本：${detail.script}` : ''
          const logFileText = detail?.log_file ? `日志文件：${detail.log_file}` : ''
          const logText = detail?.log_excerpt ? `日志片段：\n${detail.log_excerpt}` : ''
          const outputText = detail?.output ? `输出：\n${detail.output}` : ''
          const errText = detail?.error ? `错误：${detail.error}` : ''
          const pieces = [statusText, scriptText, logFileText, outputText, logText, errText].filter(Boolean)
          window.alert(`订阅更新${success ? '成功' : '失败'}（${name}）\n\n${pieces.join('\n\n')}`)
        }
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

  const canUpdateSubscription = (name: string) =>
    name === 'passwall' || name === 'passwall2' || name === 'shadowsocksr'

  return (
    <div className="system-page" style={{ paddingBottom: 40 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        paddingBottom: 20,
        borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
      }}>
        <div>
          <h1 style={{
            margin: '0 0 16px 0',
            fontSize: 34,
            fontWeight: 700,
            background: 'linear-gradient(135deg, #f8fafc, #94a3b8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            系统管理
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
            查看系统信息和管理系统服务
          </p>
        </div>
      </div>

      {servers.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '80px 20px',
          color: '#64748b',
        }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#94a3b8' }}>还没有添加服务器</h3>
          <p style={{ margin: 0, fontSize: 14 }}>请先在「服务器」页面中添加服务器</p>
        </div>
      ) : (
        <>
          <div
            className="system-toolbar"
            style={{
              display: 'flex',
              gap: 12,
              marginBottom: activeTab === 'services' ? 14 : 24,
              flexWrap: 'wrap',
              flexDirection: 'column',
              alignItems: 'stretch',
              width: '100%',
            }}
          >
            <div style={toolbarLeftSlot}>
              <label style={sectionHeadingStyle}>选择服务器</label>
              <CustomSelect
                value={selectedServerId || ''}
                onChange={(v) => setSelectedServerId(v)}
                options={servers.map((s) => ({ value: s.id, label: s.name }))}
              />
            </div>
            <div style={toolbarRightSlot}>
              <div style={{ display: 'flex', gap: 8, background: 'rgba(15, 23, 42, 0.6)', padding: 0, borderRadius: 10 }}>
                <button
                  onClick={() => setActiveTab('info')}
                  style={{
                    padding: '8px 16px',
                    background: activeTab === 'info' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 16,
                    fontWeight: 500,
                  }}
                >
                  系统信息
                </button>
                <button
                  onClick={() => setActiveTab('services')}
                  style={{
                    padding: '8px 16px',
                    background: activeTab === 'services' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 16,
                    fontWeight: 500,
                  }}
                >
                  系统服务
                </button>
              </div>
              <button
                onClick={activeTab === 'info' ? loadSystemInfo : loadServices}
                disabled={loading || servicesLoading}
                style={{
                  marginLeft: 'auto',
                  padding: '10px 18px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none',
                  borderRadius: 10,
                  color: '#fff',
                  cursor: (loading || servicesLoading) ? 'wait' : 'pointer',
                  fontSize: 16,
                  fontWeight: 600,
                  opacity: (loading || servicesLoading) ? 0.7 : 1,
                }}
              >
                {loading || servicesLoading ? '刷新中...' : '刷新'}
              </button>
            </div>
          </div>

          {activeTab === 'info' ? (
            <>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '80px 20px', color: '#64748b' }}>
                  加载中...
                </div>
              ) : !systemInfo ? (
                <div style={{ textAlign: 'center', padding: '80px 20px', color: '#64748b' }}>
                  无法获取系统信息
                </div>
              ) : (
                <>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 16,
                    marginBottom: 24,
                  }}>
                    <InfoCard
                      icon="💻"
                      label="主机名"
                      value={systemInfo.hostname}
                    />
                    <InfoCard
                      icon="🖥️"
                      label="操作系统"
                      value={`${systemInfo.platform} ${systemInfo.os}`}
                      subValue={systemInfo.platform_family}
                    />
                    <InfoCard
                      icon="🔧"
                      label="内核版本"
                      value={systemInfo.kernel_version}
                    />
                    <InfoCard
                      icon="📐"
                      label="架构"
                      value={systemInfo.arch}
                    />
                    <InfoCard
                      icon="⚡"
                      label="CPU"
                      value={systemInfo.cpu_model || '未知'}
                      subValue={`${systemInfo.cpu_cores} 核心`}
                    />
                    <InfoCard
                      icon="🧠"
                      label="总内存"
                      value={formatBytes(systemInfo.total_memory_bytes)}
                    />
                    <InfoCard
                      icon="⏱️"
                      label="运行时间"
                      value={formatUptime(systemInfo.uptime_seconds)}
                    />
                  </div>

                  <div style={{
                    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
                    borderRadius: 16,
                    padding: 24,
                    border: '1px solid rgba(71, 85, 105, 0.4)',
                    backdropFilter: 'blur(20px)',
                  }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#f8fafc' }}>
                      完整信息
                    </h3>
                    <pre style={{
                      margin: 0,
                      background: 'rgba(15, 23, 42, 0.6)',
                      padding: 16,
                      borderRadius: 10,
                      color: '#e2e8f0',
                      fontSize: 12,
                      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                      lineHeight: 1.6,
                      overflow: 'auto',
                    }}>
                      {JSON.stringify(systemInfo, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              {servicesLoading ? (
                <div style={{ textAlign: 'center', padding: '80px 20px', color: '#64748b' }}>
                  加载中...
                </div>
              ) : services.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 20px', color: '#64748b' }}>
                  无法获取服务列表或无服务
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 16, width: '100%' }}>
                    <div style={toolbarLeftSlot}>
                      <label htmlFor="service-search" style={searchSectionHeadingStyle}>
                        搜索服务
                      </label>
                      <input
                        id="service-search"
                        type="search"
                        value={serviceSearchQuery}
                        onChange={(e) => setServiceSearchQuery(e.target.value)}
                        placeholder="按服务名称或显示名称筛选…"
                        autoComplete="off"
                        style={searchFieldStyle}
                        onFocus={(e) => applyControlFocus(e.target)}
                        onBlur={(e) => clearControlFocus(e.target)}
                      />
                      {serviceSearchQuery.trim() !== '' && (
                        <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 12 }}>
                          匹配 {filteredServices.length} / {services.length} 条
                        </p>
                      )}
                    </div>
                  </div>
                <div
                  className="mobile-table-scroll"
                  style={{
                    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
                    borderRadius: 16,
                    border: '1px solid rgba(71, 85, 105, 0.4)',
                    backdropFilter: 'blur(20px)',
                    overflow: 'hidden',
                  }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
                        <th style={{ padding: '14px 16px', textAlign: 'left', color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>服务名称</th>
                        <th style={{ padding: '14px 16px', textAlign: 'left', color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>显示名称</th>
                        <th style={{ padding: '14px 16px', textAlign: 'left', color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>状态</th>
                        <th style={{ padding: '14px 16px', textAlign: 'left', color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>开机自启</th>
                        <th style={{ padding: '14px 16px', textAlign: 'left', color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredServices.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            style={{ padding: '48px 16px', textAlign: 'center', color: '#64748b', fontSize: 14 }}
                          >
                            没有匹配的服务，请调整关键词
                          </td>
                        </tr>
                      ) : (
                      filteredServices.map((service) => (
                        <tr key={service.name} style={{ borderTop: '1px solid rgba(71, 85, 105, 0.3)' }}>
                          <td style={{ padding: '12px 16px', color: '#f8fafc', fontFamily: 'Consolas, Monaco, monospace', fontSize: 13 }}>
                            {service.name}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#cbd5e1', fontSize: 13 }}>
                            {recoverMojibakeUTF8Latin1(service.display_name)}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: 20,
                              fontSize: 11,
                              fontWeight: 600,
                              background: service.status === 'running' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                              color: service.status === 'running' ? '#4ade80' : '#94a3b8',
                            }}>
                              {service.status === 'running' ? '运行中' : service.status === 'stopped' ? '已停止' : service.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: 20,
                              fontSize: 11,
                              fontWeight: 600,
                              background: service.enabled ? 'rgba(99, 102, 241, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                              color: service.enabled ? '#a5b4fc' : '#94a3b8',
                            }}>
                              {service.enabled ? '已启用' : '已禁用'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {service.status !== 'running' && (
                                <button
                                  onClick={() => handleServiceAction(service.name, 'start')}
                                  style={{
                                    padding: '6px 10px',
                                    background: 'rgba(34, 197, 94, 0.15)',
                                    border: '1px solid rgba(34, 197, 94, 0.3)',
                                    borderRadius: 6,
                                    color: '#4ade80',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 500,
                                  }}
                                >
                                  启动
                                </button>
                              )}
                              {service.status === 'running' && (
                                <>
                                  <button
                                    onClick={() => handleServiceAction(service.name, 'stop')}
                                    style={{
                                      padding: '6px 10px',
                                      background: 'rgba(239, 68, 68, 0.15)',
                                      border: '1px solid rgba(239, 68, 68, 0.3)',
                                      borderRadius: 6,
                                      color: '#f87171',
                                      cursor: 'pointer',
                                      fontSize: 12,
                                      fontWeight: 500,
                                    }}
                                  >
                                    停止
                                  </button>
                                  <button
                                    onClick={() => handleServiceAction(service.name, 'restart')}
                                    style={{
                                      padding: '6px 10px',
                                      background: 'rgba(245, 158, 11, 0.15)',
                                      border: '1px solid rgba(245, 158, 11, 0.3)',
                                      borderRadius: 6,
                                      color: '#fbbf24',
                                      cursor: 'pointer',
                                      fontSize: 12,
                                      fontWeight: 500,
                                    }}
                                  >
                                    重启
                                  </button>
                                </>
                              )}
                              {!service.enabled && (
                                <button
                                  onClick={() => handleServiceAction(service.name, 'enable')}
                                  style={{
                                    padding: '6px 10px',
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    border: '1px solid rgba(99, 102, 241, 0.3)',
                                    borderRadius: 6,
                                    color: '#a5b4fc',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 500,
                                  }}
                                >
                                  启用
                                </button>
                              )}
                              {service.enabled && (
                                <button
                                  onClick={() => handleServiceAction(service.name, 'disable')}
                                  style={{
                                    padding: '6px 10px',
                                    background: 'rgba(100, 116, 139, 0.15)',
                                    border: '1px solid rgba(100, 116, 139, 0.3)',
                                    borderRadius: 6,
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 500,
                                  }}
                                >
                                  禁用
                                </button>
                              )}
                              {canUpdateSubscription(service.name) && (
                                <button
                                  onClick={() => handleServiceAction(service.name, 'update-subscription')}
                                  style={{
                                    padding: '6px 10px',
                                    background: 'rgba(59, 130, 246, 0.15)',
                                    border: '1px solid rgba(59, 130, 246, 0.35)',
                                    borderRadius: 6,
                                    color: '#93c5fd',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 500,
                                  }}
                                >
                                  更新订阅
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                      )}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
