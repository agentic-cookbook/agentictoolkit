'use client'

import * as React from 'react'
import { ChevronsUpDown, Check, Lock, Users, Globe, Building2 } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from './popover'
import { Badge } from './badge'
import { cn } from '../lib/utils'
import { fieldShellClass } from "./input"

// ── Types and constants ───────────────────────────────────────────────────────

export type PrivacyLevel = 'only-me' | 'hub' | 'public'

/**
 * Maps each privacy level to its audience-mask integer for the
 * PUT /account/privacy backend payload. Consume in the settings editor slice:
 *   body.audienceMask = PRIVACY_AUDIENCE_MASK[selectedLevel]
 */
export const PRIVACY_AUDIENCE_MASK = {
  'only-me': 0,
  'public': 1,
  'hub': 2,
} as const satisfies Record<PrivacyLevel, number>

/**
 * The word each level is STORED as — `customer.customers.profile_visibility` and
 * `organization.organizations.profile_visibility`, and `visibility` on personas, registries and
 * registry entries.
 *
 * A second map rather than a rename, because the two conversions answer different questions.
 * `PRIVACY_AUDIENCE_MASK` above converts a level to an integer for a PER-ROW privacy grant, which
 * can plausibly hold several audiences at once. This converts a level to the single word a PAGE
 * or object-level switch stores. Collapsing them would force one of the two shapes onto the other.
 *
 * `'only-me'` spells itself `'private'` on the wire, and that asymmetry is deliberate: every
 * visibility column already in the schema says `private`, so matching the TS literal instead
 * would make the new columns disagree with all of them over a spelling.
 */
export const PRIVACY_WIRE_VALUE = {
  'only-me': 'private',
  'hub': 'hub',
  'public': 'public',
} as const satisfies Record<PrivacyLevel, 'public' | 'hub' | 'private'>

/**
 * The level a stored word selects. FAILS CLOSED — anything unrecognised reads as `'only-me'`, so
 * a value this build does not know about (a row written before a migration, a replica mid-deploy)
 * renders as the most private option rather than as "Public".
 */
export function PRIVACY_LEVEL_FROM_WIRE(v: string): PrivacyLevel {
  if (v === 'public') return 'public'
  if (v === 'hub') return 'hub'
  return 'only-me'
}

type PrivacyOption = {
  value: PrivacyLevel
  label: string
  description: string
  icon: React.ElementType
}

const PRIVACY_OPTIONS: PrivacyOption[] = [
  {
    value: 'only-me',
    label: 'Only me',
    description: 'Visible to you alone',
    icon: Lock,
  },
  {
    value: 'hub',
    label: 'Hub members',
    description: 'Visible to everyone on the Hub',
    icon: Users,
  },
  {
    value: 'public',
    label: 'Public',
    description: 'Visible to anyone on the internet',
    icon: Globe,
  },
]

const LEVEL_LABELS: Record<PrivacyLevel, string> = {
  'only-me': 'Only me',
  'hub': 'Hub members',
  'public': 'Public',
}

