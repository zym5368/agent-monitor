import { useState } from 'react'
import { getMetricLabel, getAlertLevelLabel, getAlertLevelColor } from '@/api/alerts'
import type { AlertRule, AlertMetric, AlertCondition, AlertLevel, Server } from '@/shared/types'
import { NetdataMetricSelector } from './NetdataMetricSelector'
import { metricSelectOptions, conditionOptions, levelOptions } from './alertOptions'

interface RuleCardProps {
  rule: AlertRule
  servers: Server[]
  onEdit: () => void
  onDelete: () => void
  onToggleEnabled: () => void
  variant?: 'desktop' | 'mobile'
}

export function RuleCard({
  rule,
  servers,
  onEdit,
  onDelete,
  onToggleEnabled,
  variant = 'desktop',
}: RuleCardProps) {
  const server = rule.serverId ? servers.find((s) => s.id === rule.serverId) : null
  const conditionLabel = rule.condition === 'above' ? '高于' : '低于'
  const unit = rule.netdataMetric ? (rule.netdataMetric.units || '') : (rule.metric?.includes('temp') ? '°C' : '%')
  const metricLabel = getMetricLabel(rule)
  const isMobile = variant === 'mobile'

  return (
    <div
      style={{
        background: '#16213e',
        borderRadius: 8,
        padding: isMobile ? 14 : 16,
        opacity: rule.enabled ? 1 : 0.5,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: isMobile ? 10 : 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 6, fontSize: isMobile ? 15 : 'inherit' }}>
            {rule.name}
            {rule.netdataMetric && (
              <span style={{ fontSize: 11, color: '#888', marginLeft: 6 }}>
                (Netdata)
              </span>
            )}
          </div>
          <div style={{ color: '#ccc', fontSize: isMobile ? 13 : 14, marginBottom: 4 }}>
            {server ? server.name : '所有服务器'} · {metricLabel}
          </div>
          <div style={{ color: '#aaa', fontSize: isMobile ? 12 : 14 }}>
            <span style={{ color: getAlertLevelColor(rule.level) }}>[{getAlertLevelLabel(rule.level)}]</span>
            {' '}
            当 {metricLabel} {conditionLabel} {rule.threshold}{unit}
            {rule.consecutiveCount > 1 && ` (连续${rule.consecutiveCount}次)`}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 6, flexShrink: 0 }}>
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
            {rule.enabled ? '禁用' : '启用'}
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

interface RuleFormProps {
  rule: AlertRule | null
  servers: Server[]
  onSubmit: (data: Omit<AlertRule, 'id'>) => void
  onCancel: () => void
  variant?: 'desktop' | 'mobile'
}

