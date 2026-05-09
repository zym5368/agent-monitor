import { useState, useEffect, useRef, useMemo } from 'react'
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
  if (s === 'running') return 'var(--color-success)'
  if (s === 'exited') return 'var(--color-ink-subtle)'
  if (s === 'paused') return 'var(--color-warning)'
  return 'var(--color-ink-muted)'
}

function CustomSelect({
  value,
  options,
  onChange,
  style,
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
  style?: React.CSSProperties
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
    <div ref={rootRef} style={{ position: 'relative', ...style }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="select"
        style={{
          paddingRight: 40,
          textAlign: 'left',
          cursor: 'pointer',
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
          color: 'var(--color-ink-subtle)',
          pointerEvents: 'none',
          transition: 'transform 0.18s ease',
          fontSize: 12,
        }}
      >
        ▼
      </span>
      {open && (
        <div
          className="custom-select-dropdown open"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            zIndex: 1200,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-hairline)',
            background: 'var(--color-surface-1)',
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
                padding: '10px 12px',
                lineHeight: 1.4,
                fontSize: 14,
                color: 'var(--color-ink)',
                background: opt.value === value ? 'rgba(94, 106, 210, 0.3)' : 'transparent',
                cursor: 'pointer',
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
  const stateColor = getStateColor(container.state)

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: stateColor,
              display: 'inline-block',
            }} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--color-ink)' }}>
              {container.name}
            </h3>
            <span style={{
              fontSize: 11,
              padding: '3px 8px',
              borderRadius: 20,
              background: stateColor + '20',
              color: stateColor,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              {container.state}
            </span>
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--color-ink-subtle)', fontSize: 13 }}>
            {container.image}
          </p>
          <p style={{
            margin: '6px 0 0',
            color: container.ports.length > 0 ? 'var(--color-ink-tertiary)' : 'transparent',
            fontSize: 12,
            minHeight: 18,
          }}>
            {container.ports.length > 0 ? `端口: ${container.ports.join(', ')}` : '端口: -'}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        {!isRunning && (
          <button
            onClick={() => handleAction('start', container.id)}
            disabled={loading !== null}
            className="btn btn-success"
          >
            {loading === 'start' ? '启动中...' : '启动'}
          </button>
        )}
        {isRunning && (
          <button
            onClick={() => handleAction('stop', container.id)}
            disabled={loading !== null}
            className="btn btn-danger"
          >
            {loading === 'stop' ? '停止中...' : '停止'}
          </button>
        )}
        <button
          onClick={() => handleAction('restart', container.id)}
          disabled={loading !== null}
          className="btn btn-secondary"
        >
          {loading === 'restart' ? '重启中...' : '重启'}
        </button>
        <button
          onClick={() => onViewLogs(container.id)}
          className="btn btn-ghost"
        >
          日志
        </button>
        <button
          onClick={() => handleAction('remove', container.id)}
          disabled={loading !== null}
          className="btn btn-ghost"
          style={{ color: 'var(--color-danger)' }}
        >
          {loading === 'remove' ? '删除中...' : '删除'}
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
  const [tail, setTail] = useState('100')

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
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 900 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 'var(--space-md)',
          borderBottom: '1px solid var(--color-hairline)',
          marginBottom: 'var(--space-md)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: 'var(--color-ink)' }}>容器日志</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ color: 'var(--color-ink-subtle)', fontSize: 13 }}>显示行数:</label>
              <CustomSelect
                value={tail}
                onChange={setTail}
                options={[
                  { value: '50', label: '50 行' },
                  { value: '100', label: '100 行' },
                  { value: '500', label: '500 行' },
                  { value: '1000', label: '1000 行' },
                  { value: 'all', label: '全部' },
                ]}
                style={{ width: 120 }}
              />
              <button
                onClick={loadLogs}
                className="btn btn-secondary"
              >
                刷新
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-ink-subtle)',
              fontSize: 24,
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <p style={{ color: 'var(--color-ink-subtle)' }}>加载中...</p>
          ) : (
            <pre style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              color: 'var(--color-ink)',
              fontSize: 12,
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              lineHeight: 1.6,
            }}>
              {logs}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

