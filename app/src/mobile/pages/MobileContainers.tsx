import { useState, useEffect, useMemo } from 'react'
import { useServersStore } from '@/store/servers'
import {
  fetchContainers,
  fetchDockerOverview,
  fetchImages,
  startContainer,
  stopContainer,
  restartContainer,
  removeContainer,
  removeImage as removeDockerImage,
  fetchContainerLogs,
} from '@/api/client'
import type { Server, ContainerInfo, DockerOverview, DockerImageInfo } from '@/shared/types'

function getStateColor(state: string): string {
  const s = state.toLowerCase()
  if (s === 'running') return '#22c55e'
  if (s === 'exited') return '#64748b'
  if (s === 'paused') return '#f59e0b'
  return '#94a3b8'
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

function ContainerCard({
  container,
  server,
  onRefresh,
  onViewLogs,
}: {
  container: ContainerInfo
  server: Server
  onRefresh: () => void
  onViewLogs: (id: string) => void
}) {
  const [loading, setLoading] = useState<string | null>(null)

  const handleAction = async (action: string, id: string) => {
    setLoading(action)
    let success = false
    switch (action) {
      case 'start':
        success = await startContainer(server, id)
        break
      case 'stop':
        success = await stopContainer(server, id)
        break
      case 'restart':
        success = await restartContainer(server, id)
        break
      case 'remove':
        if (confirm('确定要删除这个容器吗？')) {
          success = await removeContainer(server, id, true)
        }
        break
    }
    setLoading(null)
    if (success) onRefresh()
  }

  const isRunning = container.state.toLowerCase() === 'running'

  return (
    <div className="mobile-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: getStateColor(container.state),
                flexShrink: 0,
              }}
            />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#f8fafc' }}>
              {container.name}
            </h3>
            <span
              style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 20,
                background: getStateColor(container.state) + '20',
                color: getStateColor(container.state),
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {container.state}
            </span>
          </div>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 12 }}>
            {container.image}
          </p>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 11, lineHeight: 1.45 }}>
            {container.ports.length > 0 ? (
              <>端口映射: {container.ports.join(' · ')}</>
            ) : (
              <span style={{ color: '#475569' }}>端口: 无映射</span>
            )}
          </p>
        </div>
      </div>
      <div className="mobile-action-row">
        {!isRunning && (
          <button
            onClick={() => handleAction('start', container.id)}
            disabled={loading !== null}
            className="mobile-action-button"
            style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }}
          >
            {loading === 'start' ? '…' : '启动'}
          </button>
        )}
        {isRunning && (
          <button
            onClick={() => handleAction('stop', container.id)}
            disabled={loading !== null}
            className="mobile-action-button"
            style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5' }}
          >
            {loading === 'stop' ? '…' : '停止'}
          </button>
        )}
        <button
          onClick={() => handleAction('restart', container.id)}
          disabled={loading !== null}
          className="mobile-action-button"
          style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc' }}
        >
          {loading === 'restart' ? '…' : '重启'}
        </button>
        <button
          onClick={() => onViewLogs(container.id)}
          className="mobile-action-button"
          style={{ background: 'rgba(71, 85, 105, 0.3)', color: '#cbd5e1' }}
        >
          日志
        </button>
        <button
          onClick={() => handleAction('remove', container.id)}
          disabled={loading !== null}
          className="mobile-action-button"
          style={{ background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5' }}
        >
          {loading === 'remove' ? '…' : '删除'}
        </button>
      </div>
    </div>
  )
}

function LogsViewer({
  server,
  containerId,
  onClose,
}: {
  server: Server
  containerId: string
  onClose: () => void
}) {
  const [logs, setLogs] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [tail, setTail] = useState<'50' | '100' | '500'>('100')

  useEffect(() => {
    loadLogs()
  }, [tail])

  const loadLogs = async () => {
    setLoading(true)
    const data = await fetchContainerLogs(server, containerId, tail)
    setLogs(data || '暂无日志')
    setLoading(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 16px',
          paddingTop: `calc(16px + env(safe-area-inset-top, 0px))`,
          borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
          background: '#1e293b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 17, color: '#f8fafc' }}>容器日志</h2>
          <select
            value={tail}
            onChange={(e) => setTail(e.target.value as '50' | '100' | '500')}
            style={{ padding: '8px 12px', borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#f8fafc' }}
          >
            <option value="50">50 行</option>
            <option value="100">100 行</option>
            <option value="500">500 行</option>
          </select>
          <button
            onClick={loadLogs}
            style={{ padding: '8px 12px', borderRadius: 8, background: '#334155', border: '1px solid #475569', color: '#cbd5e1', minHeight: 40 }}
          >
            刷新
          </button>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            fontSize: 28,
            cursor: 'pointer',
            lineHeight: 1,
            minWidth: 44,
            minHeight: 44,
          }}
        >
          ×
        </button>
      </div>
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 16,
          background: '#0f172a',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {loading ? (
          <div className="mobile-loading">
            <div className="mobile-spinner" />
          </div>
        ) : (
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              color: '#e2e8f0',
              fontSize: 12,
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              lineHeight: 1.6,
            }}
          >
            {logs}
          </pre>
        )}
      </div>
    </div>
  )
}

