'use client'

import { Link } from 'react-router'
import { AppearanceModeToggle } from '@agentic-toolkit/controls/appearance-mode-toggle'
import { useSiteConfig } from '../../contexts/SiteConfigContext'

interface HeaderProps {
  onMenuToggle: () => void
  onSearchOpen: () => void
}

export default function Header({ onMenuToggle, onSearchOpen }: HeaderProps) {
  const config = useSiteConfig()
  const { branding } = config
  const logoHref = branding.logoHref ?? '/'

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)]/90 backdrop-blur">
      <div className="flex h-14 items-center gap-4 px-4 lg:px-8">
        <button
          onClick={onMenuToggle}
          className="lg:hidden -ml-2 p-2 text-[var(--color-text-dim)] hover:text-[var(--color-text-primary)]"
          aria-label="Toggle navigation"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <Link to={logoHref} className="shrink-0" style={{ fontFamily: 'var(--font-display)' }}>
          <span className="text-xl text-[var(--color-text-primary)]">
            {branding.titleEmphasis && (
              <em className="text-[var(--color-accent)]" style={{ fontStyle: 'italic' }}>
                {branding.titleEmphasis}
              </em>
            )}
            {branding.titleEmphasis ? ' ' : ''}
            {branding.title}
          </span>
        </Link>

        <div className="flex-1" />

        {branding.githubUrl && (
          <a
            href={branding.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-[var(--color-text-dim)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="View on GitHub"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>
        )}

        {config.features?.search !== false && (
          <button
            onClick={onSearchOpen}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-dim)] hover:border-[var(--color-text-dim)] transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="hidden sm:inline font-mono text-xs">Search...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text-dim)]">
              <span>&#8984;</span>K
            </kbd>
          </button>
        )}

        <AppearanceModeToggle />
      </div>
    </header>
  )
}
