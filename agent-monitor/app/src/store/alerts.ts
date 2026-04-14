import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AlertRule,
  NotificationChannel,
  ActiveAlert,
  AlertHistory,
  NotificationLog,
  AlertLevel,
  AlertStatus,
  AlertMetric,
  AlertCondition,
} from '@/shared/types'

const STORAGE_KEY_RULES = 'cluster-alert-rules'
const STORAGE_KEY_CHANNELS = 'cluster-notification-channels'
const STORAGE_KEY_HISTORY = 'cluster-alert-history'
const STORAGE_KEY_LOGS = 'cluster-notification-logs'

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

interface AlertRulesState {
  rules: AlertRule[]
  addRule: (rule: Omit<AlertRule, 'id'>) => void
  updateRule: (id: string, rule: Partial<AlertRule>) => void
  removeRule: (id: string) => void
  getRuleById: (id: string) => AlertRule | undefined
  getRulesByServer: (serverId: string) => AlertRule[]
}

interface NotificationChannelsState {
  channels: NotificationChannel[]
  addChannel: (channel: Omit<NotificationChannel, 'id'>) => void
  updateChannel: (id: string, channel: Partial<NotificationChannel>) => void
  removeChannel: (id: string) => void
  getChannelById: (id: string) => NotificationChannel | undefined
}

interface ActiveAlertsState {
  activeAlerts: ActiveAlert[]
  addActiveAlert: (alert: Omit<ActiveAlert, 'id' | 'startedAt' | 'consecutiveHits' | 'status'>) => ActiveAlert
  updateActiveAlert: (id: string, updates: Partial<ActiveAlert>) => void
  removeActiveAlert: (id: string) => void
  acknowledgeAlert: (id: string) => void
  resolveAlert: (id: string) => void
  getActiveAlertsByServer: (serverId: string) => ActiveAlert[]
}

interface AlertHistoryState {
  history: AlertHistory[]
  addHistory: (entry: Omit<AlertHistory, 'id' | 'timestamp'>) => void
  clearHistory: () => void
  getHistoryByServer: (serverId: string) => AlertHistory[]
  getHistoryByAlert: (alertId: string) => AlertHistory[]
}

interface NotificationLogsState {
  logs: NotificationLog[]
  addLog: (log: Omit<NotificationLog, 'id' | 'timestamp'>) => void
  clearLogs: () => void
}

type AlertsStore = AlertRulesState &
  NotificationChannelsState &
  ActiveAlertsState &
  AlertHistoryState &
  NotificationLogsState

export const useAlertsStore = create<AlertsStore>()(
  persist(
    (set, get) => ({
      // Alert Rules
      rules: [],
      addRule: (rule) =>
        set((state) => ({
          rules: [...state.rules, { ...rule, id: genId() }],
        })),
      updateRule: (id, partial) =>
        set((state) => ({
          rules: state.rules.map((r) => (r.id === id ? { ...r, ...partial } : r)),
        })),
      removeRule: (id) =>
        set((state) => ({
          rules: state.rules.filter((r) => r.id !== id),
        })),
      getRuleById: (id) => get().rules.find((r) => r.id === id),
      getRulesByServer: (serverId) =>
        get().rules.filter((r) => r.enabled && (r.serverId == null || r.serverId === serverId)),

      // Notification Channels
      channels: [],
      addChannel: (channel) =>
        set((state) => ({
          channels: [...state.channels, { ...channel, id: genId() }],
        })),
      updateChannel: (id, partial) =>
        set((state) => ({
          channels: state.channels.map((c) => (c.id === id ? { ...c, ...partial } : c)),
        })),
      removeChannel: (id) =>
        set((state) => ({
          channels: state.channels.filter((c) => c.id !== id),
        })),
      getChannelById: (id) => get().channels.find((c) => c.id === id),

      // Active Alerts
      activeAlerts: [],
      addActiveAlert: (alert) => {
        const newAlert: ActiveAlert = {
          ...alert,
          id: genId(),
          status: 'pending',
          startedAt: Date.now(),
          consecutiveHits: 1,
        }
        set((state) => ({
          activeAlerts: [...state.activeAlerts, newAlert],
        }))
        return newAlert
      },
      updateActiveAlert: (id, updates) =>
        set((state) => ({
          activeAlerts: state.activeAlerts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),
      removeActiveAlert: (id) =>
        set((state) => ({
          activeAlerts: state.activeAlerts.filter((a) => a.id !== id),
        })),
      acknowledgeAlert: (id) => {
        const alert = get().activeAlerts.find((a) => a.id === id)
        if (alert) {
          get().updateActiveAlert(id, {
            status: 'acknowledged',
            acknowledgedAt: Date.now(),
          })
          get().addHistory({
            alertId: id,
            ruleId: alert.ruleId,
            serverId: alert.serverId,
            serverName: alert.serverName,
            metric: alert.metric,
            value: alert.value,
            threshold: alert.threshold,
            condition: alert.condition,
            level: alert.level,
            event: 'acknowledged',
            message: `告警已确认`,
          })
        }
      },
      resolveAlert: (id) => {
        const alert = get().activeAlerts.find((a) => a.id === id)
        if (alert) {
          get().updateActiveAlert(id, {
            status: 'resolved',
            resolvedAt: Date.now(),
          })
          get().addHistory({
            alertId: id,
            ruleId: alert.ruleId,
            serverId: alert.serverId,
            serverName: alert.serverName,
            metric: alert.metric,
            value: alert.value,
            threshold: alert.threshold,
            condition: alert.condition,
            level: alert.level,
            event: 'resolved',
            message: `告警已恢复`,
          })
          // 延迟删除，让用户能看到已解决状态
          setTimeout(() => {
            get().removeActiveAlert(id)
          }, 60000)
        }
      },
      getActiveAlertsByServer: (serverId) =>
        get().activeAlerts.filter((a) => a.serverId === serverId),

      // Alert History
      history: [],
      addHistory: (entry) =>
        set((state) => ({
          history: [
            { ...entry, id: genId(), timestamp: Date.now() },
            ...state.history.slice(0, 999),
          ],
        })),
      clearHistory: () => set({ history: [] }),
      getHistoryByServer: (serverId) => get().history.filter((h) => h.serverId === serverId),
      getHistoryByAlert: (alertId) => get().history.filter((h) => h.alertId === alertId),

      // Notification Logs
      logs: [],
      addLog: (log) =>
        set((state) => ({
          logs: [
            { ...log, id: genId(), timestamp: Date.now() },
            ...state.logs.slice(0, 499),
          ],
        })),
      clearLogs: () => set({ logs: [] }),
    }),
    {
      name: STORAGE_KEY_RULES,
      partialize: (state) => ({
        rules: state.rules,
        channels: state.channels,
        history: state.history,
        logs: state.logs,
      }),
    }
  )
)
