import type { ReactNode } from 'react'

export interface ConditionalProps {
  when: boolean
  children?: ReactNode
  fallback?: ReactNode
}

export function Conditional({ when, children, fallback = null }: ConditionalProps) {
  return <>{when ? children : fallback}</>
}
