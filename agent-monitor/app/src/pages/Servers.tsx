import { useState } from 'react'
import { useServersStore } from '@/store/servers'
import type { DataSource } from '@/shared/types'

function normalizeDockgeUrl(raw: string, fallbackHost: string): string {
  const value = raw.trim()
  if (!value) return `http://${fallbackHost}:9001`
  if (/^https?:\/\//i.test(value)) return value.replace(/\/$/, '')
  return `http://${value.replace(/\/$/, '')}`
}

export function Servers() {
  const { servers, add, remove } = useServersStore()
  const [name, setName] = useState('')
  const [dataSource, setDataSource] = useState<DataSource>('agent')
  const [host, setHost] = useState('localhost')
  const [port, setPort] = useState(9100)
  const [netdataUrl, setNetdataUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [dockgeUrl, setDockgeUrl] = useState('')

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
  }

  return (
    <div className="page-container" style={{ padding: 'var(--space-lg)' }}>
      <h1 className="page-title">服务器列表</h1>

      <div className="card" style={{ marginBottom: 'var(--space-lg)', maxWidth: 480 }}>
        <h3 style={{ marginTop: 0 }}>添加服务器</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <input
            className="input"
            placeholder="名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>数据源：</span>
            <select
              className="select"
              value={dataSource}
              onChange={(e) => setDataSource((e.target.value as DataSource))}
            >
              <option value="netdata">Netdata API</option>
              <option value="agent">自建 Agent</option>
            </select>
          </label>
          {dataSource === 'netdata' ? (
            <input
              className="input"
              placeholder="Netdata 地址（如 http://192.168.1.10:19999）"
              value={netdataUrl}
              onChange={(e) => setNetdataUrl(e.target.value)}
            />
          ) : (
            <>
              <input
                className="input"
                placeholder="Host（IP 或域名）"
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
              <input
                type="number"
                className="input"
                placeholder="Agent 端口"
                value={port}
                onChange={(e) => setPort(Number(e.target.value) || 9100)}
              />
            </>
          )}
          {dataSource === 'netdata' && (
            <input
              className="input"
              placeholder="显示用 Host（可选，用于 Dockge 等）"
              value={host}
              onChange={(e) => setHost(e.target.value)}
            />
          )}
          <input
            className="input"
            placeholder="API Key（可选，仅 Agent）"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <input
            className="input"
            placeholder="Dockge 地址（可选，支持仅填 IP，默认 http://host:9001）"
            value={dockgeUrl}
            onChange={(e) => setDockgeUrl(e.target.value)}
          />
          <button
            type="button"
            onClick={handleAdd}
            className="btn btn-primary"
          >
            添加
          </button>
        </div>
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {servers.map((s) => (
          <li
            key={s.id}
            className="mobile-list-item"
          >
            <div className="mobile-list-item-main">
              <strong>{s.name}</strong>
              <div style={{ fontSize: 13, color: 'var(--color-ink-subtle)', marginTop: 4 }}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: (s.dataSource ?? 'agent') === 'netdata' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                  color: (s.dataSource ?? 'agent') === 'netdata' ? '#a78bfa' : '#4ade80',
                  marginRight: 8,
                  fontSize: 11,
                  fontWeight: 600,
                }}>
                  {(s.dataSource ?? 'agent') === 'netdata' ? 'Netdata' : '自建 Agent'}
                </span>
                {(s.dataSource ?? 'agent') === 'netdata' && s.netdataUrl
                  ? s.netdataUrl
                  : `${s.host}:${s.port}`
                }
              </div>
              {s.dockgeUrl && (
                <span style={{
                  color: 'var(--color-ink-tertiary)',
                  marginTop: 6,
                  fontSize: 12,
                  display: 'block',
                  wordBreak: 'break-all',
                }}>
                  Dockge: {s.dockgeUrl}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => remove(s.id)}
              className="btn btn-danger"
            >
              删除
            </button>
          </li>
        ))}
      </ul>
      {servers.length === 0 && <p style={{ color: 'var(--color-ink-subtle)' }}>暂无服务器。</p>}
    </div>
  )
}
