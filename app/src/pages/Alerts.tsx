import { useState } from 'react'
import { AgentAlertSyncPanel } from '@/components/AgentAlertSyncPanel'
import { useServersStore } from '@/store/servers'
import { useAlertsStore } from '@/store/alerts'
import { sendNotification } from '@/api/alerts'
import { agentBaseUrl, agentHeaders } from '@/api/client'
import type { AlertRule, NotificationChannel, ActiveAlert, Server } from '@/shared/types'
import { RuleCard, RuleForm, ChannelCard, ChannelForm } from '@/components/alerts'

export function Alerts() {
  const { servers } = useServersStore()
  const {
    rules,
    addRule,
    updateRule,
    removeRule,
    channels,
    addChannel,
    updateChannel,
    removeChannel,
  } = useAlertsStore()

  const [activeTab, setActiveTab] = useState<'rules' | 'channels'>('rules')
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [showChannelForm, setShowChannelForm] = useState(false)
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null)
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null)

  // 刷新状态
  const [refreshingAgents, setRefreshingAgents] = useState<Set<string>>(new Set())
  const [refreshResults, setRefreshResults] = useState<Record<string, { success: boolean; message: string; rules?: AlertRule[]; channels?: NotificationChannel[] }>>({})
  const [showRefreshPanel, setShowRefreshPanel] = useState(false)

  const agentServers = servers.filter((s) => s.dataSource === 'agent' || !s.dataSource)

  const fetchFromAgent = async (server: Server) => {
    try {
      const response = await fetch(`${agentBaseUrl(server)}/api/alerts/rules`, {
        method: 'GET',
        headers: agentHeaders(server),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      setRefreshResults((prev) => ({
        ...prev,
        [server.id]: {
          success: true,
          message: '拉取成功',
          rules: data.rules || [],
          channels: data.channels || []
        },
      }))
    } catch (error) {
      setRefreshResults((prev) => ({
        ...prev,
        [server.id]: {
          success: false,
          message: error instanceof Error ? error.message : '拉取失败',
        },
      }))
    }
  }

  const handleRefreshFromAgents = async () => {
    setRefreshingAgents(new Set(agentServers.map((s) => s.id)))
    setRefreshResults({})
    setShowRefreshPanel(true)

    await Promise.all(agentServers.map((server) => fetchFromAgent(server)))

    setRefreshingAgents(new Set())
  }

  const handleTestChannel = async (channel: NotificationChannel) => {
    if (testingChannelId) return
    setTestingChannelId(channel.id)
    try {
      const testAlert: ActiveAlert = {
        id: `test-${Date.now()}`,
        ruleId: 'test-rule',
        serverId: 'test-server',
        serverName: '测试服务器',
        metric: 'cpu',
        metricLabel: 'CPU 使用率',
        value: 92.5,
        threshold: 80,
        condition: 'above',
        level: 'warning',
        status: 'pending',
        startedAt: Date.now(),
        consecutiveHits: 1,
        units: '%',
      }
      const testMessage = `【测试通知】渠道 ${channel.name}（${channel.type}）连通性验证，发送时间：${new Date().toLocaleString('zh-CN')}`
      await sendNotification(channel, testAlert, testMessage)
      window.alert(`测试发送成功：${channel.name}`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      window.alert(`测试发送失败：${channel.name}\n${msg}`)
    } finally {
      setTestingChannelId(null)
    }
  }

  return (
    <div className="alerts-page">
      <h1 style={{ marginTop: 0, marginBottom: 16 }}>告警配置</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={handleRefreshFromAgents}
          disabled={refreshingAgents.size > 0 || agentServers.length === 0}
          style={{
            padding: '8px 16px',
            background: '#1e3a5f',
            border: '1px solid #333',
            borderRadius: 6,
            color: refreshingAgents.size > 0 || agentServers.length === 0 ? '#666' : '#4fc3f7',
            cursor: refreshingAgents.size > 0 || agentServers.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {refreshingAgents.size > 0 ? '刷新中...' : '刷新告警规则'}
        </button>
        <button
          onClick={() => setShowRefreshPanel(!showRefreshPanel)}
          disabled={Object.keys(refreshResults).length === 0}
          style={{
            padding: '8px 16px',
            background: '#16213e',
            border: '1px solid #333',
            borderRadius: 6,
            color: Object.keys(refreshResults).length === 0 ? '#666' : '#aaa',
            cursor: Object.keys(refreshResults).length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {showRefreshPanel ? '隐藏刷新结果' : `查看刷新结果 (${Object.keys(refreshResults).length})`}
        </button>
      </div>

      <AgentAlertSyncPanel variant="desktop" />

      {/* 刷新结果面板 */}
      {showRefreshPanel && Object.keys(refreshResults).length > 0 && (
        <div
          style={{
            background: '#16213e',
            borderRadius: 8,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>刷新结果</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {agentServers.map((server) => {
              const result = refreshResults[server.id]
              const isRefreshing = refreshingAgents.has(server.id)
              if (!result && !isRefreshing) return null

              return (
                <div
                  key={server.id}
                  style={{
                    padding: '12px 16px',
                    background: '#0f172a',
                    borderRadius: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ color: '#e2e8f0', fontWeight: 500 }}>
                      {server.name} ({server.host}:{server.port})
                    </span>
                    {isRefreshing && <span style={{ color: '#94a3b8', fontSize: 13 }}>刷新中...</span>}
                    {result && (
                      <span style={{ color: result.success ? '#22c55e' : '#ef4444', fontSize: 13 }}>
                        {result.message}
                      </span>
                    )}
                  </div>
                  {result?.success && result.rules && (
                    <div style={{ marginLeft: 0, fontSize: 13, color: '#94a3b8' }}>
                      <div style={{ display: 'flex', gap: 24 }}>
                        <span>告警规则: {result.rules.length} 条</span>
                        <span>通知渠道: {result.channels?.length || 0} 条</span>
                      </div>
                      {result.rules.length > 0 && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #334155' }}>
                          <div style={{ marginBottom: 4, color: '#64748b' }}>规则列表:</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {result.rules.map((rule) => (
                              <span
                                key={rule.id}
                                style={{
                                  padding: '2px 8px',
                                  background: rule.enabled ? '#1e3a2f' : '#374151',
                                  borderRadius: 4,
                                  fontSize: 12,
                                  color: rule.enabled ? '#22c55e' : '#9ca3af',
                                }}
                              >
                                {rule.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab('rules')}
          style={{
            padding: '8px 16px',
            background: activeTab === 'rules' ? '#2a3f5f' : '#16213e',
            border: '1px solid #333',
            borderRadius: 6,
            color: activeTab === 'rules' ? '#0f0' : '#aaa',
            cursor: 'pointer',
          }}
        >
          告警规则
        </button>
        <button
          onClick={() => setActiveTab('channels')}
          style={{
            padding: '8px 16px',
            background: activeTab === 'channels' ? '#2a3f5f' : '#16213e',
            border: '1px solid #333',
            borderRadius: 6,
            color: activeTab === 'channels' ? '#0f0' : '#aaa',
            cursor: 'pointer',
          }}
        >
          通知渠道
        </button>
      </div>

      {activeTab === 'rules' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => {
                setEditingRule(null)
                setShowRuleForm(true)
              }}
              style={{
                padding: '8px 16px',
                background: '#2a3f5f',
                border: '1px solid #333',
                borderRadius: 6,
                color: '#0f0',
                cursor: 'pointer',
              }}
            >
              + 添加规则
            </button>
          </div>

          {showRuleForm && (
            <RuleForm
              rule={editingRule}
              servers={servers}
              onSubmit={(data) => {
                if (editingRule) {
                  updateRule(editingRule.id, data)
                } else {
                  addRule(data)
                }
                setShowRuleForm(false)
                setEditingRule(null)
              }}
              onCancel={() => {
                setShowRuleForm(false)
                setEditingRule(null)
              }}
              variant="desktop"
            />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                servers={servers}
                onEdit={() => {
                  setEditingRule(rule)
                  setShowRuleForm(true)
                }}
                onDelete={() => removeRule(rule.id)}
                onToggleEnabled={() => updateRule(rule.id, { enabled: !rule.enabled })}
                variant="desktop"
              />
            ))}
            {rules.length === 0 && (
              <p style={{ color: '#888' }}>暂无告警规则，点击上方按钮添加。</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'channels' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => {
                setEditingChannel(null)
                setShowChannelForm(true)
              }}
              style={{
                padding: '8px 16px',
                background: '#2a3f5f',
                border: '1px solid #333',
                borderRadius: 6,
                color: '#0f0',
                cursor: 'pointer',
              }}
            >
              + 添加渠道
            </button>
          </div>

          {showChannelForm && (
            <ChannelForm
              channel={editingChannel}
              onSubmit={(data) => {
                if (editingChannel) {
                  updateChannel(editingChannel.id, data)
                } else {
                  addChannel(data)
                }
                setShowChannelForm(false)
                setEditingChannel(null)
              }}
              onCancel={() => {
                setShowChannelForm(false)
                setEditingChannel(null)
              }}
              variant="desktop"
            />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {channels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                onEdit={() => {
                  setEditingChannel(channel)
                  setShowChannelForm(true)
                }}
                onDelete={() => removeChannel(channel.id)}
                onTest={() => handleTestChannel(channel)}
                testing={testingChannelId === channel.id}
                onToggleEnabled={() => updateChannel(channel.id, { enabled: !channel.enabled })}
                variant="desktop"
              />
            ))}
            {channels.length === 0 && (
              <p style={{ color: '#888' }}>暂无通知渠道，点击上方按钮添加。</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
