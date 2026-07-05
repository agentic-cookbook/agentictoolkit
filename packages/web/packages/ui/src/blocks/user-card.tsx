'use client'

import * as React from 'react'
import {
  ExternalLink as ExternalLinkIcon,
  Mail,
  Phone,
  MapPin,
  User as UserIcon,
  CalendarDays,
} from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '../components/avatar'
import { Badge } from '../components/badge'
import { ExternalLink } from '../components/external-link'
import { SectionLabel } from '../components/section-label'
import { Separator } from '../components/separator'
import { Skeleton } from '../components/skeleton'
import { cn } from '../lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

export type UserCardSocialLink = {
  platform: string
  url: string
  handle: string
}

export type UserCardAddress = {
  label: string
  line1: string
  line2: string
  city: string
  region: string
  postalCode: string
  country: string
}

export type UserCardPersona = {
  slug: string
  name: string
  description: string | null
  /** @enum {string} */
  visibility: 'public' | 'unlisted'
  createdAt: string
}

/**
 * Structurally matches `components['schemas']['PublicUserProfile']` from
 * @adh-shared/api-types. Defined here to keep @adh-shared/ui free of that
 * dependency — pass `SuccessBody<'/public/users/{slug}', 'get'>` directly.
 */
export type UserCardDto = {
  slug: string
  displayName: string | null
  avatarUrl: string | null
  /** Omitted in contexts without an account date (e.g. an owner's own preview). */
  createdAt?: string | null
  socialLinks: UserCardSocialLink[]
  emails: string[]
  phones: string[]
  addresses: UserCardAddress[]
  personas: UserCardPersona[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Initials from a display name or slug. Mirrors AvatarMenu's unexported helper
 * — if that helper is ever exported from @adh-shared/adh, import it here instead.
 */
function initialsOf(name: string | undefined | null): string {
  if (!name) return ''
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/** Human-readable label for a social platform key. Used by the card and the
 *  social-links editor — import from this module so there is ONE platform list. */
export const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X',
  tiktok: 'TikTok',
  bluesky: 'Bluesky',
  linkedin: 'LinkedIn',
  substack: 'Substack',
  github: 'GitHub',
  youtube: 'YouTube',
  mastodon: 'Mastodon',
  threads: 'Threads',
  twitch: 'Twitch',
  discord: 'Discord',
  website: 'Website',
}

function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform.toLowerCase()] ?? platform
}

function formatMemberSince(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  })
}

function addressLines(addr: UserCardAddress): string[] {
  const lines: string[] = []
  if (addr.line1) lines.push(addr.line1)
  if (addr.line2) lines.push(addr.line2)
  const cityRegion = [addr.city, addr.region, addr.postalCode]
    .filter(Boolean)
    .join(', ')
  if (cityRegion) lines.push(cityRegion)
  if (addr.country) lines.push(addr.country)
  return lines
}

// ── Loading skeleton ─────────────────────────────────────────────────────────

