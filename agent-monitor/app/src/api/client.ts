import type { Server, NetdataChartInfo, NetdataDimensionInfo } from '@/shared/types'
import type { MetricsResponse } from '@/shared/types'
import netdataCharts from '@/data/netdata-chart-ids.json'

const MIB = 1024 * 1024
const GIB = 1024 * 1024 * 1024
const MIN_MEM_BYTES = 100 * MIB
const MIN_DISK_BYTES = 1 * GIB

export function agentBaseUrl(server: Server): string {
  const proto = server.host.startsWith('localhost') ? 'http' : 'http'
  // 如果 host 已经包含端口，就不重复添加
  const hostWithoutPort = server.host.replace(/:\d+$/, '')
  return `${proto}://${hostWithoutPort}:${server.port}`
}

export function agentHeaders(server: Server): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' }
  if (server.apiKey) (h as Record<string, string>)['X-API-Key'] = server.apiKey
  return h
}

/** 是否使用 Netdata 作为数据源 */
function useNetdata(server: Server): boolean {
  const ds = server.dataSource ?? 'agent'
  return ds === 'netdata' && !!server.netdataUrl?.trim()
}

export async function fetchHealth(server: Server): Promise<boolean> {
  try {
    if (useNetdata(server)) {
      const base = (server.netdataUrl ?? '').replace(/\/$/, '')
      const r = await fetch(`${base}/api/v1/info`, { method: 'GET' })
      return r.ok
    }
    const r = await fetch(`${agentBaseUrl(server)}/health`, { method: 'GET' })
    return r.ok
  } catch {
    return false
  }
}

export async function fetchMetrics(server: Server): Promise<MetricsResponse | null> {
  console.log('[fetchMetrics] server:', {
    name: server.name,
    dataSource: server.dataSource,
    host: server.host,
    port: server.port,
    useNetdata: useNetdata(server),
  })
  if (useNetdata(server)) {
    console.log('[fetchMetrics] using Netdata')
    return fetchMetricsFromNetdata(server.netdataUrl!.trim())
  }
  try {
    const url = `${agentBaseUrl(server)}/api/metrics`
    console.log('[fetchMetrics] fetching from:', url)
    const r = await fetch(url, { headers: agentHeaders(server) })
    console.log('[fetchMetrics] response ok:', r.ok)
    if (!r.ok) return null
    const data = await r.json()
    console.log('[fetchMetrics] data:', data)
    return data as MetricsResponse
  } catch (err) {
    console.error('[fetchMetrics] error:', err)
    return null
  }
}

/**
 * 从 Netdata 拉取指标：先试 /api/v1/allmetrics?format=json，若结果不合理则用 /api/v1/data 按 chart 拉取。
 */
async function fetchMetricsFromNetdata(baseUrl: string): Promise<MetricsResponse | null> {
  const base = baseUrl.replace(/\/$/, '')
  try {
    const r = await fetch(`${base}/api/v1/allmetrics?format=json`)
    if (!r.ok) return null
    const raw = (await r.json()) as Record<string, unknown>
    const out = parseNetdataAllmetrics(raw)
    if (out && out.memory_total_bytes >= MIN_MEM_BYTES) return out
    return await fetchNetdataByCharts(base)
  } catch {
    return fetchNetdataByCharts(base)
  }
}

