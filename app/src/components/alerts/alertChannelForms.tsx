import { useState } from 'react'
import type { NotificationChannel, NotificationChannelType } from '@/shared/types'
import { channelTypeOptions, channelTypeLabels, serverChanTemplateHint } from './alertOptions'

interface ChannelCardProps {
  channel: NotificationChannel
  onEdit: () => void
  onDelete: () => void
  onTest: () => void
  testing: boolean
  onToggleEnabled: () => void
  variant?: 'desktop' | 'mobile'
}

export function ChannelCard({
  channel,
  onEdit,
  onDelete,
  onTest,
  testing,
  onToggleEnabled,
  variant = 'desktop',
}: ChannelCardProps) {
  const isMobile = variant === 'mobile'

  return (
    <div
      style={{
        background: '#16213e',
        borderRadius: 8,
        padding: isMobile ? 14 : 16,
        opacity: channel.enabled ? 1 : 0.5,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: isMobile ? 10 : 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 4, fontSize: isMobile ? 15 : 'inherit' }}>{channel.name}</div>
          <div style={{ color: '#ccc', fontSize: isMobile ? 13 : 14 }}>
            类型: {channelTypeLabels[channel.type]}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 6, flexShrink: 0 }}>
          <button
            onClick={onTest}
            disabled={testing}
            style={{
              padding: isMobile ? '8px 10px' : '6px 12px',
              background: 'transparent',
              border: '1px solid #555',
              borderRadius: 4,
              color: '#22c55e',
              cursor: testing ? 'not-allowed' : 'pointer',
              fontSize: isMobile ? 12 : 12,
              opacity: testing ? 0.6 : 1,
              minHeight: isMobile ? 36 : 'auto',
              minWidth: isMobile ? 36 : 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            {testing ? '发送中...' : '测试发送'}
          </button>
          <button
            onClick={onToggleEnabled}
            style={{
              padding: isMobile ? '8px 10px' : '6px 12px',
              background: 'transparent',
              border: '1px solid #555',
              borderRadius: 4,
              color: '#aaa',
              cursor: 'pointer',
              fontSize: isMobile ? 12 : 12,
              minHeight: isMobile ? 36 : 'auto',
              minWidth: isMobile ? 36 : 'auto',
            }}
          >
            {channel.enabled ? '禁用' : '启用'}
          </button>
          <button
            onClick={onEdit}
            style={{
              padding: isMobile ? '8px 10px' : '6px 12px',
              background: 'transparent',
              border: '1px solid #555',
              borderRadius: 4,
              color: '#aaa',
              cursor: 'pointer',
              fontSize: isMobile ? 12 : 12,
              minHeight: isMobile ? 36 : 'auto',
              minWidth: isMobile ? 36 : 'auto',
            }}
          >
            编辑
          </button>
          <button
            onClick={onDelete}
            style={{
              padding: isMobile ? '8px 10px' : '6px 12px',
              background: 'transparent',
              border: '1px solid #555',
              borderRadius: 4,
              color: '#f44336',
              cursor: 'pointer',
              fontSize: isMobile ? 12 : 12,
              minHeight: isMobile ? 36 : 'auto',
              minWidth: isMobile ? 36 : 'auto',
            }}
          >
            删除
          </button>
        </div>
      </div>
    </div>
  )
}

interface ChannelFormProps {
  channel: NotificationChannel | null
  onSubmit: (data: Omit<NotificationChannel, 'id'>) => void
  onCancel: () => void
  variant?: 'desktop' | 'mobile'
}

