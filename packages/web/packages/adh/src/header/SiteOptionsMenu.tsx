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
          <Grid3x3 className="h-4 w-4" />
          <span>{triggerLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[14rem]">
        <DropdownMenuLabel>{groupLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sites.map((site) => (
          <DropdownMenuItem key={site.href} asChild>
            <a href={site.href}>
              <span>{site.label}</span>
              {site.description && (
                <span className="ml-auto text-xs text-[var(--color-text-dim)]">
                  {site.description}
                </span>
              )}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
