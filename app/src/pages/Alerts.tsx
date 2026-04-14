import { useState } from 'react'
import { AgentAlertSyncPanel } from '@/components/AgentAlertSyncPanel'
import { useServersStore } from '@/store/servers'
import { useAlertsStore } from '@/store/alerts'
import { sendNotification } from '@/api/alerts'
import type { AlertRule, NotificationChannel, ActiveAlert } from '@/shared/types'
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
      <h1 style={{ marginTop: 0 }}>告警配置</h1>

      <AgentAlertSyncPanel variant="desktop" />

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
