'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ColorMode = 'auto' | 'light' | 'dark'
export type ResolvedColorMode = 'light' | 'dark'

const CYCLE: ColorMode[] = ['auto', 'dark', 'light']
const DEFAULT_STORAGE_KEY = 'agentic-toolkit:color-mode'
const APPEARANCE_CYCLE_EVENT = 'awt:appearance-cycle'
const APPEARANCE_CHANGED_EVENT = 'awt:appearance-changed'

interface ColorModeContextValue {
  mode: ColorMode
  resolved: ResolvedColorMode
  setMode: (mode: ColorMode) => void
  cycle: () => void
}

const ColorModeContext = createContext<ColorModeContextValue | null>(null)

function readStoredMode(key: string): ColorMode | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(key)
    if (v === 'light' || v === 'dark' || v === 'auto') return v
  } catch {
    /* ignore */
  }
  return null
}

export interface ColorModeProviderProps {
  children: ReactNode
  storageKey?: string
  defaultMode?: ColorMode
}

export function ColorModeProvider({
  children,
  storageKey = DEFAULT_STORAGE_KEY,
  defaultMode = 'auto',
}: ColorModeProviderProps) {
  const [mode, setMode] = useState<ColorMode>(() => readStoredMode(storageKey) ?? defaultMode)
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolved: ResolvedColorMode = mode === 'auto' ? (systemDark ? 'dark' : 'light') : mode

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle('dark', resolved === 'dark')
    document.documentElement.dataset.appearanceMode = mode
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(APPEARANCE_CHANGED_EVENT))
    }
  }, [mode, resolved])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (mode === 'auto') window.localStorage.removeItem(storageKey)
      else window.localStorage.setItem(storageKey, mode)
    } catch {
      /* ignore */
    }
  }, [mode, storageKey])

  const cycle = useCallback(() => {
    setMode((m) => CYCLE[(CYCLE.indexOf(m) + 1) % CYCLE.length] ?? 'auto')
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onCycle = () => cycle()
    window.addEventListener(APPEARANCE_CYCLE_EVENT, onCycle)
    return () => window.removeEventListener(APPEARANCE_CYCLE_EVENT, onCycle)
  }, [cycle])

  const value = useMemo<ColorModeContextValue>(
    () => ({ mode, resolved, setMode, cycle }),
    [mode, resolved, cycle],
  )

  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>
}

export function useColorMode(): ColorModeContextValue {
  const ctx = useContext(ColorModeContext)
  if (!ctx) {
    throw new Error('useColorMode must be used within a <ColorModeProvider>')
  }
  return ctx
}
