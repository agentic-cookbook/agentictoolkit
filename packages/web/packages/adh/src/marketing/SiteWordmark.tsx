import type { ReactElement, ReactNode } from 'react'
// HubMark is a pure glyph with no registry in it. This used to reach the toolkit's own
// header barrel specifically, BYPASSING the app tier's re-export, so the registry-bound
// site menu stayed out of this deliberately light entry. The merge collapsed those two
// barrels into one that publishes both halves, so that bypass no longer exists: the
// specifier below is the merged barrel. It stays a package path (the barrel is `external`
// in tsup.config.ts) so it remains a separate chunk the consumer resolves rather than
// something inlined here — but the light-entry claim is now about chunking, not contents.
import { HubMark } from '@agentic-toolkit/adh/header'
import { getSite, splitSiteTitle, type SiteId } from '@agentic-toolkit/adh-registry'

export type SiteWordmarkProps = {
  /** The marketing site whose brand this wordmark renders. */
  siteId: SiteId
  /**
   * Optional identity line under the wordmark. Defaults to the site node's
   * `description`; pass `null` to omit it entirely.
   */
  tagline?: ReactNode
  /** Extra classes on the root element. */
  className?: string
}

/**
 * The compact brand wordmark for an ADH marketing site: the hub brand mark
 * ({@link HubMark}) beside the site's full name with its trailing accent word in
 * gold italic — the SAME lead/accent split the
 * MarketingLanding hero uses, via `splitSiteTitle` (the single source of truth for
 * the brand split) — over an optional mono identity line. Reuse this to brand a
 * marketing site's sub-pages (e.g. an author's research index) instead of
 * hand-rolling a bespoke header. Pure presentational; styled with `apt-*` tokens.
 */
export function SiteWordmark({ siteId, tagline, className }: SiteWordmarkProps): ReactElement {
  const site = getSite(siteId)
  const { titleLead, titleAccent } = site
    ? splitSiteTitle(site)
    : { titleLead: '', titleAccent: siteId }
  const identity = tagline === undefined ? site?.description : tagline

  return (
    <div className={className}>
      <p className="flex items-center gap-2 font-serif text-lg leading-tight font-medium tracking-tight text-apt-text sm:text-xl">
        {/* The brand mark rides the accent word's gold (text-apt-gold → currentColor). */}
        <HubMark className="h-[1.2em] w-[1.2em] shrink-0 text-apt-gold" />
        <span>
          {titleLead ? `${titleLead} ` : null}
          <span className="text-apt-gold italic">{titleAccent}</span>
        </span>
      </p>
      {identity ? (
        <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-apt-text-dim">
          {identity}
        </p>
      ) : null}
    </div>
  )
}
