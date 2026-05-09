import { useState } from 'react'
import { useServersStore } from '@/store/servers'

export function Dockge() {
  const { servers } = useServersStore()
  const [selectedId, setSelectedId] = useState<string | null>(servers[0]?.id ?? null)
  const selected = servers.find((s) => s.id === selectedId)
  const dockgeUrl = selected?.dockgeUrl?.trim() || (selected ? `http://${selected.host}:9001` : '')

  return (
    <div className="page-container" style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', padding: 'var(--space-lg)' }}>
      <h1 className="page-title" style={{ marginTop: 0, marginBottom: 12 }}>Dockge（应用内嵌）</h1>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        {servers.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelectedId(s.id)}
            className={`btn ${selectedId === s.id ? 'btn-primary' : 'btn-secondary'}`}
          >
            {s.name}
          </button>
        ))}
      </div>
      {selected && dockgeUrl ? (
        <div
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            border: '1px solid var(--color-hairline)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <iframe
            src={dockgeUrl}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            title="Dockge"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      ) : (
        <p style={{ color: 'var(--color-ink-subtle)' }}>请先选择服务器，并确保该服务器已配置 Dockge 地址（默认 :9001）。</p>
      )}
    </div>
  )
}
