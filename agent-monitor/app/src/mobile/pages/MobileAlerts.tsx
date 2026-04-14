import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AgentAlertSyncPanel } from '@/components/AgentAlertSyncPanel'
import { useServersStore } from '@/store/servers'
import { useAlertsStore } from '@/store/alerts'
import { sendNotification } from '@/api/alerts'
import { agentBaseUrl, agentHeaders } from '@/api/client'
import type { AlertRule, NotificationChannel, ActiveAlert, Server } from '@/shared/types'
import { RuleCard, RuleForm, ChannelCard, ChannelForm } from '@/components/alerts'

export function MobileAlerts() {
  const navigate = useNavigate()
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

  const [activeTab, setActiveTab] = useState<'rules' | 'channels' | 'sync'>('rules')
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [showChannelForm, setShowChannelForm] = useState(false)
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null)
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null)

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

  // 移动端刷新状态
  const [refreshingAgents, setRefreshingAgents] = useState<Set<string>>(new Set())
  const [refreshResults, setRefreshResults] = useState<Record<string, { success: boolean; message: string; rules?: AlertRule[]; channels?: NotificationChannel[] }>>({})

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
    if (agentServers.length === 0) {
      window.alert('暂无自建 Agent 服务器')
      return
    }
    setRefreshingAgents(new Set(agentServers.map((s) => s.id)))
    setRefreshResults({})

    await Promise.all(agentServers.map((server) => fetchFromAgent(server)))

    setRefreshingAgents(new Set())
  }

  return (
    <div className="mobile-page mobile-page-enter" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="mobile-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="mobile-page-title">告警配置</h1>
          <p className="mobile-page-subtitle">管理告警规则与通知渠道</p>
        </div>
        <button
          type="button"
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
          aria-label="关闭"
        >
          ✕
        </button>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: 4,
        padding: '0 16px 12px',
        background: '#0f172a',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <button
          onClick={() => setActiveTab('rules')}
          style={{
            flex: 1,
            padding: '10px 12px',
            background: activeTab === 'rules' ? '#2a3f5f' : '#16213e',
            border: '1px solid #333',
            borderRadius: 6,
            color: activeTab === 'rules' ? '#0f0' : '#aaa',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
            minHeight: 44,
          }}
        >
          规则
        </button>
        <button
          onClick={() => setActiveTab('channels')}
          style={{
            flex: 1,
            padding: '10px 12px',
            background: activeTab === 'channels' ? '#2a3f5f' : '#16213e',
            border: '1px solid #333',
            borderRadius: 6,
            color: activeTab === 'channels' ? '#0f0' : '#aaa',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
            minHeight: 44,
          }}
        >
          渠道
        </button>
        <button
          onClick={() => setActiveTab('sync')}
          style={{
            flex: 1,
            padding: '10px 12px',
            background: activeTab === 'sync' ? '#2a3f5f' : '#16213e',
            border: '1px solid #333',
            borderRadius: 6,
            color: activeTab === 'sync' ? '#0f0' : '#aaa',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
            minHeight: 44,
          }}
        >
          同步
        </button>
      </div>

      {/* Content Area - Scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        {activeTab === 'rules' && (
          <div style={{ paddingBottom: 80 }}>
            <div style={{ marginBottom: 12, paddingTop: 12 }}>
              <button
                onClick={() => {
                  setEditingRule(null)
                  setShowRuleForm(true)
                }}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  background: '#2a3f5f',
                  border: '1px solid #333',
                  borderRadius: 8,
                  color: '#0f0',
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: 500,
                  minHeight: 48,
                }}
              >
                + 添加规则
              </button>
            </div>

            {showRuleForm && (
              <div style={{ marginBottom: 16 }}>
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
                  variant="mobile"
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                  variant="mobile"
                />
              ))}
              {rules.length === 0 && !showRuleForm && (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#888',
                  fontSize: 14,
                }}>
                  暂无告警规则，点击上方按钮添加
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'channels' && (
          <div style={{ paddingBottom: 80 }}>
            <div style={{ marginBottom: 12, paddingTop: 12 }}>
              <button
                onClick={() => {
                  setEditingChannel(null)
                  setShowChannelForm(true)
                }}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  background: '#2a3f5f',
                  border: '1px solid #333',
                  borderRadius: 8,
                  color: '#0f0',
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: 500,
                  minHeight: 48,
                }}
              >
                + 添加渠道
              </button>
            </div>

            {showChannelForm && (
              <div style={{ marginBottom: 16 }}>
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
                  variant="mobile"
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                  variant="mobile"
                />
              ))}
              {channels.length === 0 && !showChannelForm && (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#888',
                  fontSize: 14,
                }}>
                  暂无通知渠道，点击上方按钮添加
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'sync' && (
          <div style={{ paddingTop: 12 }}>
            {/* 刷新按钮 */}
            <div className="mobile-card" style={{ marginBottom: 16 }}>
              <div className="mobile-card-header">
                <h2 className="mobile-card-title">刷新告警规则</h2>
              </div>
              <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 12px', lineHeight: 1.5 }}>
                从所有自建 Agent 服务器拉取当前配置的告警规则和通知渠道。
              </p>
              <button
                type="button"
                className="mobile-button"
                onClick={handleRefreshFromAgents}
                disabled={refreshingAgents.size > 0 || agentServers.length === 0}
                style={{
                  width: '100%',
                  background: refreshingAgents.size > 0 || agentServers.length === 0 ? '#374151' : '#1e3a5f',
                  color: refreshingAgents.size > 0 || agentServers.length === 0 ? '#666' : '#4fc3f7',
                }}
              >
                {refreshingAgents.size > 0 ? `刷新中 (${refreshingAgents.size}台)...` : '刷新所有 Agent'}
              </button>
            </div>

            {/* 刷新结果 */}
            {Object.keys(refreshResults).length > 0 && (
              <div className="mobile-card" style={{ marginBottom: 16 }}>
                <div className="mobile-card-header">
                  <h2 className="mobile-card-title">刷新结果</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {agentServers.map((server) => {
                    const result = refreshResults[server.id]
                    const isRefreshing = refreshingAgents.has(server.id)
                    if (!result && !isRefreshing) return null

                    return (
                      <div
                        key={server.id}
                        className="mobile-list-item"
                        style={{ minHeight: 48 }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ color: '#e2e8f0', fontSize: 15 }}>{server.name}</span>
                            {isRefreshing && <span style={{ color: '#94a3b8', fontSize: 12 }}>刷新中…</span>}
                            {result && (
                              <span style={{ color: result.success ? '#22c55e' : '#ef4444', fontSize: 12 }}>
                                {result.message}
                              </span>
                            )}
                          </div>
                          <span style={{ color: '#64748b', fontSize: 13, display: 'block' }}>
                            {server.host}:{server.port}
                          </span>
                          {result?.success && result.rules && (
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #334155', fontSize: 13, color: '#94a3b8' }}>
                              <div style={{ display: 'flex', gap: 16, marginBottom: 4 }}>
                                <span>规则: {result.rules.length}条</span>
                                <span>渠道: {result.channels?.length || 0}条</span>
                              </div>
                              {result.rules.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {result.rules.slice(0, 5).map((rule) => (
                                    <span
                                      key={rule.id}
                                      style={{
                                        padding: '2px 8px',
                                        background: rule.enabled ? '#1e3a2f' : '#374151',
                                        borderRadius: 4,
                                        fontSize: 11,
                                        color: rule.enabled ? '#22c55e' : '#9ca3af',
                                      }}
                                    >
                                      {rule.name}
                                    </span>
                                  ))}
                                  {result.rules.length > 5 && (
                                    <span style={{ color: '#64748b', fontSize: 12 }}>+{result.rules.length - 5}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <AgentAlertSyncPanel variant="mobile" />
          </div>
        )}
      </div>
    </div>
  )
}