/** 用 /api/v1/data 按 chart 拉取，chart id 来自 charts.json 解析结果（netdata-chart-ids.json）。 */
async function fetchNetdataByCharts(base: string): Promise<MetricsResponse | null> {
  try {
    const cpuId = (netdataCharts as { cpu?: { id: string } }).cpu?.id ?? 'system.cpu'
    const ramId = (netdataCharts as { ram?: { id: string } }).ram?.id ?? 'system.ram'
    const diskIds = (netdataCharts as { disk?: { exampleIds?: string[] } }).disk?.exampleIds ?? ['disk_space._dev', 'disk_space._run']

    const [cpuR, ramR, ...diskRs] = await Promise.all([
      fetch(`${base}/api/v1/data?chart=${encodeURIComponent(cpuId)}&points=1&format=json`),
      fetch(`${base}/api/v1/data?chart=${encodeURIComponent(ramId)}&points=1&format=json`),
      ...diskIds.map((id) => fetch(`${base}/api/v1/data?chart=${encodeURIComponent(id)}&points=1&format=json`)),
    ])
    let cpuPercent = 0
    let memUsedBytes = 0
    let memTotalBytes = 0
    let diskUsedBytes = 0
    let diskTotalBytes = 0

    if (cpuR.ok) {
      const cpuJ = (await cpuR.json()) as { labels?: string[]; data?: unknown[][] }
      const labels = (cpuJ.labels ?? []).map((l) => String(l).toLowerCase())
      const data = cpuJ.data ?? []
      const idleIdx = labels.indexOf('idle')
      if (idleIdx >= 0 && data.length > 0 && Array.isArray(data[0]) && data[0][idleIdx] != null) {
        const idle = Number(data[0][idleIdx])
        if (idle >= 0 && idle <= 100) cpuPercent = 100 - idle
      } else {
        const sumDims = (netdataCharts as { cpu?: { dimensions?: string[] } }).cpu?.dimensions ?? ['user', 'system', 'nice', 'iowait', 'irq', 'softirq', 'steal', 'guest', 'guest_nice']
        let sum = 0
        for (const dim of sumDims) {
          const i = labels.indexOf(dim.toLowerCase())
          if (i >= 0 && data.length > 0 && Array.isArray(data[0]) && data[0][i] != null) sum += Number(data[0][i])
        }
        if (sum > 0 && sum <= 100) cpuPercent = sum
      }
    }
    if (ramR.ok) {
      const ramJ = (await ramR.json()) as { labels?: string[]; data?: unknown[][] }
      const labels = ramJ.labels ?? []
      const data = ramJ.data ?? []
      const idx = (name: string) => labels.findIndex((l) => l.toLowerCase() === name.toLowerCase())
      const usedI = idx('used')
      const freeI = idx('free')
      const cachedI = idx('cached')
      const bufI = idx('buffers')
      if (data.length > 0 && Array.isArray(data[0])) {
        const row = data[0]
        const used = Number(usedI >= 0 ? row[usedI] : 0)
        const free = Number(freeI >= 0 ? row[freeI] : 0)
        const cached = Number(cachedI >= 0 ? row[cachedI] : 0)
        const buf = Number(bufI >= 0 ? row[bufI] : 0)
        const totalMiB = used + free + cached + buf
        if (totalMiB > 0) {
          memTotalBytes = Math.round(totalMiB * MIB)
          memUsedBytes = Math.round((used + cached + buf) * MIB)
        }
      }
    }
    for (const diskR of diskRs) {
      if (!diskR.ok) continue
      const diskJ = (await diskR.json()) as { labels?: string[]; data?: unknown[][] }
      const labels = diskJ.labels ?? []
      const data = diskJ.data ?? []
      const idx = (name: string) => labels.findIndex((l) => String(l).toLowerCase() === name.toLowerCase())
      const usedI = idx('used')
      const availI = idx('avail')
      if (data.length > 0 && Array.isArray(data[0])) {
        const row = data[0]
        const used = Number(usedI >= 0 ? row[usedI] : 0)
        const avail = Number(availI >= 0 ? row[availI] : 0)
        const totalGiB = used + avail
        if (totalGiB > 0) {
          const totalB = Math.round(totalGiB * GIB)
          if (totalB > diskTotalBytes) {
            diskTotalBytes = totalB
            diskUsedBytes = Math.round(used * GIB)
          }
        }
      }
    }
    if (memTotalBytes < MIN_MEM_BYTES && diskTotalBytes < MIN_DISK_BYTES && cpuPercent === 0) return null
    const memoryPercent = memTotalBytes > 0 ? (memUsedBytes / memTotalBytes) * 100 : 0
    const diskPercent = diskTotalBytes > 0 ? (diskUsedBytes / diskTotalBytes) * 100 : 0
    return {
      cpu_percent: cpuPercent,
      memory_used_bytes: memUsedBytes,
      memory_total_bytes: memTotalBytes,
      memory_percent: memoryPercent,
      disk_used_bytes: diskUsedBytes,
      disk_total_bytes: diskTotalBytes,
      disk_percent: diskPercent,
    }
  } catch {
    return null
  }
}

