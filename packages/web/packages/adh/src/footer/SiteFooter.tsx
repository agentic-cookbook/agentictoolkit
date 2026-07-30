'use client'

import { AdhFooter as ToolkitFooter, type FooterLink } from '@agentic-toolkit/adh/footer'
import { siteProdUrl } from '@agentic-toolkit/adh-registry'
import { FooterChat } from './FooterChat'
import { SitesPopover, SITES_OVERVIEW_POPOVER_ID } from './SitesOverview'
import { openLegalModal, TermsModal, PrivacyModal, TERMS_DIALOG_ID, PRIVACY_DIALOG_ID } from './LegalModals'

export type SiteFooterProps = { links?: FooterLink[] }

const COPYRIGHT_PREFIX = '© 2026 '
const BRAND_LABEL = 'FishLamp Design'
const BRAND_HREF = siteProdUrl('fishlamp', '/')

// Sites + Terms + Privacy appear on EVERY footer — owned here so individual sites can't
// drop them. "Sites" is a native popover trigger (no JS); the two legal links are real
// anchors to the standalone pages, upgraded to modals when the Popover API is present.
const SITES_LINK: FooterLink = {
  label: 'Sites',
  popoverTarget: SITES_OVERVIEW_POPOVER_ID,
  ariaLabel: 'Sites — Agentic Developer family overview',
}
// `.adh-footer` is sticky-positioned (bottom: 0), so it is in the viewport on every
// page view of every site — next/link's default in-viewport prefetch would eagerly
// fetch /terms and /privacy on every page load. With JS on, onSelect preventDefault's
// the click and opens a modal instead, so the user never actually navigates to the
// prefetched route: prefetching it is pure waste. prefetch={false} keeps the href
// (no-JS / modified-click fallback) but drops the eager fetch. Site-passed links are
// not ours to decide for, so this is set here, not as a toolkit-wide default.
const LEGAL_LINKS: FooterLink[] = [
  { label: 'Terms', href: '/terms', onSelect: openLegalModal(TERMS_DIALOG_ID), prefetch: false },
  { label: 'Privacy', href: '/privacy', onSelect: openLegalModal(PRIVACY_DIALOG_ID), prefetch: false },
]

/** adh's footer: the toolkit's identity-free primitive ({@link ToolkitFooter}, published as
 *  `AdhFooter` from this same barrel) plus everything that IS adh — the FishLamp brand
 *  line, the sites popover, the legal modals, and bitbag himself. The copyright is a fixed
 *  brand line, deliberately not per-site.
 *
 *  Named `SiteFooter` rather than `AdhFooter`: this barrel already publishes an `AdhFooter`
 *  — the registry-free primitive this component wraps. The two are unrelated components
 *  that happened to share a name; this one is adh's REGISTRY-AWARE composition. */
export function SiteFooter({ links = [] }: SiteFooterProps) {
  return (
    <>
      <ToolkitFooter
        links={[SITES_LINK, ...links, ...LEGAL_LINKS]}
        copyright={
          <>
            {COPYRIGHT_PREFIX}
            <a className="adh-footer__brand-link" href={BRAND_HREF}>
              {BRAND_LABEL}
            </a>
          </>
        }
        trailing={<FooterChat />}
      />
      <SitesPopover />
      <TermsModal />
      <PrivacyModal />
    </>
  )
}
