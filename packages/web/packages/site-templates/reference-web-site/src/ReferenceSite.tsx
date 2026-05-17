'use client'

import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router'
import { ColorModeProvider } from '@agentic-web-toolkit/themes/colorMode'
import { ContentProvider } from './contexts/ContentContext'
import { SiteConfigProvider } from './contexts/SiteConfigContext'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import DocPage from './components/content/DocPage'
import SearchDialog from './components/content/SearchDialog'
import type { SiteConfig } from './types'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

interface ReferenceSiteProps {
  config: SiteConfig
}

function SiteShell({ config }: { config: SiteConfig }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchEnabled = config.features?.search !== false

  useEffect(() => {
    if (!searchEnabled) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchEnabled])

  const HeaderComponent = config.slots?.Header ?? Header
  const FooterComponent = config.slots?.Footer

  return (
    <div className="min-h-screen">
      <div className="grain" />
      <ScrollToTop />
      <HeaderComponent
        onMenuToggle={() => setSidebarOpen((v) => !v)}
        onSearchOpen={() => setSearchOpen(true)}
      />
      <div className="flex">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 min-w-0">
          <Routes>
            {config.slots?.extraRoutes}
            <Route path="/*" element={<DocPage />} />
          </Routes>
        </main>
      </div>
      {FooterComponent && <FooterComponent />}
      {searchEnabled && (
        <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      )}
    </div>
  )
}

export function ReferenceSiteApp({ config }: ReferenceSiteProps) {
  return (
    <SiteConfigProvider config={config}>
      <ColorModeProvider>
        <ContentProvider>
          <SiteShell config={config} />
        </ContentProvider>
      </ColorModeProvider>
    </SiteConfigProvider>
  )
}

export default function ReferenceSite({ config }: ReferenceSiteProps) {
  return (
    <BrowserRouter>
      <ReferenceSiteApp config={config} />
    </BrowserRouter>
  )
}
