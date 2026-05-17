import type { ReactNode } from 'react'

export interface HeaderProps {
  children?: ReactNode
  className?: string
}

export function Header({ children, className }: HeaderProps) {
  const cls = ['aws-header', className].filter(Boolean).join(' ')
  return <h2 className={cls}>{children}</h2>
}
