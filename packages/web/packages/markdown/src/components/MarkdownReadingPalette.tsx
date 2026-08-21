// NO "use client" — a plain server-safe wrapper (no hooks, no client-only APIs) so an async
// RSC (e.g. the research site's PaperRenderer) can render it without becoming a Client
// Component. See @agentic-toolkit/markdown's own note on the "use client" propagation trap:
// one client export in this barrel puts the directive on the WHOLE bundle.

import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@agentic-toolkit/ui/lib/utils'
import { DEFAULT_THEME_ID, getThemeById } from '../themes/registry'

export interface MarkdownReadingPaletteProps {
  children: ReactNode
  /** Reading theme id; defaults to the package's DEFAULT_THEME_ID (the same default every
   *  existing call site hardcodes today). */
  themeId?: string
  className?: string
  /** DOM identity marker for the rendered surface, passed straight through. A host that
   *  needs to select or style this exact wrapper (a test, a sizing hook) uses this rather
   *  than reaching past it for a child that may not exist. */
  'data-slot'?: string
}

/**
 * The reading-palette wrapper: `data-mdv-theme` + `data-mdv-shiki-variant` + the theme's
 * `--mdv-*` custom properties as inline `style`, plus the `adh-mv-content` reading-surface
 * class (background, text color, overflow, and padding — all driven by the same `--mdv-*`
 * palette via `markdown-viewer.css`), applied around markdown content.
 *
 * `adh-mv-content` is load-bearing, not decorative: `.adh-mv-prose` (what `MarkdownRenderer`
 * emits) sets only `color`, never `background-color` — a "reading palette" that painted text
 * but no surface would be readable on the one host it happened to be built against and
 * unreadable everywhere else (e.g. `--mdv-text` on `dark` is near-white, and a light host page
 * behind it turns the preview into near-invisible text). So the surface is this component's
 * job, not each call site's.
 *
 * This is the same boilerplate the research site's `PaperRenderer` and the search package's
 * `MarkdownPreview` each hand-roll around `getThemeById(DEFAULT_THEME_ID)` —
 * `@agentic-toolkit/markdown`'s own knowledge about its own palette, so it lives here rather
 * than being copied a third time by `MarkdownDocumentEditor`'s preview pane. Those two
 * existing call sites are NOT migrated to this — that is separate work, out of scope here.
 *
 * `className` is merged (not replaced) via `cn`, so callers can still add layout classes
 * (sizing, borders, rounding) without fighting `adh-mv-content`'s own background/overflow/
 * padding rules — a caller should not also set overflow or padding, since this class already
 * supplies both.
 *
 * Children-based and carrying no client-only API on purpose: `PaperRenderer` is an async RSC
 * and would need to stay one if it ever adopts this wrapper.
 */
export function MarkdownReadingPalette({
  children,
  themeId = DEFAULT_THEME_ID,
  className,
  'data-slot': dataSlot,
}: MarkdownReadingPaletteProps) {
  const theme = getThemeById(themeId)
  return (
    <div
      data-slot={dataSlot}
      data-mdv-theme={theme.id}
      data-mdv-shiki-variant={theme.shikiVariant}
      style={theme.palette as CSSProperties}
      className={cn('adh-mv-content', className)}
    >
      {children}
    </div>
  )
}
