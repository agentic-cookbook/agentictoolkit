import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { SiteConfigProvider, useSiteConfig } from '../SiteConfigProvider'
import type { SiteConfig } from '../../types'

const config: SiteConfig = {
  branding: { title: 'Test', titleEmphasis: '' },
  meta: { description: '', siteUrl: '' },
  hero: { heading: 'h', body: 'b' },
  nav: { sections: [] },
}

describe('SiteConfigProvider', () => {
  it('exposes config via useSiteConfig', () => {
    const { result } = renderHook(() => useSiteConfig(), {
      wrapper: ({ children }) => <SiteConfigProvider config={config}>{children}</SiteConfigProvider>,
    })
    expect(result.current.branding.title).toBe('Test')
  })

  it('throws if used outside provider', () => {
    expect(() => renderHook(() => useSiteConfig())).toThrow(/SiteConfigProvider/)
  })
})
