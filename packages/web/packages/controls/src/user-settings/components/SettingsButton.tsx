'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { SettingsButtonVariant } from '../types'

export interface SettingsButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: SettingsButtonVariant
  children?: ReactNode
}

export function SettingsButton({
  variant = 'primary',
  className,
  type = 'button',
  children,
  ...rest
}: SettingsButtonProps) {
  const cls = ['aws-button', `aws-button--${variant}`, className].filter(Boolean).join(' ')
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  )
}
