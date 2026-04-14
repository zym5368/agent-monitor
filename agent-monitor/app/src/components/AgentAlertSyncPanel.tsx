import { useState, useEffect } from 'react'
import { useServersStore } from '@/store/servers'
import { useAlertsStore } from '@/store/alerts'
import { agentBaseUrl, agentHeaders } from '@/api/client'
import type { Server } from '@/shared/types'

const STORAGE_KEY = 'syncAgentSelection'

type Variant = 'desktop' | 'mobile'

export function AgentAlertSyncPanel({ variant = 'desktop' }: { variant?: Variant }) {
  const { servers } = useServersStore()
  const { rules, channels } = useAlertsStore()

  const agentServers = servers.filter((s) => s.dataSource === 'agent' || !s.dataSource)

  const [selectedAgents, setSelectedAgents] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [syncingAgents, setSyncingAgents] = useState<Set<string>>(new Set())
  const [syncResults, setSyncResults] = useState<Record<string, { success: boolean; message: string }>>({})

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedAgents))
  }, [selectedAgents])

  const enabledChannels = channels.filter((c) => c.enabled)

  const syncToAgent = async (server: Server) => {
    const applicableRules = rules.filter(
      (rule) => rule.enabled && (rule.serverId == null || rule.serverId === server.id),
    )

    try {
      const response = await fetch(`${agentBaseUrl(server)}/api/alerts/sync`, {
        method: 'PUT',
        headers: agentHeaders(server),
        body: JSON.stringify({
          rules: applicableRules,
          channels: enabledChannels,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      setSyncResults((prev) => ({
        ...prev,
        [server.id]: { success: true, message: '同步成功，Agent 将独立检测' },
      }))
    } catch (error) {
      setSyncResults((prev) => ({
        ...prev,
        [server.id]: {
          success: false,
          message: error instanceof Error ? error.message : '同步失败',
        },
      }))
    }
  }

  const handleSyncToAgents = async () => {
    const serversToSync = agentServers.filter((s) => selectedAgents.includes(s.id))
    setSyncingAgents(new Set(serversToSync.map((s) => s.id)))
    setSyncResults({})

    await Promise.all(serversToSync.map((server) => syncToAgent(server)))

    setSyncingAgents(new Set())
  }

  const toggleAgentSelection = (serverId: string) => {
    setSelectedAgents((prev) =>
      prev.includes(serverId) ? prev.filter((id) => id !== serverId) : [...prev, serverId],
    )
  }

  if (variant === 'mobile') {
    return (
      <div className="mobile-card" style={{ marginBottom: 16 }}>
        <div className="mobile-card-header">
          <h2 className="mobile-card-title">同步到 Agent</h2>
        </div>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 12px', lineHeight: 1.5 }}>
          勾选自建 Agent 服务器，将已启用的规则与<strong>已启用的通知渠道</strong>下发到对应机器执行。
        </p>
        {agentServers.length === 0 ? (
          <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>暂无自建 Agent 服务器。</p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              {agentServers.map((server) => {
                const isSelected = selectedAgents.includes(server.id)
                const isSyncing = syncingAgents.has(server.id)
                const result = syncResults[server.id]
                return (
                  <label
                    key={server.id}
                    className="mobile-list-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: isSyncing ? 'wait' : 'pointer',
                      minHeight: 48,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isSyncing}
                      onChange={() => toggleAgentSelection(server.id)}
                      style={{ width: 20, height: 20 }}
                    />
                    <span style={{ flex: 1, color: '#e2e8f0', fontSize: 15 }}>
                      {server.name}
                      <span style={{ color: '#64748b', fontSize: 13, display: 'block', marginTop: 2 }}>
                        {server.host}:{server.port}
                      </span>
                    </span>
                    {isSyncing && <span style={{ color: '#94a3b8', fontSize: 12 }}>同步中…</span>}
                    {result && (
                      <span style={{ color: result.success ? '#22c55e' : '#ef4444', fontSize: 12 }}>
                        {result.message}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
            <button
              type="button"
              className="mobile-button mobile-button-primary"
              onClick={handleSyncToAgents}
              disabled={selectedAgents.length === 0 || syncingAgents.size > 0}
              style={{ width: '100%' }}
            >
              {syncingAgents.size > 0 ? '同步中…' : '同步选中 Agent'}
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        background: '#16213e',
        borderRadius: 8,
        padding: 20,
        marginBottom: 20,
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 16 }}>同步到 Agent</h3>
      <p style={{ color: '#888', margin: '0 0 16px', fontSize: 13, lineHeight: 1.5 }}>
        仅下发<strong>已启用</strong>的规则与<strong>已启用</strong>的通知渠道。
      </p>
      {agentServers.length === 0 ? (
        <p style={{ color: '#888', margin: 0 }}>暂无 dataSource=agent 的服务器，无法同步。</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {agentServers.map((server) => {
              const isSelected = selectedAgents.includes(server.id)
              const isSyncing = syncingAgents.has(server.id)
              const result = syncResults[server.id]
              return (
                <label
                  key={server.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: '#ccc',
                    cursor: 'pointer',
                    padding: '8px 12px',
                    background: '#0f172a',
                    borderRadius: 6,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isSyncing}
                    onChange={() => toggleAgentSelection(server.id)}
                  />
                  <span style={{ flex: 1 }}>
                    {server.name} ({server.host}:{server.port})
                  </span>
                  {isSyncing && <span style={{ color: '#888' }}>同步中...</span>}
                  {result && (
                    <span style={{ color: result.success ? '#22c55e' : '#ef4444' }}>{result.message}</span>
                  )}
                </label>
              )
            })}
          </div>
          <button
            type="button"
            onClick={handleSyncToAgents}
            disabled={selectedAgents.length === 0 || syncingAgents.size > 0}
            style={{
              padding: '8px 16px',
              background: '#2a3f5f',
              border: '1px solid #333',
              borderRadius: 6,
              color: selectedAgents.length === 0 || syncingAgents.size > 0 ? '#666' : '#0f0',
              cursor: selectedAgents.length === 0 || syncingAgents.size > 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {syncingAgents.size > 0 ? '同步中...' : '同步选中 Agent'}
          </button>
        </>
      )}
    </div>
  )
}
