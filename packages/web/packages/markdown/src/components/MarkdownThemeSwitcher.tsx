'use client'

import { useId } from 'react'
import { Select } from '@agentic-toolkit/ui/components/select'
import { VIEWER_THEMES } from '../themes/registry'

export interface MarkdownThemeSwitcherProps {
  /** Currently active theme id. */
  activeThemeId: string
  /** Called when the user picks a different theme. */
  onThemeChange: (themeId: string) => void
}

/**
 * Theme picker for the MarkdownViewer.
 *
 * Reuses the @agentic-toolkit/ui Select primitive (a styled native <select>).
 * The <label> provides an accessible name; the Select element exposes the
 * native listbox role, so no additional ARIA is needed.
 */
export function MarkdownThemeSwitcher({
  activeThemeId,
  onThemeChange,
}: MarkdownThemeSwitcherProps): React.JSX.Element {
  // useId so multiple MarkdownViewer instances on one page don't emit duplicate
  // DOM ids (which would mis-associate the <label htmlFor> with the wrong select).
  const selectId = useId()
  return (
    <div className="flex flex-shrink-0 items-center gap-2" role="group">
      <label
        htmlFor={selectId}
        className="whitespace-nowrap text-xs text-apt-text-dim"
      >
        Theme
      </label>
      <Select
        id={selectId}
        value={activeThemeId}
        onChange={(e) => onThemeChange(e.currentTarget.value)}
        aria-label="Select reading theme"
        className="h-8 w-auto min-w-28 py-0 text-xs"
      >
        {VIEWER_THEMES.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.label}
          </option>
        ))}
      </Select>
    </div>
  )
}
