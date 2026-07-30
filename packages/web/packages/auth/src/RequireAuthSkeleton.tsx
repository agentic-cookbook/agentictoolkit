'use client'

import type { CSSProperties, ReactElement } from 'react'

// Stable keys for the decorative card grid (avoids array-index keys).
const CARD_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'] as const

// Per-block stagger index, consumed by `animation-delay: calc(var(--i) * …)` in
// auth's chrome CSS — so the card count lives only here, not duplicated as
// nth-child rules in the stylesheet. Cards follow the title (0) and subtitle (1).
const staggerIndex = (i: number): CSSProperties => ({ ['--i']: i + 2 }) as CSSProperties

/**
 * Default loading state for {@link RequireAuth}. A content-area skeleton that
 * mirrors a typical dashboard/list page — the header and footer are already
 * painted around it by the AppShell, so this fills only the main region. Shown
 * during the genuine auth waits (a first/cold visit, or a capability-gated site
 * that opts out of optimistic restore) instead of a bare spinner, so the page
 * reads as "loading" rather than blank.
 *
 * Styles live in this package's own stylesheet (./styles/auth.css, the
 * `./styles.css` export) as .adh-auth-skeleton — theme-adaptive via the host's
 * shared --color-* tokens, with an
 * accent-tinted shimmer that honors prefers-reduced-motion. role="status" + the
 * visually-hidden "Loading…" text name the region for assistive tech; the
 * decorative blocks are aria-hidden.
 */
export function RequireAuthSkeleton(): ReactElement {
  return (
    <div className="adh-auth-skeleton" role="status">
      <span className="adh-auth-skeleton__sr">Loading…</span>
      <div className="adh-auth-skeleton__title" style={{ ['--i']: 0 } as CSSProperties} aria-hidden="true" />
      <div className="adh-auth-skeleton__subtitle" style={{ ['--i']: 1 } as CSSProperties} aria-hidden="true" />
      <div className="adh-auth-skeleton__grid" aria-hidden="true">
        {CARD_KEYS.map((key, i) => (
          <div key={key} className="adh-auth-skeleton__card" style={staggerIndex(i)} />
        ))}
      </div>
    </div>
  )
}
