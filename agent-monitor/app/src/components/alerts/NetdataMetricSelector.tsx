import { useState, useEffect, useCallback } from 'react'
import { fetchNetdataCharts } from '@/api/client'
import { translateChartId, translateDimension } from '@/utils/netdata-translator'
import type { NetdataChartInfo, Server } from '@/shared/types'

interface NetdataMetricSelectorProps {
  server: Server | null
  selectedChartId: string
  selectedDimensionName: string
  onChange: (chartId: string, dimensionName: string, chartTitle: string, dimensionLabel: string, units: string) => void
  variant?: 'desktop' | 'mobile'
}

export function NetdataMetricSelector({
  server,
  selectedChartId,
  selectedDimensionName,
  onChange,
  variant = 'desktop',
}: NetdataMetricSelectorProps) {
  const [charts, setCharts] = useState<NetdataChartInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')

  const loadCharts = useCallback(async () => {
    if (!server?.netdataUrl) {
      setCharts([])
      return
    }
    setLoading(true)
    try {
      const fetchedCharts = await fetchNetdataCharts(server.netdataUrl)
      setCharts(fetchedCharts)
    } catch {
      setCharts([])
    } finally {
      setLoading(false)
    }
  }, [server?.netdataUrl])

  useEffect(() => {
    loadCharts()
  }, [loadCharts])

  const filteredCharts = filter
    ? charts.filter((c) => {
        const translated = translateChartId(c.id)
        const lowerFilter = filter.toLowerCase()
        return translated.toLowerCase().includes(lowerFilter) ||
               c.title.toLowerCase().includes(lowerFilter) ||
               c.id.toLowerCase().includes(lowerFilter)
      })
    : charts

  const selectedChart = charts.find((c) => c.id === selectedChartId)

  const isMobile = variant === 'mobile'

  return (
    <div style={{ background: '#0f172a', borderRadius: 8, padding: 16 }}>
      {!server?.netdataUrl ? (
        <p style={{ color: '#888', margin: 0 }}>
          请先选择一个已配置 Netdata 的服务器来加载可用指标
        </p>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="搜索指标（支持中文）..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{
                  flex: 1,
                  padding: isMobile ? 12 : 8,
                  background: '#16213e',
                  border: '1px solid #333',
                  borderRadius: 4,
                  color: '#fff',
                  fontSize: isMobile ? 16 : 'inherit',
                  minHeight: isMobile ? 44 : 'auto',
                }}
              />
              <button
                type="button"
                onClick={loadCharts}
                disabled={loading}
                style={{
                  padding: isMobile ? '12px 16px' : '8px 16px',
                  background: '#2a3f5f',
                  border: '1px solid #333',
                  borderRadius: 4,
                  color: '#0f0',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                  minHeight: isMobile ? 44 : 'auto',
                  minWidth: isMobile ? 44 : 'auto',
                  whiteSpace: 'nowrap',
                }}
              >
                {loading ? '加载中...' : '刷新'}
              </button>
            </div>
          </div>

          <div className="netdata-select-row" style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 4, color: '#ccc', fontSize: 13 }}>
                指标 (Charts)
              </label>
              <select
                {...(isMobile ? {} : { size: 8 })}
                value={selectedChartId}
                onChange={(e) => {
                  const chart = charts.find((c) => c.id === e.target.value)
                  if (chart && chart.dimensions.length > 0) {
                    const translatedTitle = translateChartId(chart.id)
                    const translatedDim = translateDimension(chart.dimensions[0].name, chart.id)
                    onChange(
                      chart.id,
                      chart.dimensions[0].name,
                      translatedTitle,
                      translatedDim,
                      chart.units
                    )
                  }
                }}
                style={{
                  width: '100%',
                  background: '#16213e',
                  border: '1px solid #333',
                  borderRadius: 4,
                  color: '#fff',
                  boxSizing: 'border-box',
                  padding: isMobile ? 12 : 8,
                  fontSize: isMobile ? 16 : 'inherit',
                  minHeight: isMobile ? 44 : 'auto',
                }}
              >
                {filteredCharts.map((chart) => {
                  const translated = translateChartId(chart.id)
                  const showOriginal = translated !== chart.title && translated !== chart.id
                  return (
                    <option key={chart.id} value={chart.id}>
                      {translated}
                      {showOriginal && ` (${chart.id})`}
                      {chart.units && ` [${chart.units}]`}
                    </option>
                  )
                })}
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 4, color: '#ccc', fontSize: 13 }}>
                维度 (Dimensions)
              </label>
              <select
                {...(isMobile ? {} : { size: 8 })}
                value={selectedDimensionName}
                onChange={(e) => {
                  const dim = selectedChart?.dimensions.find((d) => d.name === e.target.value)
                  if (selectedChart && dim) {
                    const translatedTitle = translateChartId(selectedChart.id)
                    const translatedDim = translateDimension(dim.name, selectedChart.id)
                    onChange(
                      selectedChart.id,
                      dim.name,
                      translatedTitle,
                      translatedDim,
                      selectedChart.units
                    )
                  }
                }}
                style={{
                  width: '100%',
                  background: '#16213e',
                  border: '1px solid #333',
                  borderRadius: 4,
                  color: '#fff',
                  boxSizing: 'border-box',
                  padding: isMobile ? 12 : 8,
                  fontSize: isMobile ? 16 : 'inherit',
                  minHeight: isMobile ? 44 : 'auto',
                }}
              >
                {selectedChart?.dimensions.map((dim) => {
                  const translated = translateDimension(dim.name, selectedChart.id)
                  const showOriginal = translated !== (dim.label || dim.name)
                  return (
                    <option key={dim.name} value={dim.name}>
                      {translated}
                      {showOriginal && ` (${dim.label || dim.name})`}
                    </option>
                  )
                }) || []}
              </select>
            </div>
          </div>

          {selectedChart && (
            <div style={{ marginTop: 12, padding: 12, background: '#16213e', borderRadius: 4 }}>
              <div style={{ color: '#aaa', fontSize: 13 }}>
                <strong>已选择:</strong> {translateChartId(selectedChart.id)} - {
                  translateDimension(
                    selectedChart.dimensions.find((d) => d.name === selectedDimensionName)?.name || '',
                    selectedChart.id
                  )
                }
                {selectedChart.units && ` [${selectedChart.units}]`}
              </div>
              <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
                原始ID: {selectedChart.id} · 分类: {selectedChart.family}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
