'use client'

import { AdhFooter as ToolkitFooter, type FooterLink } from '@agentic-toolkit/adh/footer'
import { FooterChat } from './FooterChat'
import { SitesPopover, SITES_OVERVIEW_POPOVER_ID } from './SitesOverview'
import { openLegalModal, TermsModal, PrivacyModal, TERMS_DIALOG_ID, PRIVACY_DIALOG_ID } from './LegalModals'

export type SiteFooterProps = {
  links?: FooterLink[]
  /** Mount bitbag. Default true — he belongs on every real footer. `false` is for
   *  the ONE case that isn't one: a footer rendered as a specimen inside the theme
   *  editor's preview pane. He portals himself to `document.body` (see
   *  FooterChatInner), so a preview cannot contain him with a scoped `display:none`
   *  the way it hides the in-flow theme switcher — he escapes the pane and lands
   *  full-size over the console that is previewing him. Not mounting him is the
   *  only thing that actually works, and it says what it means.
   *
   *  On THIS component, not the {@link ToolkitFooter} primitive it wraps: the
   *  primitive takes a generic `trailing` slot and has no idea bitbag exists, which
   *  is the whole point of the split. */
  chat?: boolean
}

const COPYRIGHT_PREFIX = '© 2026 '
// The company the copyright belongs to — Agentic Development Studio, which is also
// the wordmark closing the site menu (see StudioWordmark). NOT FishLamp Design, which
// this used to name and which is still a family site with its own footer row.
//
// A literal href rather than `siteProdUrl(...)`: the studio deliberately has no
// registry entry (a `registry.test.ts` case pins that agenticdevelopmentstudio.com is
// not a registry host, because an entry would re-add the origin to the OAuth
// return-origin allowlist and to the generated route map). Same reason the menu's
// studio row is an absolute `{ href }`.
const BRAND_LABEL = 'Agentic Development Studio'
const BRAND_HREF = 'https://agenticdevelopmentstudio.com/'

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

/** The footer's build identity: `v1.0.155 · a73e79b7`, or null when neither field exists.
 *
 *  Two fields doing two jobs. The semver is hand-bumped and scoped to ONE site's
 *  directory, so it answers "did my change ship?"; the SHA is stamped on every
 *  build from any cause — including a submodule bump that touched no file under
 *  the site — so it answers "which build is this?". Each covers the other's blind
 *  spot: a version alone only moves when someone remembers, and a bare SHA means
 *  nothing unless you happen to be holding the commit you deployed.
 *
 *  Both are read as literal `process.env.NEXT_PUBLIC_*` expressions so Next's
 *  build-time substitution reaches them (the same mechanism TelemetryProvider
 *  already round-trips for NEXT_PUBLIC_ADH_RELEASE). Exported for the contract test.
 *
 *  The title carries the FULL sha rather than a build timestamp: a timestamp would
 *  make every build's bundle differ from identical source, and this repo has already
 *  paid for non-reproducible artifacts once. */
export function buildVersionLabel() {
  const version = process.env.NEXT_PUBLIC_ADH_SITE_VERSION ?? ''
  const sha = process.env.NEXT_PUBLIC_ADH_RELEASE ?? ''
  const label = [version && `v${version}`, sha && sha.slice(0, 8)].filter(Boolean).join(' · ')
  if (!label) return null
  return <span title={sha || undefined}>{label}</span>
}

/** adh's footer: the toolkit's identity-free primitive ({@link ToolkitFooter}, published as
 *  `AdhFooter` from this same barrel) plus everything that IS adh — the FishLamp brand
 *  line, the sites popover, the legal modals, and bitbag himself. The copyright is a fixed
 *  brand line, deliberately not per-site.
 *
 *  Named `SiteFooter` rather than `AdhFooter`: this barrel already publishes an `AdhFooter`
 *  — the registry-free primitive this component wraps. The two are unrelated components
 *  that happened to share a name; this one is adh's REGISTRY-AWARE composition. */
export function SiteFooter({ links = [], chat = true }: SiteFooterProps) {
  // bitbag is rendered here but does NOT live here: FooterChatInner portals him to
  // `document.body` and he fixes himself to the viewport's bottom edge, so the
  // primitive's `trailing` slot is his mount point and nothing else. He therefore
  // can't affect the bar's height — but the bar accommodates HIM below 64rem, where
  // the links would otherwise sit under his composer (`.adh-footer__container`
  // padding in adh-site.css). For where he actually is, read bitbag-dock.css.
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
        version={buildVersionLabel()}
        trailing={chat ? <FooterChat /> : null}
      />
      <SitesPopover />
      <TermsModal />
      <PrivacyModal />
    </>
  )
}
