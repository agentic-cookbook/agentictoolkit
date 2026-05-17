import type { ReactNode } from 'react'

export interface ExplanationProps {
  children?: ReactNode
  className?: string
}

export function Explanation({ children, className }: ExplanationProps) {
  const cls = ['aws-explanation', className].filter(Boolean).join(' ')
  return <p className={cls}>{children}</p>
}
