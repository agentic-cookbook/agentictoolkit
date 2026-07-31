'use client'

import { useCallback, useSyncExternalStore } from 'react'
// Via bitbag, not `@agenticdevelopertoolkit/themes` directly: that package lives in
// a SIBLING SUBMODULE this one must not reach into (a `link:` across submodules only
// resolves in a checkout that has both, and this toolkit is consumed by repos that
// have neither). bitbag owns the `theme` prop these values feed, already peer-depends
// on the vocabulary, and re-exports it for exactly this. Same reason `persona-chat/
// chat-types.ts` keeps a local copy of that submodule's chat types.
import { themeIds, type ThemeKey } from '@agentic-toolkit/bitbag'
import { DEV_BUILD } from '@agentic-toolkit/adh-registry/deployment-env'

/**
 * Which toolkit theme the footer chat wears. Written by the hub's Debug console
 * ("Chat theme"), read by `FooterChatInner`, which hands it to `BitbagDock` as a
 * PROP.
 *
 * Passing the key in is the only thing that works. bitbag renders his own scoped
 * `<ThemeStyle scope=".pc-theme-scope">` INSIDE the dock, so a host block scoped
 * to `.adh-footer__chat` — which is the dock's own root, not a wrapper around it,
 * but still an ancestor of the scope root — sets the same custom properties
 * FARTHER out and simply loses. The picker looked wired and re-themed nothing. The
 * theme has to reach the component that owns the scope root, not fight it from
 * outside.
 *
 * Lives here rather than in the hub because the footer chat is shared: the store
 * is a localStorage key plus a same-tab broadcast event, so the writer (hub-only)
 * and the reader (every site's footer) need the same module. `null` = bitbag's
 * own default skin, which is what production always gets — see
 * {@link THEME_SWITCH_ENABLED}.
 */
const STORAGE_KEY = 'adh-chat-theme'

/**
 * The picker is a DEV AFFORDANCE. bitbag ships on one skin — the lamp, his
 * `DEFAULT_THEME` — everywhere he mounts, because he is one creature and not a
 * different one per site; the other themes are for looking at while building.
 * Trying them on is fine in local/testing/staging, so this gates the READ rather
 * than the write: a key left in localStorage by a dev session (or typed in by
 * hand) must not re-skin production, and the writer is already hub-Debug-only.
 * Folded to `false` at build time in production, so the whole store degrades to a
 * constant `null` and bitbag falls through to his own default.
 *
 * The same gate the dev tail and AppShell use — see adh-registry's deployment-env, which
 * fails safe on an unset or unknown env: shipping skin, never a stored one.
 */
const THEME_SWITCH_ENABLED = DEV_BUILD

function readStored(): ThemeKey | null {
  if (!THEME_SWITCH_ENABLED) return null
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v && (themeIds as readonly string[]).includes(v)) return v as ThemeKey
  } catch {
    // best-effort
  }
  return null
}

function writeStored(next: ThemeKey | null): void {
  if (typeof window === 'undefined') return
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, next)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // best-effort
  }
  // `storage` only fires in OTHER tabs, so broadcast in-tab explicitly.
  window.dispatchEvent(new CustomEvent(STORAGE_KEY))
}

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(STORAGE_KEY, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(STORAGE_KEY, callback)
    window.removeEventListener('storage', callback)
  }
}

export function useChatTheme(): [ThemeKey | null, (next: ThemeKey | null) => void] {
  // Server snapshot is null: the choice is client-only, and claiming a theme
  // during SSR would hydration-mismatch anyone who has picked one.
  const theme = useSyncExternalStore(subscribe, readStored, () => null)
  const setTheme = useCallback((next: ThemeKey | null) => writeStored(next), [])
  return [theme, setTheme]
}
