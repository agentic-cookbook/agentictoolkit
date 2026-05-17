'use client'

import { useEffect, useRef } from 'react'
import { useConnectorRegistryOptional } from './ConnectorRegistry'

export interface ConnectorAnchorProps {
  id: string
  className?: string
}

export function ConnectorAnchor({ id, className }: ConnectorAnchorProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const reg = useConnectorRegistryOptional()
  useEffect(() => {
    if (!reg || !ref.current) return
    return reg.register(id, ref.current)
  }, [id, reg])
  if (!reg) return null
  return (
    <span
      ref={ref}
      data-connector-anchor={id}
      className={`pc-connector-anchor${className ? ' ' + className : ''}`}
      aria-hidden="true"
    />
  )
}