/** Netdata allmetrics JSON：优先使用 system.ram / system.cpu / disk.space，并按文档单位换算。 */
function parseNetdataAllmetrics(raw: Record<string, unknown>): MetricsResponse | null {
  const charts = (raw.charts ?? raw) as Record<string, unknown>
  if (!charts || typeof charts !== 'object') return null

  let cpuPercent = 0
  let memUsedBytes = 0
  let memTotalBytes = 0
  let diskUsedBytes = 0
  let diskTotalBytes = 0
  let cpuTemp: number | undefined
  let gpuUtil = 0
  let gpuMemUsed = 0
  let gpuMemTotal = 0
  let gpuTemp = 0

  const num = (v: unknown): number => (typeof v === 'number' && !Number.isNaN(v) ? v : 0)
  const last = (arr: unknown): number => (Array.isArray(arr) && arr.length > 0 ? num(arr[arr.length - 1]) : 0)
  const fromDim = (d: unknown): number => {
    if (typeof d === 'number') return d
    if (Array.isArray(d)) return last(d)
    if (d && typeof d === 'object' && 'value' in (d as object)) return num((d as { value: unknown }).value)
    return 0
  }

  const dimVal = (dims: Record<string, unknown>, key: string): number => fromDim(dims[key])
  const tryKeys = (dims: Record<string, unknown>, ...keys: string[]): number => {
    for (const k of keys) {
      const v = dimVal(dims, k)
      if (v > 0 || k.toLowerCase() === 'idle') return v
    }
    return 0
  }

  for (const [chartId, chart] of Object.entries(charts)) {
    if (!chart || typeof chart !== 'object') continue
    const c = chart as Record<string, unknown>
    const dims = (c.dimensions ?? c.result ?? c) as Record<string, unknown>
    if (!dims || typeof dims !== 'object') continue

    const id = chartId.toLowerCase()

    // 只认 system.ram / system.memory，单位 MiB；total = used + free + cached + buffers
    if (id === 'system.ram' || id === 'system.memory' || id === 'system.ram') {
      const used = tryKeys(dims, 'used', 'Used')
      const free = tryKeys(dims, 'free', 'Free')
      const cached = tryKeys(dims, 'cached', 'Cached')
      const buffers = tryKeys(dims, 'buffers', 'Buffers')
      const totalMiB = used + free + cached + buffers
      if (totalMiB <= 0) continue
      const totalBytes = Math.round(totalMiB * MIB)
      if (totalBytes < MIN_MEM_BYTES) continue
      memTotalBytes = totalBytes
      memUsedBytes = Math.round((used + cached + buffers) * MIB)
      if (memUsedBytes <= 0) memUsedBytes = Math.round(used * MIB)
    }

    // CPU：优先 system.cpu / cpu.cpu，100 - idle
    if ((id === 'system.cpu' || id === 'cpu.cpu') && !id.includes('gpu')) {
      const idle = dimVal(dims, 'idle') || dimVal(dims, 'IDLE')
      const user = dimVal(dims, 'user') || dimVal(dims, 'USER')
      const system = dimVal(dims, 'system') || dimVal(dims, 'SYSTEM')
      if (idle >= 0 && idle <= 100) cpuPercent = Math.min(100, Math.max(0, 100 - idle))
      else if (user >= 0 || system >= 0) cpuPercent = Math.min(100, user + system)
    }

    // 磁盘：disk.space / disk_space，单位通常 GiB；取总量最大的挂载
    if ((id.includes('disk.space') || id.includes('disk_space')) && !id.includes('io') && !id.includes('iops')) {
      const used = tryKeys(dims, 'used', 'Used')
      const avail = tryKeys(dims, 'avail', 'Avail', 'free', 'Free')
      const totalGiB = used + avail
      if (totalGiB <= 0) continue
      const totalBytes = Math.round(totalGiB * GIB)
      if (totalBytes < MIN_DISK_BYTES) continue
      if (totalBytes > diskTotalBytes) {
        diskTotalBytes = totalBytes
        diskUsedBytes = Math.round(used * GIB)
      }
    }

    // CPU 温度
    if ((id.includes('temperature') || id.includes('temp')) && !id.includes('gpu')) {
      const t = tryKeys(dims, 'value', 'temperature', 'temp')
      if (t > 0 && t < 150) cpuTemp = t
    }
    // GPU
    if (id.includes('gpu') || id.includes('nvidia')) {
      gpuUtil = tryKeys(dims, 'utilization', 'usage', 'user') || gpuUtil
      const gpuMemU = tryKeys(dims, 'used', 'memory_used')
      const gpuMemT = tryKeys(dims, 'memory_total', 'total', 'memory_total_bytes')
      if (gpuMemT > 0) {
        gpuMemTotal = gpuMemT
        gpuMemUsed = gpuMemU > 0 ? gpuMemU : gpuMemTotal - dimVal(dims, 'free')
      }
      const gt = tryKeys(dims, 'temperature', 'temp', 'value')
      if (gt > 0 && gt < 150) gpuTemp = gt
    }
  }

  // 若未匹配到 system.ram，尝试任意含 ram/mem 的 chart 且总量合理（>100MB）
  if (memTotalBytes < MIN_MEM_BYTES) {
    for (const [chartId, chart] of Object.entries(charts)) {
      if (!chart || typeof chart !== 'object') continue
      const c = chart as Record<string, unknown>
      const dims = (c.dimensions ?? c.result ?? c) as Record<string, unknown>
      if (!dims || typeof dims !== 'object') continue
      const id = chartId.toLowerCase()
      if (!id.includes('ram') && !id.includes('mem') && !id.includes('memory')) continue
      const used = tryKeys(dims, 'used', 'Used')
      const free = tryKeys(dims, 'free', 'Free')
      const cached = tryKeys(dims, 'cached', 'Buffers')
      const total = used + free + cached || tryKeys(dims, 'total', 'Total')
      if (total <= 0) continue
      const totalB = total < 1e6 ? Math.round(total * MIB) : Math.round(total)
      if (totalB < MIN_MEM_BYTES) continue
      memTotalBytes = totalB
      memUsedBytes = used > 0 ? (used < 1e6 ? Math.round(used * MIB) : Math.round(used)) : totalB - (free < 1e6 ? Math.round(free * MIB) : Math.round(free))
      break
    }
  }

  if (memTotalBytes === 0 && memUsedBytes === 0 && cpuPercent === 0 && diskTotalBytes === 0) return null

  const memoryPercent = memTotalBytes > 0 ? (memUsedBytes / memTotalBytes) * 100 : 0
  const diskPercent = diskTotalBytes > 0 ? (diskUsedBytes / diskTotalBytes) * 100 : 0

  const out: MetricsResponse = {
    cpu_percent: cpuPercent,
    memory_used_bytes: memUsedBytes,
    memory_total_bytes: memTotalBytes,
    memory_percent: memoryPercent,
    disk_used_bytes: diskUsedBytes,
    disk_total_bytes: diskTotalBytes,
    disk_percent: diskPercent,
  }
  if (cpuTemp != null) out.cpu_temperature_c = cpuTemp
  if (gpuUtil > 0 || gpuMemTotal > 0) {
    const gpuMemTotalB = gpuMemTotal < 1e6 ? Math.round(gpuMemTotal * MIB) : Math.round(gpuMemTotal)
    const gpuMemUsedB = gpuMemUsed < 1e6 ? Math.round(gpuMemUsed * MIB) : Math.round(gpuMemUsed)
    out.gpu = {
      utilization_percent: gpuUtil,
      memory_used_bytes: gpuMemUsedB,
      memory_total_bytes: gpuMemTotalB,
      temperature_c: gpuTemp,
    }
  }
  return out
}

