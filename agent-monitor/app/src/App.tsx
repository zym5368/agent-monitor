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
      style={({ isActive, isPending }) => ({
        padding: '10px 20px',
        color: isPending ? '#888' : (isActive ? '#0f0' : '#aaa'),
        textDecoration: 'none',
        display: 'block',
        borderRadius: 6,
        marginLeft: 4,
        marginRight: 4,
      })}
      className="nav-link"
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
    <div
      style={{
        minHeight: '100vh',
        position: 'relative',
        paddingTop: 32,
      }}
    >
      {/* 顶部拖拽区 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 32,
          background: '#0f172a',
          borderBottom: '1px solid rgba(71, 85, 105, 0.2)',
          WebkitAppRegion: 'drag' as any,
          zIndex: 50,
        }}
      />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 32px)' }}>
        {/* 桌面端侧栏 */}
        <nav style={{
          width: 180,
          background: '#16213e',
          padding: '16px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          {navLinks.slice(0, 4).map((link) => (
            <NavItem key={link.to} link={link} />
          ))}
          <div style={{ height: 1, background: '#333', margin: '8px 16px' }} />
          {navLinks.slice(4).map((link) => (
            <NavItem key={link.to} link={link} />
          ))}
        </nav>

        <main
          style={{
            flex: 1,
            padding: 24,
            overflow: location.pathname === '/dockge' ? 'hidden' : 'auto',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            WebkitAppRegion: 'no-drag' as any,
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
