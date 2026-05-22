'use client'

import { Grid3x3 } from 'lucide-react'
import { Button } from '../components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu'

export type SiteLink = {
  label: string
  href: string
  description?: string
}

export type SiteOptionsMenuProps = {
  sites: SiteLink[]
  triggerLabel?: string
  groupLabel?: string
}

export function SiteOptionsMenu({
  sites,
  triggerLabel = 'Sites',
  groupLabel = 'Agentic Developer Hub',
}: SiteOptionsMenuProps) {
  if (sites.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={triggerLabel}>
          <Grid3x3 className="adh-menu__item-icon" />
          <span>{triggerLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{groupLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sites.map((site) => (
          <DropdownMenuItem key={site.href} asChild>
            <a href={site.href}>
              <span>{site.label}</span>
              {site.description && (
                <span className="adh-menu__item-meta">{site.description}</span>
              )}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