export function Containers() {
  const { servers } = useServersStore()
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null)
  const [containers, setContainers] = useState<ContainerInfo[]>([])
  const [overview, setOverview] = useState<DockerOverview | null>(null)
  const [images, setImages] = useState<DockerImageInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [imagesLoading, setImagesLoading] = useState(false)
  const [imageRemoving, setImageRemoving] = useState<string | null>(null)
  const [viewingLogsId, setViewingLogsId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'running' | 'stopped'>('all')

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
    setImageRemoving(ref)
    const ok = await removeDockerImage(selectedServer, ref, true)
    setImageRemoving(null)
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

  const imageTotalBytes = useMemo(() => images.reduce((sum, img) => sum + (img.size_bytes || 0), 0), [images])
  const containersTotal = overview?.containers_total ?? containers.length
  const runningTotal = overview?.containers_running ?? containers.filter((c) => c.state.toLowerCase() === 'running').length
  const imagesTotal = overview?.images_total ?? images.length
  const portSummary = overview?.port_summary ?? []

  return (
    <div style={{ paddingBottom: 40 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">容器管理</h1>
          <p className="page-subtitle">管理 Docker 容器</p>
        </div>
      </div>

      {servers.length === 0 ? (
        <div className="empty-state">
          <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#94a3b8' }}>还没有添加服务器</h3>
          <p style={{ margin: 0, fontSize: 14 }}>请先在「服务器」页面中添加服务器</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 200 }}>
              <label style={{ display: 'block', marginBottom: 6, color: 'var(--color-ink-subtle)', fontSize: 13 }}>选择服务器</label>
              <CustomSelect
                value={selectedServerId || ''}
                onChange={(v) => setSelectedServerId(v)}
                options={servers.map((s) => ({ value: s.id, label: s.name }))}
              />
            </div>
            <div style={{ minWidth: 150 }}>
              <label style={{ display: 'block', marginBottom: 6, color: 'var(--color-ink-subtle)', fontSize: 13 }}>筛选</label>
              <CustomSelect
                value={filter}
                onChange={(v) => setFilter(v as 'all' | 'running' | 'stopped')}
                options={[
                  { value: 'all', label: '全部容器' },
                  { value: 'running', label: '运行中' },
                  { value: 'stopped', label: '已停止' },
                ]}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={loadContainers}
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? '刷新中...' : '刷新'}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={loadImages}
                disabled={imagesLoading}
                className="btn btn-secondary"
              >
                {imagesLoading ? '镜像刷新中...' : '刷新镜像'}
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 'var(--space-sm)',
              marginBottom: 'var(--space-sm)',
            }}
          >
            <div className="card">
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-ink-subtle)' }}>容器概览</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ color: 'var(--color-ink-subtle)', fontSize: 13 }}>总数</span>
                  <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-ink)', margin: 0 }}>{containersTotal}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ color: 'var(--color-ink-subtle)', fontSize: 13 }}>运行中</span>
                  <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-ink)', margin: 0 }}>{runningTotal}</span>
                </div>
              </div>
            </div>
            <div className="card">
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-ink-subtle)' }}>镜像总数</p>
              <p style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 700, color: 'var(--color-ink)' }}>{imagesTotal}</p>
            </div>
            <div className="card">
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-ink-subtle)' }}>镜像总容量</p>
              <p style={{ margin: '6px 0 0', fontSize: 20, fontWeight: 700, color: 'var(--color-ink)' }}>{formatBytes(imageTotalBytes)}</p>
            </div>
          </div>

          <div
            className="containers-two-column-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
              gap: 10,
              marginBottom: 12,
              alignItems: 'stretch',
            }}
          >
            <div className="card" style={{ padding: 14, minHeight: 340 }}>
              <details open style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <summary style={{ color: '#f8fafc', cursor: 'pointer', fontSize: 15, fontWeight: 600 }}>
                  端口占用汇总（共 {portSummary.length} 项，点击展开）
                </summary>
                <div style={{ marginTop: 8, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  {portSummary.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: 13 }}>无端口占用数据</div>
                  ) : (
                    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', maxHeight: 260 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ color: '#94a3b8', borderBottom: '1px solid rgba(71, 85, 105, 0.35)' }}>
                            <th style={{ textAlign: 'left', padding: '8px 6px' }}>端口</th>
                            <th style={{ textAlign: 'left', padding: '8px 6px' }}>占用数量</th>
                            <th style={{ textAlign: 'left', padding: '8px 6px' }}>占用容器</th>
                          </tr>
                        </thead>
                        <tbody>
                          {portSummary.map((p) => (
                            <tr key={p.port} style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.2)' }}>
                              <td style={{ padding: '8px 6px', color: '#e2e8f0' }}>{p.port}</td>
                              <td style={{ padding: '8px 6px', color: '#cbd5e1' }}>{p.used}</td>
                              <td style={{ padding: '8px 6px', color: '#cbd5e1' }}>
                                {p.container_names?.length ? p.container_names.join(', ') : '未知'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </details>
            </div>

            <div className="card" style={{ padding: 14, minHeight: 340 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 16 }}>镜像管理</h3>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>共 {images.length} 个镜像</span>
              </div>
              {imagesLoading ? (
                <div style={{ color: '#64748b', fontSize: 13 }}>镜像加载中...</div>
              ) : images.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: 13 }}>暂无镜像</div>
              ) : (
                <div style={{ flex: 1, minHeight: 0, overflow: 'auto', maxHeight: 260 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: '#94a3b8', borderBottom: '1px solid rgba(71, 85, 105, 0.35)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 6px' }}>镜像</th>
                        <th style={{ textAlign: 'left', padding: '8px 6px' }}>大小</th>
                        <th style={{ textAlign: 'left', padding: '8px 6px' }}>使用中的容器</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px' }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {images.map((img) => {
                        const ref = img.repo_tags?.[0] && img.repo_tags[0] !== '<none>:<none>' ? img.repo_tags[0] : img.id
                        return (
                          <tr key={`${img.id}-${ref}`} style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.2)' }}>
                            <td style={{ padding: '8px 6px', color: '#e2e8f0', maxWidth: 360, wordBreak: 'break-all' }}>{ref}</td>
                            <td style={{ padding: '8px 6px', color: '#cbd5e1' }}>{formatBytes(img.size_bytes)}</td>
                            <td style={{ padding: '8px 6px', color: '#cbd5e1', maxWidth: 260, wordBreak: 'break-all' }}>
                              {img.container_names?.length ? img.container_names.join(', ') : '无容器使用'}
                            </td>
                            <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                              <button
                                onClick={() => handleRemoveImage(ref)}
                                disabled={imageRemoving === ref}
                                className="btn btn-danger"
                                style={{ fontSize: 12, padding: '4px 10px' }}
                              >
                                {imageRemoving === ref ? '删除中...' : '删除镜像'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              加载中...
            </div>
          ) : filteredContainers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              暂无容器
            </div>
          ) : (
            <div
              className="containers-cards-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                gap: 16,
              }}>
              {filteredContainers.map((container) => (
                <ContainerCard
                  key={container.id}
                  container={container}
                  server={selectedServer!}
                  onRefresh={loadContainers}
                  onViewLogs={setViewingLogsId}
                />
              ))}
            </div>
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
  if (n >= 1099511627776) return (n / 1099511627776).toFixed(2) + ' TB'
  if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' GB'
  if (n >= 1048576) return (n / 1048576).toFixed(2) + ' MB'
  if (n >= 1024) return (n / 1024).toFixed(2) + ' KB'
  return `${n} B`
}