/** 从Netdata获取所有可用的charts */
export async function fetchNetdataCharts(netdataUrl: string): Promise<NetdataChartInfo[]> {
  const base = netdataUrl.replace(/\/$/, '')
  try {
    const r = await fetch(`${base}/api/v1/charts`)
    if (!r.ok) return []
    const data = await r.json()

    const charts: NetdataChartInfo[] = []
    const chartsData = data.charts || data

    for (const [chartId, chartInfo] of Object.entries(chartsData)) {
      if (!chartInfo || typeof chartInfo !== 'object') continue

      const c = chartInfo as Record<string, unknown>
      const dimensionsData = c.dimensions || {}

      const dimensions: NetdataDimensionInfo[] = []
      for (const [dimName, dimInfo] of Object.entries(dimensionsData)) {
        if (!dimInfo || typeof dimInfo !== 'object') continue
        const d = dimInfo as Record<string, unknown>
        dimensions.push({
          name: dimName,
          label: (d.name as string) || dimName,
        })
      }

      charts.push({
        id: chartId,
        name: (c.name as string) || chartId,
        title: (c.title as string) || chartId,
        units: (c.units as string) || '',
        family: (c.family as string) || '',
        dimensions,
      })
    }

    return charts.sort((a, b) => a.title.localeCompare(b.title))
  } catch {
    return []
  }
}