export function RuleForm({
  rule,
  servers,
  onSubmit,
  onCancel,
  variant = 'desktop',
}: RuleFormProps) {
  const [name, setName] = useState(rule?.name ?? '')
  const [serverId, setServerId] = useState<string | undefined>(rule?.serverId)
  const [useNetdataMetric, setUseNetdataMetric] = useState(!!rule?.netdataMetric)
  const [metric, setMetric] = useState<AlertMetric>(rule?.metric ?? 'cpu')
  const [condition, setCondition] = useState<AlertCondition>(rule?.condition ?? 'above')
  const [threshold, setThreshold] = useState(String(rule?.threshold ?? 90))
  const [level, setLevel] = useState<AlertLevel>(rule?.level ?? 'warning')
  const [enabled, setEnabled] = useState(rule?.enabled ?? true)
  const [consecutiveCount, setConsecutiveCount] = useState(String(rule?.consecutiveCount ?? 1))
  const [netdataChartId, setNetdataChartId] = useState(rule?.netdataMetric?.chartId ?? '')
  const [netdataDimensionName, setNetdataDimensionName] = useState(rule?.netdataMetric?.dimensionName ?? '')
  const [netdataChartTitle, setNetdataChartTitle] = useState(rule?.netdataMetric?.chartTitle ?? '')
  const [netdataDimensionLabel, setNetdataDimensionLabel] = useState(rule?.netdataMetric?.dimensionLabel ?? '')
  const [netdataUnits, setNetdataUnits] = useState(rule?.netdataMetric?.units ?? '')

  const selectedServer = serverId ? (servers.find((s) => s.id === serverId) ?? null) : null
  const isMobile = variant === 'mobile'

  const handleNetdataMetricChange = (
    chartId: string,
    dimensionName: string,
    chartTitle: string,
    dimensionLabel: string,
    units: string
  ) => {
    setNetdataChartId(chartId)
    setNetdataDimensionName(dimensionName)
    setNetdataChartTitle(chartTitle)
    setNetdataDimensionLabel(dimensionLabel)
    setNetdataUnits(units)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const baseData = {
      name,
      serverId,
      condition,
      threshold: Number(threshold),
      level,
      enabled,
      consecutiveCount: Math.max(1, Number(consecutiveCount)),
    }

    if (useNetdataMetric && netdataChartId && netdataDimensionName) {
      onSubmit({
        ...baseData,
        netdataMetric: {
          chartId: netdataChartId,
          dimensionName: netdataDimensionName,
          chartTitle: netdataChartTitle,
          dimensionLabel: netdataDimensionLabel,
          units: netdataUnits,
        },
      })
    } else {
      onSubmit({
        ...baseData,
        metric,
      })
    }
  }

  const displayUnit = useNetdataMetric ? (netdataUnits || '') : (metric.includes('temp') ? '°C' : '%')

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
        {rule ? '编辑规则' : '添加规则'}
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 6, color: '#ccc', fontSize: 14 }}>规则名称</label>
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
          <label style={{ display: 'block', marginBottom: 6, color: '#ccc', fontSize: 14 }}>应用服务器</label>
          <select
            value={serverId ?? ''}
            onChange={(e) => setServerId(e.target.value || undefined)}
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
            <option value="">所有服务器</option>
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 10, color: '#ccc', fontSize: 14 }}>指标类型</label>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ccc', cursor: 'pointer' }}>
              <input
                type="radio"
                checked={!useNetdataMetric}
                onChange={() => setUseNetdataMetric(false)}
                style={{ transform: isMobile ? 'scale(1.3)' : 'none' }}
              />
              预设快速指标
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ccc', cursor: 'pointer' }}>
              <input
                type="radio"
                checked={useNetdataMetric}
                onChange={() => setUseNetdataMetric(true)}
                style={{ transform: isMobile ? 'scale(1.3)' : 'none' }}
              />
              自定义 Netdata 指标
            </label>
          </div>
        </div>

        {!useNetdataMetric ? (
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#ccc', fontSize: 14 }}>选择指标</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as AlertMetric)}
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
              {metricSelectOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <NetdataMetricSelector
            server={selectedServer}
            selectedChartId={netdataChartId}
            selectedDimensionName={netdataDimensionName}
            onChange={handleNetdataMetricChange}
            variant={variant}
          />
        )}

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#ccc', fontSize: 14 }}>条件</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as AlertCondition)}
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
              {conditionOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#ccc', fontSize: 14 }}>
              阈值 {displayUnit ? `(${displayUnit})` : ''}
            </label>
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
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

          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#ccc', fontSize: 14 }}>告警级别</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as AlertLevel)}
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
              {levelOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#ccc', fontSize: 14 }}>连续触发次数</label>
            <input
              type="number"
              value={consecutiveCount}
              onChange={(e) => setConsecutiveCount(e.target.value)}
              min={1}
              max={10}
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

          <div style={{ flex: 1, display: 'flex', alignItems: isMobile ? 'flex-start' : 'flex-end', paddingTop: isMobile ? 6 : 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#ccc', cursor: 'pointer', paddingTop: isMobile ? 18 : 0 }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                style={{ transform: isMobile ? 'scale(1.3)' : 'none' }}
              />
              启用规则
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: isMobile ? 'stretch' : 'flex-end', marginTop: isMobile ? 10 : 8, flexDirection: isMobile ? 'row' : 'row' }}>
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
