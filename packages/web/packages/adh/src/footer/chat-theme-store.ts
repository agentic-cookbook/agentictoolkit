'use client'

import { useCallback, useSyncExternalStore } from 'react'
// Via bitbag, not `@agenticdevelopertoolkit/themes` directly: that package lives in
// a SIBLING SUBMODULE this one must not reach into (a `link:` across submodules only
// resolves in a checkout that has both, and this toolkit is consumed by repos that
// have neither). bitbag owns the `theme` prop these values feed, already peer-depends
// on the vocabulary, and re-exports it for exactly this. Same reason `persona-chat/
// chat-types.ts` keeps a local copy of that submodule's chat types.
import { themeIds, type ThemeKey } from '@agentic-toolkit/bitbag'

/**
 * Which toolkit theme the footer chat wears. Written by the hub's Debug console
 * ("Chat theme"), read by `FooterChatInner`, which hands it to `BitbagDock` as a
 * PROP.
 *
 * Passing the key in is the only thing that works. bitbag renders his own scoped
 * `<ThemeStyle scope=".pc-theme-scope">` INSIDE the dock, so a host block scoped
 * to the outer `.adh-footer__chat` sets the same custom properties on a FARTHER
 * ancestor and simply loses — the picker looked wired and re-themed nothing. The
 * theme has to reach the component that owns the scope root, not fight it from
 * outside.
 *
 * Lives here rather than in the hub because the footer chat is shared: the store
 * is a localStorage key plus a same-tab broadcast event, so the writer (hub-only)
 * and the reader (every site's footer) need the same module. `null` = bitbag's
 * own default skin.
 */
const STORAGE_KEY = 'adh-chat-theme'

function readStored(): ThemeKey | null {
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
