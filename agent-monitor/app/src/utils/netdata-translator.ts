import translations from '@/data/netdata-chart-translations.json'

const ifaceTypes: Record<string, string> = {
  'eth': '以太网',
  'ens': '以太网',
  'enp': '以太网',
  'wlan': '无线',
  'wifi': '无线',
  'wwan': '移动网络',
  'docker': 'Docker',
  'br-': '网桥',
  'veth': '虚拟网卡',
  'lo': '本地回环',
  'tun': '隧道',
  'tap': '虚拟网卡',
  'virbr': '虚拟网桥',
  'vmbr': '虚拟机网桥',
  'ppp': '点对点',
}

const fsTypes: Record<string, string> = {
  'dev': '设备',
  'run': '运行',
  'sys': '系统',
  'proc': '进程',
  'tmp': '临时',
  'boot': '启动',
  'home': '用户',
  'var': '变量',
  'root': '根目录',
  'mnt': '挂载',
  'media': '媒体',
  'srv': '服务',
  'opt': '可选',
  'usr': '用户程序',
}

export function translateChartId(chartId: string): string {
  if (translations[chartId as keyof typeof translations]) {
    return translations[chartId as keyof typeof translations]
  }

  if (chartId.startsWith('net.')) {
    const iface = chartId.slice(4)
    let type = '网络接口'
    for (const [prefix, label] of Object.entries(ifaceTypes)) {
      if (iface.startsWith(prefix)) {
        type = label
        break
      }
    }
    return `${type} (${iface})`
  }

  if (chartId.includes('disk_space')) {
    const match = chartId.match(/disk_space[._](.+)/)
    if (match) {
      const path = match[1]
      let label = path
      for (const [prefix, fsLabel] of Object.entries(fsTypes)) {
        if (path.startsWith(prefix)) {
          label = fsLabel
          break
        }
      }
      return `磁盘空间: ${label} (${path})`
    }
    return '磁盘空间'
  }

  if (chartId.startsWith('apps.')) {
    const app = chartId.slice(5).replace(/\./g, ' ')
    return `应用: ${app}`
  }

  if (chartId.startsWith('docker.')) {
    const rest = chartId.slice(7).replace(/\./g, ' ')
    return `Docker: ${rest}`
  }

  if (chartId.startsWith('cgroup.')) {
    const rest = chartId.slice(7).replace(/\./g, ' ')
    return `控制组: ${rest}`
  }

  if (chartId.startsWith('nvidia.')) {
    const rest = chartId.slice(7).replace(/\./g, ' ')
    return `NVIDIA: ${rest}`
  }

  if (chartId.startsWith('sensors.')) {
    const rest = chartId.slice(8).replace(/\./g, ' ')
    return `传感器: ${rest}`
  }

  if (chartId.startsWith('coretemp.')) {
    return 'CPU核心温度'
  }

  if (chartId.startsWith('intel_power.')) {
    return 'Intel电源'
  }

  if (chartId.startsWith('amdgpu.')) {
    return 'AMD显卡'
  }

  if (chartId.startsWith('radeon.')) {
    return 'AMD显卡'
  }

  if (chartId.startsWith('i915.')) {
    return 'Intel显卡'
  }

  if (chartId.startsWith('smart.')) {
    return 'SMART磁盘'
  }

  if (chartId.startsWith('mdstat.')) {
    return 'MD软RAID'
  }

  if (chartId.startsWith('zfs.')) {
    return 'ZFS文件系统'
  }

  if (chartId.startsWith('zpool.')) {
    return 'ZFS存储池'
  }

  if (chartId.includes('ipv4.')) {
    const rest = chartId.slice(5).replace(/\./g, ' ')
    return `IPv4: ${rest}`
  }

  if (chartId.includes('ipv6.')) {
    const rest = chartId.slice(5).replace(/\./g, ' ')
    return `IPv6: ${rest}`
  }

  if (chartId.includes('tcp.')) {
    const rest = chartId.slice(4).replace(/\./g, ' ')
    return `TCP: ${rest}`
  }

  if (chartId.includes('udp.')) {
    const rest = chartId.slice(4).replace(/\./g, ' ')
    return `UDP: ${rest}`
  }

  if (chartId.includes('mem.')) {
    const rest = chartId.slice(4).replace(/\./g, ' ')
    return `内存: ${rest}`
  }

  if (chartId.includes('cpu') && chartId !== 'system.cpu') {
    const rest = chartId.replace(/cpu/g, '').replace(/\./g, ' ').trim()
    return rest ? `CPU: ${rest}` : 'CPU'
  }

  if (chartId.includes('disk') && !chartId.includes('disk_space') && !chartId.includes('disk_io')) {
    const rest = chartId.replace(/disk/g, '').replace(/\./g, ' ').trim()
    return rest ? `磁盘: ${rest}` : '磁盘'
  }

  for (const [key, value] of Object.entries(translations)) {
    if (key.endsWith('.') && chartId.startsWith(key.slice(0, -1))) {
      const suffix = chartId.slice(key.length - 1)
      if (suffix) {
        return `${value} (${suffix.replace(/^\./, '')})`
      }
      return value
    }
  }

  return chartId
    .replace(/\./g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function translateDimension(dimName: string, _chartId?: string): string {
  const commonDims: Record<string, string> = {
    'used': '已用',
    'free': '空闲',
    'available': '可用',
    'avail': '可用',
    'cached': '缓存',
    'buffers': '缓冲区',
    'buf': '缓冲区',
    'total': '总计',
    'user': '用户',
    'system': '系统',
    'nice': 'Nice',
    'idle': '空闲',
    'iowait': 'IO等待',
    'irq': '硬件中断',
    'softirq': '软件中断',
    'steal': '被偷取',
    'guest': '访客',
    'guest_nice': '访客Nice',
    'inbound': '入站',
    'outbound': '出站',
    'received': '接收',
    'sent': '发送',
    'rx': '接收',
    'rx_bytes': '接收字节',
    'rx_packets': '接收包',
    'rx_errors': '接收错误',
    'rx_dropped': '接收丢弃',
    'tx': '发送',
    'tx_bytes': '发送字节',
    'tx_packets': '发送包',
    'tx_errors': '发送错误',
    'tx_dropped': '发送丢弃',
    'reads': '读取',
    'writes': '写入',
    'read': '读取',
    'write': '写入',
    'utilization': '使用率',
    'util': '使用率',
    'usage': '使用率',
    'percentage': '百分比',
    'percent': '百分比',
    'temperature': '温度',
    'temp': '温度',
    'temp1': '温度1',
    'temp2': '温度2',
    'temp3': '温度3',
    'power': '电源',
    'voltage': '电压',
    'fan': '风扇',
    'speed': '速度',
    'rpm': '转速',
    'frequency': '频率',
    'freq': '频率',
    'load': '负载',
    'load1': '1分钟负载',
    'load5': '5分钟负载',
    'load15': '15分钟负载',
    'running': '运行中',
    'blocked': '已阻塞',
    'zombies': '僵尸进程',
    'processes': '进程数',
    'threads': '线程数',
    'connections': '连接数',
    'sockets': '套接字数',
    'established': '已建立',
    'syn_sent': 'SYN已发送',
    'syn_recv': 'SYN已接收',
    'fin_wait1': 'FIN等待1',
    'fin_wait2': 'FIN等待2',
    'time_wait': '时间等待',
    'closed': '已关闭',
    'close_wait': '关闭等待',
    'last_ack': '最后确认',
    'listen': '监听中',
    'listening': '监听中',
    'closing': '关闭中',
    'active': '活跃',
    'passive': '被动',
    'estab': '已建立',
  }

  const lowerDim = dimName.toLowerCase()
  if (commonDims[lowerDim]) {
    return commonDims[lowerDim]
  }

  if (/^cpu\d+$/.test(dimName)) {
    const num = dimName.replace('cpu', '')
    return `CPU${num}`
  }

  if (/^core\d+$/.test(dimName)) {
    const num = dimName.replace('core', '')
    return `核心${num}`
  }

  if (/^\d+$/.test(dimName)) {
    return dimName
  }

  return dimName
    .replace(/_/g, ' ')
    .replace(/\./g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
