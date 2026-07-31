'use client'

import { Grid3x3 } from 'lucide-react'
import { Button } from '../components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@agentic-toolkit/ui/components/dropdown-menu'

export type SiteLink = {
  /** OPTIONAL stable identity for the target, independent of its URL. `SiteSwitcher`
   *  hands it back to `onSwitchSite` so a caller can rewrite the destination without
   *  parsing the href; absent, the href plays that role. Optional deliberately: this
   *  type is owned by `SiteOptionsMenu`, which never reads the field, and making it
   *  required would break every existing caller of a published type on behalf of a
   *  different component. */
  id?: string
  label: string
  href: string
  description?: string
}

export type SiteOptionsMenuProps = {
  sites: SiteLink[]
  triggerLabel?: string
  /** Heading over the list. Defaults to a generic label: this package publishes no
   *  site family of its own, so a consumer's product name has to come from the
   *  consumer. */
  groupLabel?: string
}

export function SiteOptionsMenu({
  sites,
  triggerLabel = 'Sites',
  groupLabel = 'Sites',
}: SiteOptionsMenuProps) {
  if (sites.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="sm" aria-label={triggerLabel} />}
      >
        <Grid3x3 className="adh-button__icon" />
        <span>{triggerLabel}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{groupLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sites.map((site) => (
          // LinkItem, not Item-wrapping-an-anchor: these are cross-SITE hrefs, so the
          // browser's own link semantics (middle-click, open-in-new-tab, status bar)
          // are the point, and LinkItem is the engine's way of keeping them.
          <DropdownMenuLinkItem key={site.href} render={<a href={site.href} />}>
            <span>{site.label}</span>
            {site.description && (
              <span className="adh-dropdown-menu__shortcut">
                {site.description}
              </span>
            )}
          </DropdownMenuLinkItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
