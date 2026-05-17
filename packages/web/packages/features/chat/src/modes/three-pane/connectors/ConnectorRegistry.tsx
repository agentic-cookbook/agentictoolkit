'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

type AnchorMap = Map<string, HTMLElement>

export interface RegistrySnapshot {
  has(id: string): boolean
  get(id: string): HTMLElement | undefined
  ids(): string[]
}

export interface RegistryHandle {
  register(id: string, el: HTMLElement): () => void
  snapshot(): RegistrySnapshot
  subscribe(listener: () => void): () => void
}

const Ctx = createContext<RegistryHandle | null>(null)

export function ConnectorRegistryProvider({ children }: { children: ReactNode }) {
  const map = useRef<AnchorMap>(new Map())
  const listeners = useRef<Set<() => void>>(new Set())
  const snapshotRef = useRef<RegistrySnapshot | null>(null)

  const handle = useMemo<RegistryHandle>(() => {
    const buildSnapshot = (): RegistrySnapshot => {
      const m = map.current
      const ids = Array.from(m.keys())
      return {
        has: (id) => m.has(id),
        get: (id) => m.get(id),
        ids: () => ids,
      }
    }
    const notify = () => {
      snapshotRef.current = buildSnapshot()
      listeners.current.forEach((fn) => fn())
    }
    snapshotRef.current = buildSnapshot()
    return {
      register(id, el) {
        if (map.current.get(id) === el) return () => {}
        map.current.set(id, el)
        notify()
        return () => {
          if (map.current.get(id) === el) {
            map.current.delete(id)
            notify()
          }
        }
      },
      snapshot() {
        return snapshotRef.current!
      },
      subscribe(listener) {
        listeners.current.add(listener)
        return () => {
          listeners.current.delete(listener)
        }
      },
    }
  }, [])

  return <Ctx.Provider value={handle}>{children}</Ctx.Provider>
}

export function useConnectorRegistry(): RegistryHandle {
  const v = useContext(Ctx)
  if (!v) throw new Error('useConnectorRegistry must be used inside <ConnectorRegistryProvider>')
  return v
}

export function useConnectorRegistryOptional(): RegistryHandle | null {
  return useContext(Ctx)
}

export function useRegistrySnapshot(): RegistrySnapshot {
  const reg = useConnectorRegistry()
  const subscribe = useCallback((l: () => void) => reg.subscribe(l), [reg])
  const get = useCallback(() => reg.snapshot(), [reg])
  return useSyncExternalStore(subscribe, get, get)
}
