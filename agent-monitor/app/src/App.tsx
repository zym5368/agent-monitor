import { BrowserRouter, HashRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { Containers } from './pages/Containers'
import { Dockge } from './pages/Dockge'
import { Servers } from './pages/Servers'
import { Alerts } from './pages/Alerts'
import { AlertHistory } from './pages/AlertHistory'
import { System } from './pages/System'

function NavItem({ link }: { link: { to: string; end?: boolean; label: string } }) {
  return (
    <NavLink
      to={link.to}
      end={link.end}
      className={({ isActive, isPending }) =>
        `nav-link ${isPending ? '' : isActive ? 'active' : ''}`
      }
    >
      {link.label}
    </NavLink>
  )
}

function AppShell() {
  const location = useLocation()

  const navLinks = [
    { to: '/', end: true, label: '仪表盘' },
    { to: '/containers', label: '容器管理' },
    { to: '/dockge', label: 'Dockge' },
    { to: '/servers', label: '服务器' },
    { to: '/alerts', label: '告警配置' },
    { to: '/alert-history', label: '告警历史' },
    { to: '/system', label: '系统信息' },
  ]

  return (
    <div className="page-container">
      {/* 顶部拖拽区 */}
      <div className="titlebar" />

      <div className="page-content">
        {/* 桌面端侧栏 */}
        <nav className="sidebar">
          <div className="sidebar-logo">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="4" width="24" height="16" rx="2" fill="#5e6ad2"/>
              <rect x="4" y="7" width="20" height="4" rx="1" fill="#010102"/>
              <circle cx="7" cy="9" r="1" fill="#22c55e"/>
              <circle cx="11" cy="9" r="1" fill="#22c55e"/>
              <rect x="4" y="13" width="20" height="4" rx="1" fill="#010102"/>
              <circle cx="7" cy="15" r="1" fill="#f59e0b"/>
              <circle cx="11" cy="15" r="1" fill="#22c55e"/>
              <polyline points="2,24 8,24 12,18 16,26 20,22 24,24 26,24" fill="none" stroke="#818cf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span className="sidebar-logo-text">AgentMonitor</span>
          </div>
          {navLinks.slice(0, 4).map((link) => (
            <NavItem key={link.to} link={link} />
          ))}
          <div className="sidebar-divider" />
          {navLinks.slice(4).map((link) => (
            <NavItem key={link.to} link={link} />
          ))}
        </nav>

        <main
          className="main-content"
          style={{
            overflow: location.pathname === '/dockge' ? 'hidden' : 'auto',
          }}
        >
          <div key={location.pathname} className="page-enter" style={{ flex: 1, minHeight: 0 }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/containers" element={<Containers />} />
              <Route path="/dockge" element={<Dockge />} />
              <Route path="/servers" element={<Servers />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/alert-history" element={<AlertHistory />} />
              <Route path="/system" element={<System />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}

/** Electron loadFile → file:// 时 BrowserRouter 无法工作，主区域空白，须用 HashRouter（#/path） */
export default function App() {
  const useHash = typeof window !== 'undefined' && window.location.protocol === 'file:'
  if (useHash) {
    return (
      <HashRouter>
        <AppShell />
      </HashRouter>
    )
  }
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
