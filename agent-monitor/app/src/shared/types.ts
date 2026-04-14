/** 指标数据源：agent=自建 Agent，netdata=Netdata API */
export type DataSource = 'agent' | 'netdata'

export interface Server {
  id: string
  name: string
  /** 数据源，缺省为 agent */
  dataSource?: DataSource
  host: string
  port: number
  apiKey: string
  /** Netdata 地址，如 http://192.168.1.10:19999（dataSource=netdata 时使用） */
  netdataUrl?: string
  dockgeUrl: string
}

export interface GPUInfo {
  utilization_percent: number
  memory_used_bytes: number
  memory_total_bytes: number
  temperature_c: number
}

export interface DiskMountInfo {
  path: string
  used_bytes: number
  total_bytes: number
  used_percent: number
}

export interface MetricsResponse {
  cpu_percent: number
  cpu_temperature_c?: number
  memory_used_bytes: number
  memory_total_bytes: number
  memory_percent: number
  disk_used_bytes: number
  disk_total_bytes: number
  disk_percent: number
  disk_mounts?: DiskMountInfo[]
  gpu?: GPUInfo
}

/** 告警指标类型 - 预设快速选项 */
export type AlertMetric = 'cpu' | 'memory' | 'disk' | 'gpu' | 'cpu_temp' | 'gpu_temp'

/** 告警比较条件 */
export type AlertCondition = 'above' | 'below'

/** 告警级别 */
export type AlertLevel = 'warning' | 'critical'

/** Netdata Chart 信息 */
export interface NetdataChartInfo {
  id: string
  name: string
  title: string
  units: string
  family: string
  dimensions: NetdataDimensionInfo[]
}

/** Netdata Dimension 信息 */
export interface NetdataDimensionInfo {
  name: string
  label?: string
}

/** 告警规则 - 支持预设指标和自定义Netdata指标 */
export interface AlertRule {
  id: string
  name: string
  serverId?: string // 如果为空，则应用到所有服务器

  /** 预设指标类型 (与自定义指标二选一) */
  metric?: AlertMetric

  /** 自定义Netdata指标配置 (与预设指标二选一) */
  netdataMetric?: {
    chartId: string
    dimensionName: string
    chartTitle?: string
    dimensionLabel?: string
    units?: string
  }

  condition: AlertCondition
  threshold: number
  level: AlertLevel
  enabled: boolean
  /** 连续触发多少次才告警（避免抖动） */
  consecutiveCount: number
}

/** 通知渠道类型 */
export type NotificationChannelType =
  | 'webhook'
  | 'email'
  | 'wechat'
  | 'dingtalk'
  | 'serverchan'
  | 'serverchan3'

/** 通知渠道 */
export interface NotificationChannel {
  id: string
  name: string
  type: NotificationChannelType
  config: Record<string, string>
  enabled: boolean
}

/** 告警状态 */
export type AlertStatus = 'pending' | 'firing' | 'acknowledged' | 'resolved'

/** 活跃告警 */
export interface ActiveAlert {
  id: string
  ruleId: string
  serverId: string
  serverName: string
  /** 预设指标类型或自定义指标对象 */
  metric: AlertMetric | { netdataMetric: { chartId: string; dimensionName: string } }
  /** 指标显示名称（用于自定义指标） */
  metricLabel?: string
  value: number
  threshold: number
  condition: AlertCondition
  level: AlertLevel
  status: AlertStatus
  startedAt: number
  acknowledgedAt?: number
  resolvedAt?: number
  /** 当前连续触发次数 */
  consecutiveHits: number
  /** 指标单位 */
  units?: string
}

/** 告警历史记录 */
export interface AlertHistory {
  id: string
  alertId: string
  ruleId: string
  serverId: string
  serverName: string
  metric: AlertMetric
  value: number
  threshold: number
  condition: AlertCondition
  level: AlertLevel
  event: 'firing' | 'acknowledged' | 'resolved'
  timestamp: number
  message: string
}

/** 通知记录 */
export interface NotificationLog {
  id: string
  alertId: string
  channelId: string
  channelName: string
  channelType: NotificationChannelType
  status: 'success' | 'failed'
  timestamp: number
  error?: string
}

export interface ContainerInfo {
  id: string
  name: string
  image: string
  status: string
  state: string
  ports: string[]
  created: number
}

export interface DockerPortSummaryItem {
  port: string
  used: number
  container_names?: string[]
}

export interface DockerOverview {
  containers_total: number
  containers_running: number
  images_total: number
  port_summary: DockerPortSummaryItem[]
}

export interface DockerImageInfo {
  id: string
  repo_tags: string[]
  size_bytes: number
  containers: number
  container_names?: string[]
  created_unix: number
}

export interface SystemInfo {
  hostname: string
  os: string
  platform: string
  platform_family: string
  kernel_version: string
  arch: string
  cpu_model: string
  cpu_cores: number
  total_memory_bytes: number
  uptime_seconds: number
}

export interface ServiceInfo {
  name: string
  display_name: string
  status: 'running' | 'stopped' | 'unknown'
  enabled: boolean
}
