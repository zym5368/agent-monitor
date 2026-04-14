import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface MoreMenuItem {
  id: string
  label: string
  subtitle?: string
  icon: string
  path?: string
  action?: (() => void) | null
}

export function MobileMore() {
  const menuItems: MoreMenuItem[] = [
    {
      id: 'servers',
      label: '服务器管理',
      subtitle: '添加、删除服务器',
      icon: 'servers',
      path: '/servers',
    },
    {
      id: 'alerts',
      label: '告警配置',
      subtitle: '配置告警规则和通知',
      icon: 'alerts',
      path: '/alerts',
    },
    {
      id: 'alert-history',
      label: '告警历史',
      subtitle: '查看告警记录和通知日志',
      icon: 'history',
      path: '/alert-history',
    },
    {
      id: 'dockge',
      label: 'Dockge',
      subtitle: '容器管理面板',
      icon: 'dockge',
      path: '/dockge',
    },
  ]

  const renderIcon = (name: string) => {
    const color = '#64748b'
    const icons: Record<string, ReactNode> = {
      servers: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
      alerts: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
      history: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <polyline points="14 2 18 6 7 17 3 17 3 13 14 2" />
          <line x1="3" y1="22" x2="21" y2="22" />
        </svg>
      ),
      dockge: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z" />
          <path d="M8 12h8" />
          <path d="M12 8v8" />
        </svg>
      ),
    }
    return icons[name] || icons.servers
  }

  return (
    <div className="mobile-page mobile-page-enter">
      <div className="mobile-page-header">
        <h1 className="mobile-page-title">更多</h1>
        <p className="mobile-page-subtitle">服务器管理、告警配置等</p>
      </div>

      {menuItems.map((item) => (
        <Link
          key={item.id}
          to={item.path || '#'}
          className="mobile-list-item"
          style={{ textDecoration: 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(71, 85, 105, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {renderIcon(item.icon)}
            </div>
            <div className="mobile-list-item-main">
              <p className="mobile-list-item-title">{item.label}</p>
              {item.subtitle && <p className="mobile-list-item-subtitle">{item.subtitle}</p>}
            </div>
          </div>
          <div className="mobile-list-item-chevron">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </Link>
      ))}

      <div style={{ marginTop: 40, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
        <p style={{ margin: 0 }}>集群管理 - 移动端</p>
        <p style={{ margin: '4px 0 0' }}>v0.1.0</p>
      </div>
    </div>
  )
}
