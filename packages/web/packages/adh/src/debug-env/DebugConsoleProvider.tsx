'use client'

import { createContext, useContext, type ReactNode } from 'react'

/** One chat theme the picker can apply. */
export interface DebugConsoleChatTheme {
  /** Selectable themes ({key,label}); `key` is the theme id, `null` = app default. */
  themes: { key: string; label: string }[]
  /** Currently applied chat theme key (`null` = app default). */
  current: string | null
  /** Apply a chat theme (writes the host's store; live-applies). */
  onChange: (key: string | null) => void
  /** Render a live preview of a theme (the host owns the toolkit ThemeStyle). */
  renderPreview: (key: string | null) => ReactNode
}

/** Host-injected extras for the Debug console. Optional — absent it, only the built-in
 *  topics (Environment / Settings / Site theme) show. This is the extension seam. */
export interface DebugConsoleConfig {
  chatTheme?: DebugConsoleChatTheme
}

const DebugConsoleContext = createContext<DebugConsoleConfig>({})

export function DebugConsoleProvider({
  config,
  children,
}: {
  config: DebugConsoleConfig
  children: ReactNode
}) {
  return <DebugConsoleContext.Provider value={config}>{children}</DebugConsoleContext.Provider>
}

export function useDebugConsoleConfig(): DebugConsoleConfig {
  return useContext(DebugConsoleContext)
}
