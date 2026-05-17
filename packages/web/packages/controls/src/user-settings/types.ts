import type { ReactNode } from 'react'

export type Choice<T extends string | number = string> = {
  value: T
  label: string
  hint?: string
  disabled?: boolean
}

export type SettingsPaneDescriptor = {
  id: string
  title: string
  icon?: ReactNode
  section?: string
  isDisabled?: boolean
}

export type SettingsPaneEntry = SettingsPaneDescriptor & {
  body: ReactNode
}

export type SettingsButtonVariant = 'primary' | 'secondary' | 'destructive'
