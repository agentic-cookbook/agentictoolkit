// Shared theme helpers for the adh suite. Kept tiny: the one rule the editor hook
// and the load-time applier both need is "which baked seed is this key (or its base)".

import { type SwitcherThemeKey } from './adh-themes'
import { switcherThemeKeys } from './theme-keys'

/** True when `key` names a baked switchable seed (an adh font-variant OR a
 *  full-palette theme) — i.e. a theme with a static alt-block that can serve as a
 *  base. DB themes are `basedOn` one of these. */
export function isSwitcherSeed(key: string | null): key is SwitcherThemeKey {
  return key != null && (switcherThemeKeys() as string[]).includes(key)
}

/** Concatenate a theme's per-item CSS blocks into the applied stylesheet (empties
 *  dropped). One definition, shared by the editor hook and the load-time applier. */
export function concatItemCss(data: Record<string, string>): string {
  return Object.values(data)
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n\n')
}
