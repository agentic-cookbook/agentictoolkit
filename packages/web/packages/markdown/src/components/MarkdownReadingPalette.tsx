// NO "use client" — a plain server-safe wrapper (no hooks, no client-only APIs) so an async
// RSC (e.g. the research site's PaperRenderer) can render it without becoming a Client
// Component. See @agentic-toolkit/markdown's own note on the "use client" propagation trap:
// one client export in this barrel puts the directive on the WHOLE bundle.

import type { CSSProperties, ReactNode } from 'react'
import { DEFAULT_THEME_ID, getThemeById } from '../themes/registry'

export interface MarkdownReadingPaletteProps {
  children: ReactNode
  /** Reading theme id; defaults to the package's DEFAULT_THEME_ID (the same default every
   *  existing call site hardcodes today). */
  themeId?: string
  className?: string
}

/**
 * The reading-palette wrapper: `data-mdv-theme` + `data-mdv-shiki-variant` + the theme's
 * `--mdv-*` custom properties as inline `style`, applied around markdown content.
 *
 * This is the same 5-line boilerplate the research site's `PaperRenderer` and the search
 * package's `MarkdownPreview` each hand-roll around `getThemeById(DEFAULT_THEME_ID)` —
 * `@agentic-toolkit/markdown`'s own knowledge about its own palette, so it lives here rather
 * than being copied a third time by `MarkdownDocumentEditor`'s preview pane. Those two
 * existing call sites are NOT migrated to this — that is separate work, out of scope here.
 *
 * Children-based and carrying no client-only API on purpose: `PaperRenderer` is an async RSC
 * and would need to stay one if it ever adopts this wrapper.
 */
export function MarkdownReadingPalette({
  children,
  themeId = DEFAULT_THEME_ID,
  className,
}: MarkdownReadingPaletteProps) {
  const theme = getThemeById(themeId)
  return (
    <div
      data-mdv-theme={theme.id}
      data-mdv-shiki-variant={theme.shikiVariant}
      style={theme.palette as CSSProperties}
      className={className}
    >
      {children}
    </div>
  )
}
