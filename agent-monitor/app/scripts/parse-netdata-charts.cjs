/**
 * 从 charts.json（Netdata /api/v1/charts 的响应）解析出 CPU、内存、磁盘的 chart id 与 dimensions，
 * 写入 src/data/netdata-chart-ids.json 供前端拉取 Netdata 指标时使用。
 * 使用：node scripts/parse-netdata-charts.cjs
 */
const fs = require('fs')
const path = require('path')

const chartsPath = path.join(__dirname, '..', 'charts.json')
const outPath = path.join(__dirname, '..', 'src', 'data', 'netdata-chart-ids.json')

let raw
try {
  raw = JSON.parse(fs.readFileSync(chartsPath, 'utf8'))
} catch (e) {
  console.error('Failed to read charts.json:', e.message)
  process.exit(1)
}

const charts = raw.charts || {}
const result = { cpu: null, ram: null, disk: [] }

for (const [chartId, chart] of Object.entries(charts)) {
  if (!chart || typeof chart !== 'object') continue
  const id = chart.id || chartId
  const context = (chart.context || '').toLowerCase()
  const type = (chart.type || '').toLowerCase()
  const units = chart.units || ''
  const dims = chart.dimensions || {}
  const dimensionIds = Object.keys(dims)

  if (id === 'system.cpu' && (context === 'system.cpu' || type === 'system')) {
    result.cpu = {
      id: 'system.cpu',
      units: units || 'percentage',
      dimensions: dimensionIds,
      hasIdle: dimensionIds.some((d) => d.toLowerCase() === 'idle'),
    }
  }
  if (id === 'system.ram' && (context === 'system.ram' || type === 'system')) {
    result.ram = {
      id: 'system.ram',
      units: units || 'MiB',
      dimensions: dimensionIds,
    }
  }
  if (type === 'disk_space' || (context === 'disk.space' && id.startsWith('disk_space.'))) {
    result.disk.push({
      id,
      units: units || 'GiB',
      dimensions: dimensionIds,
      mount_root: chart.chart_labels?.mount_root,
      mount_point: chart.chart_labels?.mount_point,
    })
  }
}

const output = {
  cpu: result.cpu || { id: 'system.cpu', units: 'percentage', dimensions: ['user', 'system', 'nice', 'iowait', 'irq', 'softirq', 'steal', 'guest', 'guest_nice'] },
  ram: result.ram || { id: 'system.ram', units: 'MiB', dimensions: ['free', 'used', 'cached', 'buffers'] },
  disk: {
    units: 'GiB',
    dimensions: ['used', 'avail'],
    chartIds: result.disk.map((d) => d.id).filter(Boolean),
    exampleIds: result.disk.slice(0, 8).map((d) => d.id),
  },
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8')
console.log('Wrote', outPath)
console.log('CPU:', output.cpu.id, output.cpu.dimensions?.length, 'dims')
console.log('RAM:', output.ram.id, output.ram.dimensions?.length, 'dims')
console.log('Disk charts:', output.disk.chartIds?.length || 0)
