'use client'

import { Link } from 'react-router'
import { useContent } from '../../contexts/ContentContext'
import { useSiteConfig } from '../../contexts/SiteConfigContext'

export default function HomePage() {
  const { entries, getBySection } = useContent()
  const config = useSiteConfig()
  const { hero, nav } = config

  return (
    <div className="px-6 py-10 lg:px-10 max-w-4xl">
      <div className="mb-12">
        <h1
          className="text-5xl lg:text-6xl mb-8 tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {hero.heading}
        </h1>

        {nav.externalLinks && nav.externalLinks.length > 0 && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-5 py-4 mb-8">
            <div className="flex flex-col sm:flex-row gap-3">
              {nav.externalLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex-1 flex items-start gap-3 rounded-md border border-[var(--color-border-subtle)] px-4 py-3 hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface-hover)] transition-all"
                >
                  {link.icon && (
                    <span className="shrink-0 mt-0.5 text-[var(--color-text-dim)] group-hover:text-[var(--color-accent)] transition-colors">
                      {link.icon}
                    </span>
                  )}
                  <span>
                    <span className="text-sm font-medium text-[var(--color-accent)]">
                      {link.label}
                    </span>
                    {link.description && (
                      <span className="block text-xs text-[var(--color-text-dim)] leading-relaxed mt-0.5">
                        {link.description}
                      </span>
                    )}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {hero.body && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-8 py-8 mb-8">
            <div className="max-w-2xl text-base text-[var(--color-text-secondary)]" style={{ lineHeight: 1.8 }}>
              {hero.body}
            </div>
          </div>
        )}

        <div className="flex items-center gap-6 font-mono text-sm text-[var(--color-text-dim)]">
          {hero.meta ?? (
            <>
              <span>{entries.length} documents</span>
              <span className="text-[var(--color-border)]">|</span>
              <span>{nav.sections.length} sections</span>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-[var(--color-border-subtle)] mb-10" />

      <div className="grid gap-4 sm:grid-cols-2">
        {nav.sections.map(({ key, label, description, path, icon, fixedCount }) => {
          const count = fixedCount ?? getBySection(key).length
          return (
            <Link
              key={key}
              to={path}
              className="group block rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-6 hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface-hover)] transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                {icon && (
                  <div className="shrink-0 mt-0.5 text-[var(--color-text-dim)] group-hover:text-[var(--color-accent)] transition-colors">
                    {icon}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <h2
                      className="text-lg font-medium text-[var(--color-accent)] transition-colors"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {label}
                    </h2>
                    <span className="font-mono text-xs text-[var(--color-text-dim)] ml-3 shrink-0">
                      {count}
                    </span>
                  </div>
                  {description && (
                    <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                      {description}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
