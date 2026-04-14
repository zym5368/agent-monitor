import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import { MobileDashboard } from './pages/MobileDashboard'
import { MobileContainers } from './pages/MobileContainers'
import { MobileSystem } from './pages/MobileSystem'
import { MobileMore } from './pages/MobileMore'
import { MobileServers } from './pages/MobileServers'
import { MobileAlerts } from './pages/MobileAlerts'
import { MobileAlertHistory } from './pages/MobileAlertHistory'
import { MobileDockge } from './pages/MobileDockge'

export type TabType = 'dashboard' | 'containers' | 'system' | 'more'

function TabBar({ activeTab, onTabChange }: { activeTab: TabType; onTabChange: (tab: TabType) => void }) {
  const tabs: Array<{ id: TabType; label: string; icon: string }> = [
    { id: 'dashboard', label: '仪表台', icon: 'dashboard' },
    { id: 'containers', label: '容器', icon: 'containers' },
    { id: 'system', label: '系统', icon: 'system' },
    { id: 'more', label: '更多', icon: 'more' },
  ]

  return (
    <div className="mobile-tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`mobile-tab-item ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <TabIcon name={tab.icon} active={activeTab === tab.id} />
          <span className="mobile-tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  )
}

function TabIcon({ name, active }: { name: string; active: boolean }) {
  const color = active ? '#6366f1' : '#64748b'

  const icons: Record<string, ReactNode> = {
    dashboard: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    containers: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <path d="M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z" />
        <path d="M8 12h8" />
        <path d="M12 8v8" />
      </svg>
    ),
    system: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    more: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <circle cx="12" cy="12" r="2" />
        <circle cx="19" cy="12" r="2" />
        <circle cx="5" cy="12" r="2" />
      </svg>
    ),
  }

  return <div className="mobile-tab-icon">{icons[name] || icons.more}</div>
}

function MobileAppShell() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <MobileDashboard />
      case 'containers':
        return <MobileContainers />
      case 'system':
        return <MobileSystem />
      case 'more':
        return <MobileMore />
      default:
        return <MobileDashboard />
    }
  }

  return (
    <div className="mobile-app">
      <div className="mobile-app-content">{renderContent()}</div>
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

export default function MobileApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MobileAppShell />} />
        <Route path="/servers" element={<MobileServers />} />
        <Route path="/alerts" element={<MobileAlerts />} />
        <Route path="/alert-history" element={<MobileAlertHistory />} />
        <Route path="/dockge" element={<MobileDockge />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