/** 从Netdata获取指定chart的最新数据点 */
export async function fetchNetdataChartData(
  netdataUrl: string,
  chartId: string,
  points: number = 1
): Promise<{ labels: string[]; data: unknown[][] } | null> {
  const base = netdataUrl.replace(/\/$/, '')
  try {
    const r = await fetch(
      `${base}/api/v1/data?chart=${encodeURIComponent(chartId)}&points=${points}&format=json`
    )
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

/** 从Netdata chart数据中获取指定dimension的最新值 */
export function getNetdataDimensionValue(
  chartData: { labels: string[]; data: unknown[][] },
  dimensionName: string
): number | null {
  const labels = chartData.labels || []
  const data = chartData.data || []

  const dimIndex = labels.findIndex(
    (l) => l.toLowerCase() === dimensionName.toLowerCase()
  )

  if (dimIndex < 0 || data.length === 0 || !Array.isArray(data[0])) {
    return null
  }

  const value = data[0][dimIndex]
  if (value == null) return null

  const num = Number(value)
  return Number.isNaN(num) ? null : num
}

import type { ContainerInfo, DockerImageInfo, DockerOverview, SystemInfo } from '@/shared/types'

export async function fetchContainers(server: Server): Promise<ContainerInfo[] | null> {
  try {
    const r = await fetch(`${agentBaseUrl(server)}/api/containers`, { headers: agentHeaders(server) })
    if (!r.ok) return null
    const data = await r.json()
    return data.containers || []
  } catch {
    return null
  }
}

export async function startContainer(server: Server, id: string): Promise<boolean> {
  try {
    const r = await fetch(`${agentBaseUrl(server)}/api/containers/${id}/start`, {
      method: 'POST',
      headers: agentHeaders(server),
    })
    return r.ok
  } catch {
    return false
  }
}

export async function stopContainer(server: Server, id: string): Promise<boolean> {
  try {
    const r = await fetch(`${agentBaseUrl(server)}/api/containers/${id}/stop`, {
      method: 'POST',
      headers: agentHeaders(server),
    })
    return r.ok
  } catch {
    return false
  }
}

export async function restartContainer(server: Server, id: string): Promise<boolean> {
  try {
    const r = await fetch(`${agentBaseUrl(server)}/api/containers/${id}/restart`, {
      method: 'POST',
      headers: agentHeaders(server),
    })
    return r.ok
  } catch {
    return false
  }
}

export async function removeContainer(server: Server, id: string, force = false): Promise<boolean> {
  try {
    const url = new URL(`${agentBaseUrl(server)}/api/containers/${id}`)
    if (force) url.searchParams.set('force', 'true')
    const r = await fetch(url.toString(), {
      method: 'DELETE',
      headers: agentHeaders(server),
    })
    return r.ok
  } catch {
    return false
  }
}

export async function fetchContainerLogs(server: Server, id: string, tail = '100'): Promise<string | null> {
  try {
    const url = new URL(`${agentBaseUrl(server)}/api/containers/${id}/logs`)
    url.searchParams.set('tail', tail)
    const r = await fetch(url.toString(), { headers: agentHeaders(server) })
    if (!r.ok) return null
    const data = await r.json()
    return data.logs || ''
  } catch {
    return null
  }
}

export async function fetchDockerOverview(server: Server): Promise<DockerOverview | null> {
  try {
    const r = await fetch(`${agentBaseUrl(server)}/api/docker/overview`, { headers: agentHeaders(server) })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

export async function fetchImages(server: Server): Promise<DockerImageInfo[] | null> {
  try {
    const r = await fetch(`${agentBaseUrl(server)}/api/images`, { headers: agentHeaders(server) })
    if (!r.ok) return null
    const data = await r.json()
    return data.images || []
  } catch {
    return null
  }
}

export async function removeImage(server: Server, ref: string, force = false): Promise<boolean> {
  try {
    const url = new URL(`${agentBaseUrl(server)}/api/images`)
    url.searchParams.set('ref', ref)
    if (force) url.searchParams.set('force', 'true')
    const r = await fetch(url.toString(), {
      method: 'DELETE',
      headers: agentHeaders(server),
    })
    return r.ok
  } catch {
    return false
  }
}

export async function fetchSystemInfo(server: Server): Promise<SystemInfo | null> {
  try {
    const r = await fetch(`${agentBaseUrl(server)}/api/system/info`, { headers: agentHeaders(server) })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

import type { ServiceInfo } from '@/shared/types'

export async function fetchServices(server: Server): Promise<ServiceInfo[] | null> {
  try {
    const r = await fetch(`${agentBaseUrl(server)}/api/services`, { headers: agentHeaders(server) })
    if (!r.ok) return null
    const data = await r.json()
    return data.services || []
  } catch {
    return null
  }
}

export async function startService(server: Server, name: string): Promise<boolean> {
  try {
    const r = await fetch(`${agentBaseUrl(server)}/api/services/${name}/start`, {
      method: 'POST',
      headers: agentHeaders(server),
    })
    return r.ok
  } catch {
    return false
  }
}

export async function stopService(server: Server, name: string): Promise<boolean> {
  try {
    const r = await fetch(`${agentBaseUrl(server)}/api/services/${name}/stop`, {
      method: 'POST',
      headers: agentHeaders(server),
    })
    return r.ok
  } catch {
    return false
  }
}

export async function restartService(server: Server, name: string): Promise<boolean> {
  try {
    const r = await fetch(`${agentBaseUrl(server)}/api/services/${name}/restart`, {
      method: 'POST',
      headers: agentHeaders(server),
    })
    return r.ok
  } catch {
    return false
  }
}

export async function enableService(server: Server, name: string): Promise<boolean> {
  try {
    const r = await fetch(`${agentBaseUrl(server)}/api/services/${name}/enable`, {
      method: 'POST',
      headers: agentHeaders(server),
    })
    return r.ok
  } catch {
    return false
  }
}

export async function disableService(server: Server, name: string): Promise<boolean> {
  try {
    const r = await fetch(`${agentBaseUrl(server)}/api/services/${name}/disable`, {
      method: 'POST',
      headers: agentHeaders(server),
    })
    return r.ok
  } catch {
    return false
  }
}

export async function updateServiceSubscription(server: Server, name: string): Promise<boolean> {
  try {
    const r = await fetch(`${agentBaseUrl(server)}/api/services/${name}/update-subscription`, {
      method: 'POST',
      headers: agentHeaders(server),
    })
    if (!r.ok) return false
    const data = await r.json()
    return Boolean(data?.success)
  } catch {
    return false
  }
}

export interface ServiceSubscriptionUpdateResult {
  service: string
  success: boolean
  status: 'success' | 'failed' | 'partial' | 'unknown'
  script?: string
  script_tried?: string[]
  log_file?: string
  log_excerpt?: string
  output?: string
  error?: string
}

export async function updateServiceSubscriptionDetailed(
  server: Server,
  name: string,
): Promise<ServiceSubscriptionUpdateResult | null> {
  try {
    const r = await fetch(`${agentBaseUrl(server)}/api/services/${name}/update-subscription`, {
      method: 'POST',
      headers: agentHeaders(server),
    })
    if (!r.ok) return null
    const data = (await r.json()) as ServiceSubscriptionUpdateResult
    return data
  } catch {
    return null
  }
}
