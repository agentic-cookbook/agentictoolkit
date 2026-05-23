'use client'

import { useSiteConfig } from '@agentic-toolkit/model'
import { Header, type HeaderProps } from './Header'

export type HeaderConnectedProps = Omit<HeaderProps, 'title' | 'titleEmphasis'>

export function HeaderConnected(props: HeaderConnectedProps) {
  const { branding } = useSiteConfig()
  return (
    <Header
      title={branding.title}
      titleEmphasis={branding.titleEmphasis}
      {...props}
    />
  )
}