const LEVEL_ICONS: Record<PrivacyLevel, React.ElementType> = {
  'only-me': Lock,
  'hub': Users,
  'public': Globe,
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface PrivacyLevelSelectProps {
  /** Current selected level. */
  value: PrivacyLevel
  /** Called when the user picks a new level. */
  onChange: (value: PrivacyLevel) => void
  /** Accessible label for the trigger (e.g. "Email visibility"). */
  ariaLabel?: string
  disabled?: boolean
  className?: string
}

/**
 * Presentational, controlled privacy-level picker. Three selectable levels
 * (only-me / hub / public) rendered in a keyboard-navigable popover listbox,
 * plus a visibly disabled "Team / Org (coming soon)" affordance.
 *
 * Does not perform network calls — wire the `onChange` to PUT /account/privacy
 * using `PRIVACY_AUDIENCE_MASK[value]` to translate the level to an integer.
 */
export function PrivacyLevelSelect({
  value,
  onChange,
  ariaLabel = 'Privacy level',
  disabled = false,
  className,
}: PrivacyLevelSelectProps): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  const [cursor, setCursor] = React.useState<PrivacyLevel | null>(null)
  const surfaceRef = React.useRef<HTMLDivElement>(null)
  const baseId = React.useId()

  const optionId = (v: PrivacyLevel) =>
    `${baseId}-opt-${v.replace(/[^a-z0-9]/gi, '_')}`

  const ActiveIcon = LEVEL_ICONS[value]

  function handleOpenChange(next: boolean) {
    if (disabled) return
    setOpen(next)
    if (next) {
      setCursor(value)
      requestAnimationFrame(() => surfaceRef.current?.focus())
    }
  }

  function commit(level: PrivacyLevel) {
    onChange(level)
    setOpen(false)
  }

  const navLevels: PrivacyLevel[] = ['only-me', 'hub', 'public']

  function move(delta: number) {
    setCursor((cur) => {
      const idx = cur == null ? 0 : Math.max(0, navLevels.indexOf(cur))
      const nextIdx = Math.min(navLevels.length - 1, Math.max(0, idx + delta))
      return navLevels[nextIdx] ?? cur
    })
  }

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      handleOpenChange(true)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (cursor != null) commit(cursor)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  const activeDescendant =
    open && cursor != null ? optionId(cursor) : undefined

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          fieldShellClass,
          'flex h-9 w-full items-center justify-between gap-2 px-3 text-sm text-apt-text outline-none',
          'hover:border-apt-border-strong',
          'focus-visible:border-apt-gold focus-visible:ring-2 focus-visible:ring-apt-gold/25',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        <span className="flex items-center gap-2 truncate">
          <ActiveIcon className="size-3.5 shrink-0 text-apt-text-muted" aria-hidden="true" />
          {LEVEL_LABELS[value]}
        </span>
        <ChevronsUpDown
          size={14}
          aria-hidden="true"
          className="shrink-0 text-apt-text-muted"
        />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-72 p-1">
        <div
          ref={surfaceRef}
          role="listbox"
          aria-label={ariaLabel}
          aria-activedescendant={activeDescendant}
          onKeyDown={onKeyDown}
          tabIndex={0}
          className="outline-none"
        >
          {PRIVACY_OPTIONS.map((opt) => {
            const highlighted = cursor === opt.value
            const checked = value === opt.value
            const Icon = opt.icon
            return (
              <button
                key={opt.value}
                id={optionId(opt.value)}
                type="button"
                role="option"
                aria-selected={checked}
                data-highlighted={highlighted || undefined}
                onMouseEnter={() => setCursor(opt.value)}
                onClick={() => commit(opt.value)}
                className="flex w-full cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-left text-sm text-apt-text data-[highlighted]:bg-apt-highlight/15"
              >
                <Check
                  size={14}
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 shrink-0',
                    checked ? 'text-apt-gold' : 'opacity-0',
                  )}
                />
                <Icon
                  size={14}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-apt-text-muted"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium leading-snug">{opt.label}</div>
                  <div className="text-xs text-apt-text-dim">{opt.description}</div>
                </div>
              </button>
            )
          })}

          {/* Disabled coming-soon affordance */}
          <div
            role="option"
            aria-selected="false"
            aria-disabled="true"
            className="flex cursor-not-allowed items-start gap-2 rounded-md px-2 py-2 opacity-40"
          >
            {/* Spacer aligning with check column */}
            <span className="size-[14px] shrink-0" aria-hidden="true" />
            <Building2
              size={14}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-apt-text-muted"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 font-medium leading-snug text-apt-text">
                Team / Org
                <Badge variant="blue">Coming soon</Badge>
              </div>
              <div className="text-xs text-apt-text-dim">
                Visible to members of your organization
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
