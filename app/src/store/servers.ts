import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Server } from '@/shared/types'

const STORAGE_KEY = 'cluster-servers'

interface ServersState {
  servers: Server[]
  add: (s: Omit<Server, 'id'>) => void
  update: (id: string, s: Partial<Server>) => void
  remove: (id: string) => void
  getById: (id: string) => Server | undefined
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function isElectronRenderer() {
  return typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent)
}

function makeDefaultPcServer(): Server {
  return {
    id: genId(),
    name: '公司电脑',
    dataSource: 'agent',
    host: 'localhost',
    port: 9100,
    apiKey: '',
    dockgeUrl: '',
  }
}

export const useServersStore = create<ServersState>()(
  persist(
    (set, get) => ({
      servers: isElectronRenderer() ? [makeDefaultPcServer()] : [],
      add: (s) => set((state) => ({
        servers: [...state.servers, { ...s, id: genId() }],
      })),
      update: (id, partial) => set((state) => ({
        servers: state.servers.map((s) =>
          s.id === id ? { ...s, ...partial } : s
        ),
      })),
      remove: (id) => set((state) => ({
        servers: state.servers.filter((s) => s.id !== id),
      })),
      getById: (id) => get().servers.find((s) => s.id === id),
    }),
    {
      name: STORAGE_KEY,
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<ServersState> | undefined)?.servers ?? []
        if (persisted.length > 0) {
          return { ...currentState, ...(persistedState as object) }
        }
        if (isElectronRenderer()) {
          return { ...currentState, ...(persistedState as object), servers: [makeDefaultPcServer()] }
        }
        return { ...currentState, ...(persistedState as object) }
      },
    }
  )
)
