import { createContext, useContext } from 'react'
import type { SettingsPaneDescriptor } from './types'

export type SettingsPanelContextValue = {
  selectedId: string | null
  selectPane: (id: string) => void
  registerPane: (descriptor: SettingsPaneDescriptor) => void
  unregisterPane: (id: string) => void
  panes: SettingsPaneDescriptor[]
  sidebarTitle?: string
}

export const SettingsPanelContext = createContext<SettingsPanelContextValue | null>(null)

export function useSettingsPanelContext(): SettingsPanelContextValue {
  const ctx = useContext(SettingsPanelContext)
  if (!ctx) {
    throw new Error(
      'SettingsPanel subcomponents must be rendered inside <SettingsPanel>',
    )
  }
  return ctx
}
