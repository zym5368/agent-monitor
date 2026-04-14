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
    <div className="servers-page">
      <h1 style={{ marginTop: 0 }}>服务器列表</h1>
      <div style={{ background: '#16213e', padding: 20, borderRadius: 8, marginBottom: 24, maxWidth: 480 }}>
        <h3 style={{ marginTop: 0 }}>添加服务器</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            placeholder="名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: 8, background: '#1a1a2e', border: '1px solid #333', color: '#eee', borderRadius: 4 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>数据源：</span>
            <select
              value={dataSource}
              onChange={(e) => setDataSource((e.target.value as DataSource))}
              style={{ padding: 6, background: '#1a1a2e', border: '1px solid #333', color: '#eee', borderRadius: 4 }}
            >
              <option value="netdata">Netdata API</option>
              <option value="agent">自建 Agent</option>
            </select>
          </label>
          {dataSource === 'netdata' ? (
            <input
              placeholder="Netdata 地址（如 http://192.168.1.10:19999）"
              value={netdataUrl}
              onChange={(e) => setNetdataUrl(e.target.value)}
              style={{ padding: 8, background: '#1a1a2e', border: '1px solid #333', color: '#eee', borderRadius: 4 }}
            />
          ) : (
            <>
              <input
                placeholder="Host（IP 或域名）"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                style={{ padding: 8, background: '#1a1a2e', border: '1px solid #333', color: '#eee', borderRadius: 4 }}
              />
              <input
                type="number"
                placeholder="Agent 端口"
                value={port}
                onChange={(e) => setPort(Number(e.target.value) || 9100)}
                style={{ padding: 8, background: '#1a1a2e', border: '1px solid #333', color: '#eee', borderRadius: 4 }}
              />
            </>
          )}
          {dataSource === 'netdata' && (
            <input
              placeholder="显示用 Host（可选，用于 Dockge 等）"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              style={{ padding: 8, background: '#1a1a2e', border: '1px solid #333', color: '#eee', borderRadius: 4 }}
            />
          )}
          <input
            placeholder="API Key（可选，仅 Agent）"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={{ padding: 8, background: '#1a1a2e', border: '1px solid #333', color: '#eee', borderRadius: 4 }}
          />
          <input
            placeholder="Dockge 地址（可选，支持仅填 IP，默认 http://host:9001）"
            value={dockgeUrl}
            onChange={(e) => setDockgeUrl(e.target.value)}
            style={{ padding: 8, background: '#1a1a2e', border: '1px solid #333', color: '#eee', borderRadius: 4 }}
          />
          <button
            type="button"
            onClick={handleAdd}
            style={{
              padding: '10px 16px',
              background: '#0f3460',
              color: '#eee',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            添加
          </button>
        </div>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {servers.map((s) => (
          <li
            key={s.id}
            className="servers-list-item"
            style={{
              background: '#16213e',
              padding: 16,
              marginBottom: 8,
              borderRadius: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexDirection: 'row',
              gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>{s.name}</strong>
              <div style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>
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
                <span
                  style={{
                    color: '#888',
                    marginTop: 6,
                    fontSize: 12,
                    display: 'block',
                    wordBreak: 'break-all',
                  }}
                >
                  Dockge: {s.dockgeUrl}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => remove(s.id)}
              style={{
                padding: '6px 12px',
                background: '#5a1a1a',
                color: '#eee',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              删除
            </button>
          </li>
        ))}
      </ul>
      {servers.length === 0 && <p style={{ color: '#888' }}>暂无服务器。</p>}
    </div>
  )
}