export function MobileContainers() {
  const { servers } = useServersStore()
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null)
  const [containers, setContainers] = useState<ContainerInfo[]>([])
  const [overview, setOverview] = useState<DockerOverview | null>(null)
  const [images, setImages] = useState<DockerImageInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [imagesLoading, setImagesLoading] = useState(false)
  const [viewingLogsId, setViewingLogsId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'running' | 'stopped'>('all')
  const [showImages, setShowImages] = useState(false)

  const selectedServer = servers.find((s) => s.id === selectedServerId)

  const loadContainers = async () => {
    if (!selectedServer) return
    setLoading(true)
    const [containerData, overviewData] = await Promise.all([
      fetchContainers(selectedServer),
      fetchDockerOverview(selectedServer),
    ])
    setContainers(containerData || [])
    setOverview(overviewData)
    setLoading(false)
  }

  const loadImages = async () => {
    if (!selectedServer) return
    setImagesLoading(true)
    const data = await fetchImages(selectedServer)
    setImages(data || [])
    setImagesLoading(false)
  }

  const handleRemoveImage = async (ref: string) => {
    if (!selectedServer) return
    if (!confirm(`确定要删除镜像 ${ref} 吗？`)) return
    const ok = await removeDockerImage(selectedServer, ref, true)
    if (ok) {
      await Promise.all([loadImages(), loadContainers()])
    } else {
      alert('删除镜像失败，请检查该镜像是否被容器占用。')
    }
  }

  useEffect(() => {
    if (servers.length > 0 && !selectedServerId) {
      setSelectedServerId(servers[0].id)
    }
  }, [servers])

  useEffect(() => {
    if (selectedServer) {
      loadContainers()
      loadImages()
    }
  }, [selectedServerId])

  const filteredContainers = containers.filter((c) => {
    if (filter === 'all') return true
    if (filter === 'running') return c.state.toLowerCase() === 'running'
    if (filter === 'stopped') return c.state.toLowerCase() !== 'running'
    return true
  })

  const containersTotal = overview?.containers_total ?? containers.length
  const runningTotal = overview?.containers_running ?? containers.filter((c) => c.state.toLowerCase() === 'running').length
  const imagesTotal = overview?.images_total ?? images.length
  const portSummary = overview?.port_summary ?? []
  const imageTotalBytes = useMemo(
    () => images.reduce((sum, img) => sum + (img.size_bytes || 0), 0),
    [images]
  )

  return (
    <div className="mobile-page mobile-page-enter">
      <div className="mobile-page-header">
        <h1 className="mobile-page-title">容器管理</h1>
        <p className="mobile-page-subtitle">管理 Docker 容器</p>
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

          {/* 过滤器 */}
          <div className="mobile-tabs" style={{ marginBottom: 12 }}>
            <button
              className={`mobile-tab ${!showImages ? 'active' : ''}`}
              onClick={() => setShowImages(false)}
            >
              容器
            </button>
            <button
              className={`mobile-tab ${showImages ? 'active' : ''}`}
              onClick={() => setShowImages(true)}
            >
              镜像 ({imagesTotal})
            </button>
          </div>

          {!showImages ? (
            <>
              {/* 概览：与桌面端一致的端口占用汇总 */}
              <div
                className="mobile-card"
                style={{ marginBottom: 12, padding: '12px 14px' }}
              >
                <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>端口占用汇总</p>
                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#64748b' }}>
                  共 {portSummary.length} 个宿主机端口有映射
                </p>
                {portSummary.length === 0 ? (
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: '#475569' }}>暂无端口映射数据</p>
                ) : (
                  <div
                    style={{
                      marginTop: 10,
                      maxHeight: 200,
                      overflow: 'auto',
                      borderTop: '1px solid rgba(71, 85, 105, 0.35)',
                      paddingTop: 8,
                    }}
                  >
                    {portSummary.map((p) => (
                      <div
                        key={p.port}
                        style={{
                          padding: '8px 0',
                          borderBottom: '1px solid rgba(51, 65, 85, 0.5)',
                          fontSize: 12,
                        }}
                      >
                        <div style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: 4 }}>{p.port}</div>
                        <div style={{ color: '#94a3b8', fontSize: 11 }}>
                          占用 {p.used} 个容器
                        </div>
                        <div style={{ color: '#cbd5e1', fontSize: 11, marginTop: 4, wordBreak: 'break-word' }}>
                          {p.container_names?.length
                            ? p.container_names.join('、')
                            : '容器名未知'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 容器过滤器 */}
              <div className="mobile-tabs">
                <button
                  className={`mobile-tab ${filter === 'all' ? 'active' : ''}`}
                  onClick={() => setFilter('all')}
                >
                  全部 ({containersTotal})
                </button>
                <button
                  className={`mobile-tab ${filter === 'running' ? 'active' : ''}`}
                  onClick={() => setFilter('running')}
                >
                  运行中 ({runningTotal})
                </button>
                <button
                  className={`mobile-tab ${filter === 'stopped' ? 'active' : ''}`}
                  onClick={() => setFilter('stopped')}
                >
                  已停止
                </button>
              </div>

              {/* 刷新按钮 */}
              <button
                onClick={loadContainers}
                disabled={loading}
                className="mobile-button mobile-button-primary"
                style={{ width: '100%', marginBottom: 16 }}
              >
                {loading ? '刷新中…' : '刷新容器'}
              </button>

              {/* 容器列表 */}
              {loading ? (
                <div className="mobile-loading">
                  <div className="mobile-spinner" />
                </div>
              ) : filteredContainers.length === 0 ? (
                <div className="mobile-empty-state">
                  <p style={{ color: '#64748b', margin: 0 }}>暂无容器</p>
                </div>
              ) : (
                filteredContainers.map((container) => (
                  <ContainerCard
                    key={container.id}
                    container={container}
                    server={selectedServer!}
                    onRefresh={loadContainers}
                    onViewLogs={setViewingLogsId}
                  />
                ))
              )}
            </>
          ) : (
            <>
              {/* 镜像统计 */}
              <div
                className="mobile-card"
                style={{ marginBottom: 12, padding: '12px 14px' }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 20px', alignItems: 'baseline' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>镜像数量</p>
                    <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, color: '#f8fafc' }}>{imagesTotal}</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>镜像总空间</p>
                    <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: '#38bdf8' }}>
                      {formatBytes(imageTotalBytes)}
                    </p>
                  </div>
                </div>
                <p style={{ margin: '10px 0 0', fontSize: 11, color: '#64748b' }}>
                  下列为每个镜像占用空间及正在使用该镜像的容器
                </p>
              </div>

              <button
                onClick={loadImages}
                disabled={imagesLoading}
                className="mobile-button mobile-button-secondary"
                style={{ width: '100%', marginBottom: 16 }}
              >
                {imagesLoading ? '刷新中…' : '刷新镜像'}
              </button>

              {imagesLoading ? (
                <div className="mobile-loading">
                  <div className="mobile-spinner" />
                </div>
              ) : images.length === 0 ? (
                <div className="mobile-empty-state">
                  <p style={{ color: '#64748b', margin: 0 }}>暂无镜像</p>
                </div>
              ) : (
                images.map((img) => {
                  const ref = img.repo_tags?.[0] && img.repo_tags[0] !== '<none>:<none>' ? img.repo_tags[0] : img.id
                  const nContainers = img.containers ?? (img.container_names?.length ?? 0)
                  const names = img.container_names ?? []
                  return (
                    <div key={`${img.id}-${ref}`} className="mobile-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#f8fafc', wordBreak: 'break-all' }}>
                            {ref}
                          </h3>
                          <p style={{ margin: '6px 0 0', color: '#cbd5e1', fontSize: 12 }}>
                            <span style={{ color: '#94a3b8' }}>占用空间 </span>
                            <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{formatBytes(img.size_bytes)}</span>
                          </p>
                          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 11 }}>
                            占用容器：<span style={{ color: '#f8fafc', fontWeight: 600 }}>{nContainers}</span> 个
                          </p>
                          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 11, wordBreak: 'break-word', lineHeight: 1.45 }}>
                            {names.length > 0 ? (
                              <>容器名：{names.join('、')}</>
                            ) : (
                              <span style={{ color: '#475569' }}>无运行中容器使用该镜像（或名称未上报）</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveImage(ref)}
                        className="mobile-button mobile-button-danger"
                        style={{ width: '100%', padding: '8px 16px', minHeight: 40, fontSize: 13 }}
                      >
                        删除镜像
                      </button>
                    </div>
                  )
                })
              )}
            </>
          )}
        </>
      )}

      {viewingLogsId && selectedServer && (
        <LogsViewer
          server={selectedServer}
          containerId={viewingLogsId}
          onClose={() => setViewingLogsId(null)}
        />
      )}
    </div>
  )
}

function formatBytes(n: number): string {
  if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' GB'
  if (n >= 1048576) return (n / 1048576).toFixed(2) + ' MB'
  if (n >= 1024) return (n / 1024).toFixed(2) + ' KB'
  return `${n} B`
}