/** Swap in while the profile DTO is fetching. */
export function UserCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading profile…"
      aria-busy="true"
      className={cn(
        'rounded-xl border border-apt-border bg-apt-bg p-6',
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 shrink-0 rounded-full sm:size-20" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-3.5 w-1/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Separator className="my-4" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-1/5" />
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

/**
 * Renders a user's profile card from the card DTO. The backend applies all
 * privacy gating; this component renders whatever fields are present and
 * suppresses gated sections when their collections are empty.
 *
 * Supports three viewports (375 / 768 / 1440) and provides a companion
 * `UserCardSkeleton` for the loading state.
 */
export function UserCard({
  user,
  className,
}: {
  user: UserCardDto
  className?: string
}) {
  const displayName = user.displayName ?? user.slug
  const initials = initialsOf(user.displayName ?? null) || initialsOf(user.slug)

  const hasGatedContent =
    user.socialLinks.length > 0 ||
    user.emails.length > 0 ||
    user.phones.length > 0 ||
    user.addresses.length > 0 ||
    user.personas.length > 0

  return (
    <article
      aria-label={`${displayName}'s profile`}
      className={cn(
        'rounded-xl border border-apt-border bg-apt-bg text-apt-text',
        className,
      )}
    >
      {/* ── Identity header ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
        <Avatar className="size-16 shrink-0 self-start sm:size-20">
          {user.avatarUrl && (
            // Avatars come from arbitrary user-supplied URLs we can't
            // whitelist in images.remotePatterns, so Base UI's AvatarImage is
            // used directly (lazy-loading via the browser, no optimizer).
            <AvatarImage src={user.avatarUrl} alt={`${displayName} avatar`} />
          )}
          <AvatarFallback>
            {initials || (
              <UserIcon
                className="size-7 text-apt-text-muted"
                aria-hidden="true"
              />
            )}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-2xl font-medium leading-tight text-apt-text sm:text-3xl">
            {displayName}
          </h2>
          <div className="mt-0.5 font-mono text-sm text-apt-text-muted">
            @{user.slug}
          </div>
          {user.createdAt ? (
            <div className="mt-2 flex items-center gap-1.5 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-apt-text-dim">
              <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
              Member since {formatMemberSince(user.createdAt)}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Gated sections ──────────────────────────────────────────── */}
      {hasGatedContent && <Separator />}

      {/* Social links */}
      {user.socialLinks.length > 0 && (
        <section aria-label="Social links" className="px-6 py-4">
          <SectionLabel>Social</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {user.socialLinks.map((link) => (
              <ExternalLink
                key={`${link.platform}:${link.url}`}
                href={link.url}
                glyph={false}
                className="gap-1.5 rounded-md font-sans text-sm text-apt-text-muted transition-colors hover:text-apt-text"
              >
                <ExternalLinkIcon
                  className="size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>{platformLabel(link.platform)}</span>
                {link.handle && (
                  <span className="font-mono text-xs text-apt-text-dim">
                    {link.handle}
                  </span>
                )}
              </ExternalLink>
            ))}
          </div>
        </section>
      )}

      {/* Emails */}
      {user.emails.length > 0 && (
        <section aria-label="Email addresses" className="px-6 py-4">
          <SectionLabel>Email</SectionLabel>
          <ul className="mt-2 space-y-1.5" role="list">
            {user.emails.map((email) => (
              <li key={email} className="flex items-center gap-2 text-sm">
                <Mail
                  className="size-3.5 shrink-0 text-apt-text-muted"
                  aria-hidden="true"
                />
                <a
                  href={`mailto:${email}`}
                  className="text-apt-text-muted transition-colors hover:text-apt-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apt-gold/40"
                >
                  {email}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Phones */}
      {user.phones.length > 0 && (
        <section aria-label="Phone numbers" className="px-6 py-4">
          <SectionLabel>Phone</SectionLabel>
          <ul className="mt-2 space-y-1.5" role="list">
            {user.phones.map((phone) => (
              <li key={phone} className="flex items-center gap-2 text-sm">
                <Phone
                  className="size-3.5 shrink-0 text-apt-text-muted"
                  aria-hidden="true"
                />
                <a
                  href={`tel:${phone}`}
                  className="text-apt-text-muted transition-colors hover:text-apt-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apt-gold/40"
                >
                  {phone}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Addresses */}
      {user.addresses.length > 0 && (
        <section aria-label="Addresses" className="px-6 py-4">
          <SectionLabel>Address</SectionLabel>
          <ul className="mt-2 space-y-3" role="list">
            {user.addresses.map((addr) => (
              <li
                key={`${addr.label}|${addr.line1}|${addr.line2}|${addr.city}|${addr.region}|${addr.postalCode}|${addr.country}`}
                className="flex gap-2 text-sm"
              >
                <MapPin
                  className="mt-0.5 size-3.5 shrink-0 text-apt-text-muted"
                  aria-hidden="true"
                />
                <address className="not-italic text-apt-text-muted">
                  {addr.label && (
                    <div className="font-mono text-[0.65rem] uppercase tracking-[0.06em] text-apt-text-dim">
                      {addr.label}
                    </div>
                  )}
                  {addressLines(addr).map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </address>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Personas */}
      {user.personas.length > 0 && (
        <section aria-label="Personas" className="px-6 py-4">
          <SectionLabel>Personas</SectionLabel>
          <ul className="mt-2 space-y-2" role="list">
            {user.personas.map((persona) => (
              <li
                key={persona.slug}
                className="rounded-lg border border-apt-border bg-apt-surface p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-apt-text">{persona.name}</span>
                  <Badge
                    variant={
                      persona.visibility === 'public' ? 'success' : 'neutral'
                    }
                  >
                    {persona.visibility}
                  </Badge>
                </div>
                {persona.description && (
                  <p className="mt-1 text-sm text-apt-text-muted">
                    {persona.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Closing inset so last section's bottom padding isn't clipped */}
      {hasGatedContent && <div className="h-2" aria-hidden="true" />}
    </article>
  )
}

// ── Internal ─────────────────────────────────────────────────────────────────