export function ChannelForm({
  channel,
  onSubmit,
  onCancel,
  variant = 'desktop',
}: ChannelFormProps) {
  const [name, setName] = useState(channel?.name ?? '')
  const [type, setType] = useState<NotificationChannelType>(channel?.type ?? 'webhook')
  const [config, setConfig] = useState<Record<string, string>>(channel?.config ?? {})
  const [enabled, setEnabled] = useState(channel?.enabled ?? true)
  const isMobile = variant === 'mobile'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ name, type, config, enabled })
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: '#16213e',
        borderRadius: 8,
        padding: isMobile ? 16 : 20,
        marginBottom: isMobile ? 16 : 20,
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: isMobile ? 17 : 'inherit' }}>
        {channel ? '编辑渠道' : '添加渠道'}
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 6, color: '#ccc', fontSize: 14 }}>渠道名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{
              width: '100%',
              padding: isMobile ? 14 : 8,
              background: '#0f172a',
              border: '1px solid #333',
              borderRadius: 4,
              color: '#fff',
              boxSizing: 'border-box',
              fontSize: isMobile ? 16 : 'inherit',
              minHeight: isMobile ? 48 : 'auto',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, color: '#ccc', fontSize: 14 }}>渠道类型</label>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as NotificationChannelType)
              setConfig({})
            }}
            style={{
              width: '100%',
              padding: isMobile ? 14 : 8,
              background: '#0f172a',
              border: '1px solid #333',
              borderRadius: 4,
              color: '#fff',
              boxSizing: 'border-box',
              fontSize: isMobile ? 16 : 'inherit',
              minHeight: isMobile ? 48 : 'auto',
            }}
          >
            {channelTypeOptions().map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {type === 'webhook' && (
          <div>
            <label style={{ display: 'block', marginBottom: 6, color: '#ccc', fontSize: 14 }}>Webhook URL</label>
            <input
              type="text"
              inputMode="url"
              value={config.url ?? ''}
              onChange={(e) => setConfig({ ...config, url: e.target.value })}
              required
              placeholder="https://example.com/webhook"
              style={{
                width: '100%',
                padding: isMobile ? 14 : 8,
                background: '#0f172a',
                border: '1px solid #333',
                borderRadius: 4,
                color: '#fff',
                boxSizing: 'border-box',
                fontSize: isMobile ? 16 : 'inherit',
                minHeight: isMobile ? 48 : 'auto',
              }}
            />
          </div>
        )}

        {(type === 'wechat' || type === 'dingtalk') && (
          <div>
            <label style={{ display: 'block', marginBottom: 6, color: '#ccc', fontSize: 14 }}>Webhook URL</label>
            <input
              type="text"
              inputMode="url"
              value={config.webhookUrl ?? ''}
              onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
              required
              placeholder={`https://${type === 'wechat' ? 'qyapi.weixin.qq.com' : 'oapi.dingtalk.com'}/...`}
              style={{
                width: '100%',
                padding: isMobile ? 14 : 8,
                background: '#0f172a',
                border: '1px solid #333',
                borderRadius: 4,
                color: '#fff',
                boxSizing: 'border-box',
                fontSize: isMobile ? 16 : 'inherit',
                minHeight: isMobile ? 48 : 'auto',
              }}
            />
          </div>
        )}

        {type === 'email' && (
          <>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: '#ccc', fontSize: 14 }}>收件人邮箱</label>
              <input
                type="email"
                value={config.to ?? ''}
                onChange={(e) => setConfig({ ...config, to: e.target.value })}
                required
                placeholder="admin@example.com"
                style={{
                  width: '100%',
                  padding: isMobile ? 14 : 8,
                  background: '#0f172a',
                  border: '1px solid #333',
                  borderRadius: 4,
                  color: '#fff',
                  boxSizing: 'border-box',
                  fontSize: isMobile ? 16 : 'inherit',
                  minHeight: isMobile ? 48 : 'auto',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: '#ccc', fontSize: 14 }}>
                邮件发送服务 Webhook URL (可选)
              </label>
              <input
                type="text"
                inputMode="url"
                value={config.webhookUrl ?? ''}
                onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
                placeholder="https://example.com/send-email"
                style={{
                  width: '100%',
                  padding: isMobile ? 14 : 8,
                  background: '#0f172a',
                  border: '1px solid #333',
                  borderRadius: 4,
                  color: '#fff',
                  boxSizing: 'border-box',
                  fontSize: isMobile ? 16 : 'inherit',
                  minHeight: isMobile ? 48 : 'auto',
                }}
              />
            </div>
          </>
        )}

        {(type === 'serverchan' || type === 'serverchan3') && (
          <>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: '#ccc', fontSize: 14 }}>SendKey</label>
              <input
                type="password"
                value={config.sendKey ?? ''}
                onChange={(e) => setConfig({ ...config, sendKey: e.target.value })}
                required
                placeholder={type === 'serverchan3' ? 'sctp… 开头，从 SendKey 页复制' : 'SCT SendKey（非 sctp 开头）'}
                autoComplete="off"
                style={{
                  width: '100%',
                  padding: isMobile ? 14 : 8,
                  background: '#0f172a',
                  border: '1px solid #333',
                  borderRadius: 4,
                  color: '#fff',
                  boxSizing: 'border-box',
                  fontSize: isMobile ? 16 : 'inherit',
                  minHeight: isMobile ? 48 : 'auto',
                }}
              />
            </div>
            <p style={{ margin: 0, color: '#888', fontSize: 12, lineHeight: 1.5 }}>{serverChanTemplateHint}</p>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: '#ccc', fontSize: 14 }}>标题模板（可选）</label>
              <textarea
                value={config.titleTemplate ?? ''}
                onChange={(e) => setConfig({ ...config, titleTemplate: e.target.value })}
                placeholder="默认：[{levelLabel}] {serverName}"
                rows={isMobile ? 3 : 2}
                style={{
                  width: '100%',
                  padding: isMobile ? 14 : 8,
                  background: '#0f172a',
                  border: '1px solid #333',
                  borderRadius: 4,
                  color: '#fff',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  fontSize: isMobile ? 16 : 'inherit',
                  minHeight: isMobile ? 80 : 'auto',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: '#ccc', fontSize: 14 }}>正文模板 / Markdown（可选）</label>
              <textarea
                value={config.despTemplate ?? ''}
                onChange={(e) => setConfig({ ...config, despTemplate: e.target.value })}
                placeholder="留空使用内置 Markdown 告警正文"
                rows={isMobile ? 6 : 8}
                style={{
                  width: '100%',
                  padding: isMobile ? 14 : 8,
                  background: '#0f172a',
                  border: '1px solid #333',
                  borderRadius: 4,
                  color: '#fff',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  fontSize: isMobile ? 16 : 'inherit',
                  minHeight: isMobile ? 150 : 'auto',
                }}
              />
            </div>
          </>
        )}

        {type === 'serverchan' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#ccc', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.encryptEnabled === 'true'}
                  onChange={(e) =>
                    setConfig({ ...config, encryptEnabled: e.target.checked ? 'true' : 'false' })
                  }
                  style={{ transform: isMobile ? 'scale(1.3)' : 'none' }}
                />
                端对端加密 desp（encoded=1，需在详情页用密码查看）
              </label>
            </div>
            {config.encryptEnabled === 'true' && (
              <>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, color: '#ccc', fontSize: 14 }}>阅读密码</label>
                  <input
                    type="password"
                    value={config.encryptPassword ?? ''}
                    onChange={(e) => setConfig({ ...config, encryptPassword: e.target.value })}
                    placeholder="与 Server酱 详情页解密一致"
                    autoComplete="new-password"
                    style={{
                      width: '100%',
                      padding: isMobile ? 14 : 8,
                      background: '#0f172a',
                      border: '1px solid #333',
                      borderRadius: 4,
                      color: '#fff',
                      boxSizing: 'border-box',
                      fontSize: isMobile ? 16 : 'inherit',
                      minHeight: isMobile ? 48 : 'auto',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, color: '#ccc', fontSize: 14 }}>
                    IV 种子（文档：SCT 与 UID 拼接，如 SCT54264）
                  </label>
                  <input
                    type="text"
                    value={config.encryptIvSeed ?? ''}
                    onChange={(e) => setConfig({ ...config, encryptIvSeed: e.target.value })}
                    placeholder="SCT你的UID"
                    style={{
                      width: '100%',
                      padding: isMobile ? 14 : 8,
                      background: '#0f172a',
                      border: '1px solid #333',
                      borderRadius: 4,
                      color: '#fff',
                      boxSizing: 'border-box',
                      fontSize: isMobile ? 16 : 'inherit',
                      minHeight: isMobile ? 48 : 'auto',
                    }}
                  />
                </div>
              </>
            )}
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: '#ccc', fontSize: 14 }}>channel（可选，多通道用 |）</label>
              <input
                type="text"
                value={config.channel ?? ''}
                onChange={(e) => setConfig({ ...config, channel: e.target.value })}
                placeholder="如 9|66"
                style={{
                  width: '100%',
                  padding: isMobile ? 14 : 8,
                  background: '#0f172a',
                  border: '1px solid #333',
                  borderRadius: 4,
                  color: '#fff',
                  boxSizing: 'border-box',
                  fontSize: isMobile ? 16 : 'inherit',
                  minHeight: isMobile ? 48 : 'auto',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#ccc', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.noip === '1'}
                  onChange={(e) => setConfig({ ...config, noip: e.target.checked ? '1' : '' })}
                  style={{ transform: isMobile ? 'scale(1.3)' : 'none' }}
                />
                隐藏调用 IP（noip=1）
              </label>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: '#ccc', fontSize: 14 }}>openid 抄送（可选）</label>
              <input
                type="text"
                value={config.openid ?? ''}
                onChange={(e) => setConfig({ ...config, openid: e.target.value })}
                placeholder="测试号/企微通道用"
                style={{
                  width: '100%',
                  padding: isMobile ? 14 : 8,
                  background: '#0f172a',
                  border: '1px solid #333',
                  borderRadius: 4,
                  color: '#fff',
                  boxSizing: 'border-box',
                  fontSize: isMobile ? 16 : 'inherit',
                  minHeight: isMobile ? 48 : 'auto',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: '#ccc', fontSize: 14 }}>short 卡片摘要（可选，≤64）</label>
              <input
                type="text"
                value={config.short ?? ''}
                onChange={(e) => setConfig({ ...config, short: e.target.value })}
                style={{
                  width: '100%',
                  padding: isMobile ? 14 : 8,
                  background: '#0f172a',
                  border: '1px solid #333',
                  borderRadius: 4,
                  color: '#fff',
                  boxSizing: 'border-box',
                  fontSize: isMobile ? 16 : 'inherit',
                  minHeight: isMobile ? 48 : 'auto',
                }}
              />
            </div>
          </>
        )}

        {type === 'serverchan3' && (
          <>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: '#ccc', fontSize: 14 }}>tags（可选，| 分隔）</label>
              <input
                type="text"
                value={config.tags ?? ''}
                onChange={(e) => setConfig({ ...config, tags: e.target.value })}
                style={{
                  width: '100%',
                  padding: isMobile ? 14 : 8,
                  background: '#0f172a',
                  border: '1px solid #333',
                  borderRadius: 4,
                  color: '#fff',
                  boxSizing: 'border-box',
                  fontSize: isMobile ? 16 : 'inherit',
                  minHeight: isMobile ? 48 : 'auto',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: '#ccc', fontSize: 14 }}>short 卡片摘要（可选）</label>
              <input
                type="text"
                value={config.short ?? ''}
                onChange={(e) => setConfig({ ...config, short: e.target.value })}
                style={{
                  width: '100%',
                  padding: isMobile ? 14 : 8,
                  background: '#0f172a',
                  border: '1px solid #333',
                  borderRadius: 4,
                  color: '#fff',
                  boxSizing: 'border-box',
                  fontSize: isMobile ? 16 : 'inherit',
                  minHeight: isMobile ? 48 : 'auto',
                }}
              />
            </div>
          </>
        )}

        <div style={{ display: 'flex', alignItems: 'center', paddingTop: 4 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#ccc', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              style={{ transform: isMobile ? 'scale(1.3)' : 'none' }}
            />
            启用渠道
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: isMobile ? 'stretch' : 'flex-end', marginTop: isMobile ? 10 : 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: isMobile ? 1 : '0 0 auto',
              padding: isMobile ? '14px 18px' : '8px 16px',
              background: 'transparent',
              border: '1px solid #555',
              borderRadius: 4,
              color: '#aaa',
              cursor: 'pointer',
              fontSize: isMobile ? 15 : 'inherit',
              minHeight: isMobile ? 48 : 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            取消
          </button>
          <button
            type="submit"
            style={{
              flex: isMobile ? 1 : '0 0 auto',
              padding: isMobile ? '14px 18px' : '8px 16px',
              background: '#2a3f5f',
              border: '1px solid #333',
              borderRadius: 4,
              color: '#0f0',
              cursor: 'pointer',
              fontSize: isMobile ? 15 : 'inherit',
              minHeight: isMobile ? 48 : 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            保存
          </button>
        </div>
      </div>
    </form>
  )
}
