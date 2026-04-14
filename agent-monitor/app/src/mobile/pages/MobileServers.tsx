import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useServersStore } from '@/store/servers'
import type { DataSource } from '@/shared/types'

function normalizeDockgeUrl(raw: string, fallbackHost: string): string {
  const value = raw.trim()
  if (!value) return `http://${fallbackHost}:9001`
  if (/^https?:\/\//i.test(value)) return value.replace(/\/$/, '')
  return `http://${value.replace(/\/$/, '')}`
}

export function MobileServers() {
  const navigate = useNavigate()
  const { servers, add, remove } = useServersStore()
  const [name, setName] = useState('')
  const [dataSource, setDataSource] = useState<DataSource>('agent')
  const [host, setHost] = useState('localhost')
  const [port, setPort] = useState(9100)
  const [netdataUrl, setNetdataUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [dockgeUrl, setDockgeUrl] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  const handleAdd = () => {
    if (!name.trim()) return
    if (dataSource === 'netdata') {
      if (!netdataUrl.trim()) return
      const url = netdataUrl.trim().replace(/\/$/, '')
      let displayHost = host.trim()
      try {
        if (!displayHost) displayHost = new URL(url).hostname
      } catch {
        displayHost = displayHost || 'localhost'
      }
      add({
        name: name.trim(),
        dataSource: 'netdata',
        host: displayHost,
        port: 19999,
        apiKey: apiKey.trim(),
        netdataUrl: url,
        dockgeUrl: normalizeDockgeUrl(dockgeUrl, displayHost),
      })
      setNetdataUrl('')
      setHost('')
    } else {
      if (!host.trim()) return
      add({
        name: name.trim(),
        dataSource: 'agent',
        host: host.trim(),
        port: Number(port) || 9100,
        apiKey: apiKey.trim(),
        dockgeUrl: normalizeDockgeUrl(dockgeUrl, host.trim()),
      })
      setHost('')
      setPort(9100)
    }
    setName('')
    setApiKey('')
    setDockgeUrl('')
    setShowAddForm(false)
  }

  return (
    <div className="mobile-page mobile-page-enter">
      <div className="mobile-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="mobile-page-title">服务器管理</h1>
          <p className="mobile-page-subtitle">管理您的服务器列表</p>
        </div>
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

      {/* 添加服务器按钮 / 表单 */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="mobile-button mobile-button-primary"
          style={{ width: '100%', marginBottom: 16 }}
        >
          + 添加服务器
        </button>
      ) : (
        <div className="mobile-card" style={{ marginBottom: 16 }}>
          <div className="mobile-card-header">
            <h3 className="mobile-card-title">添加服务器</h3>
            <button
              onClick={() => setShowAddForm(false)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              placeholder="名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mobile-input"
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: '#94a3b8' }}>数据源：</span>
              <select
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value as DataSource)}
                className="mobile-select"
                style={{ flex: 1 }}
              >
                <option value="netdata">Netdata API</option>
                <option value="agent">自建 Agent</option>
              </select>
            </div>

            {dataSource === 'netdata' ? (
              <input
                placeholder="Netdata 地址（如 http://192.168.1.10:19999）"
                value={netdataUrl}
                onChange={(e) => setNetdataUrl(e.target.value)}
                className="mobile-input"
              />
            ) : (
              <>
                <input
                  placeholder="Host（IP 或域名）"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="mobile-input"
                />
                <input
                  type="number"
                  placeholder="Agent 端口"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value) || 9100)}
                  className="mobile-input"
                />
              </>
            )}

            {dataSource === 'netdata' && (
              <input
                placeholder="显示用 Host（可选）"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="mobile-input"
              />
            )}

            <input
              placeholder="API Key（可选）"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mobile-input"
            />

            <input
              placeholder="Dockge 地址（可选，支持仅填 IP，默认 http://host:9001）"
              value={dockgeUrl}
              onChange={(e) => setDockgeUrl(e.target.value)}
              className="mobile-input"
            />

            <button
              type="button"
              onClick={handleAdd}
              className="mobile-button mobile-button-primary"
              style={{ width: '100%' }}
            >
              添加
            </button>
          </div>
        </div>
      )}

      {/* 服务器列表 */}
      {servers.length === 0 ? (
        <div className="mobile-empty-state">
          <h3 className="mobile-empty-title">暂无服务器</h3>
          <p className="mobile-empty-text">点击上方按钮添加您的第一个服务器</p>
        </div>
      ) : (
        servers.map((s) => (
          <div key={s.id} className="mobile-card">
            <div className="mobile-card-header">
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{s.name}</h3>
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: (s.dataSource ?? 'agent') === 'netdata' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                      color: (s.dataSource ?? 'agent') === 'netdata' ? '#a78bfa' : '#4ade80',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {(s.dataSource ?? 'agent') === 'netdata' ? 'Netdata' : '自建 Agent'}
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: 13 }}>
                    {(s.dataSource ?? 'agent') === 'netdata' && s.netdataUrl
                      ? s.netdataUrl
                      : `${s.host}:${s.port}`
                    }
                  </span>
                </div>
                {s.dockgeUrl && (
                  <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 12 }}>
                    Dockge: {s.dockgeUrl}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => remove(s.id)}
              className="mobile-button mobile-button-danger"
              style={{ width: '100%', padding: '10px 16px', minHeight: 40 }}
            >
              删除
            </button>
          </div>
        ))
      )}
    </div>
  )
}
