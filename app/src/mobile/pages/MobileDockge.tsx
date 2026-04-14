import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useServersStore } from '@/store/servers'

export function MobileDockge() {
  const navigate = useNavigate()
  const { servers } = useServersStore()
  const [selectedId, setSelectedId] = useState<string | null>(servers[0]?.id ?? null)
  const selected = servers.find((s) => s.id === selectedId)
  const dockgeUrl = selected?.dockgeUrl?.trim() || (selected ? `http://${selected.host}:5001` : '')

  return (
    <div className="mobile-page" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        paddingBottom: 12,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Dockge</h1>
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

      {servers.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <select
            value={selectedId || ''}
            onChange={(e) => setSelectedId(e.target.value)}
            className="mobile-select"
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {selected && dockgeUrl ? (
        <div style={{ flex: 1, border: '1px solid #333', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          <iframe
            src={dockgeUrl}
            style={{ width: '100%', height: '100%', minHeight: '60vh', border: 'none' }}
            title="Dockge"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      ) : (
        <div className="mobile-empty-state">
          <p style={{ color: '#64748b', margin: 0 }}>请先选择服务器，并确保该服务器已配置 Dockge 地址</p>
        </div>
      )}
    </div>
  )
}
