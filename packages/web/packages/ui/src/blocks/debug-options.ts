"use client"

import { useSyncExternalStore } from "react"

/**
 * DEV-ONLY debug switches for the hierarchical views. Two today:
 *
 *  - SHOW MOUSE FRAMES — draw the mouse-detection rectangles the menus hit-test against. They are
 *    invisible by construction, so anything depending on them (auto-disclose, auto-collapse) is
 *    impossible to reason about from a screenshot: a rect that is one frame STALE looks exactly like
 *    a correct one. Seeing them is the difference between diagnosing and guessing.
 *  - SLOW ANIMATIONS — stretch every transition 10x, so a 300ms move takes 3s and can be watched.
 *
 * They live HERE rather than in a consuming app because this package owns the behaviour; an app's
 * Debug panel just flips them. Storage/notification mirrors the app-side `envOverride` store: the
 * values are in localStorage (shared across every copy of this module and every tab), and the
 * subscriber set is pinned on `globalThis` so a write from a Debug panel in one bundle chunk still
 * notifies a menu in another. Both default OFF.
 */
const KEYS = {
  frames: "apt:debug:show-mouse-frames",
  slowAnim: "apt:debug:slow-animations",
} as const

/** How much longer everything takes with SLOW ANIMATIONS on. */
export const SLOW_ANIM_FACTOR = 10

const listeners: Set<() => void> = ((
  globalThis as { __aptDebugOptionListeners?: Set<() => void> }
).__aptDebugOptionListeners ??= new Set())

function read(key: string): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(key) === "1"
  } catch {
    return false
  }
}

function write(key: string, on: boolean): void {
  if (typeof window === "undefined") return
  try {
    if (on) window.localStorage.setItem(key, "1")
    else window.localStorage.removeItem(key)
  } catch {
    /* storage disabled (private mode) — the emit below still updates this tab */
  }
  for (const fn of listeners) fn()
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  // `storage` only fires in OTHER tabs; same-tab writes come through the emit in `write`.
  const onStorage = (e: StorageEvent): void => {
    if (e.key != null && (Object.values(KEYS) as string[]).includes(e.key)) onChange()
  }
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(onChange)
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage)
  }
}

const readFrames = () => read(KEYS.frames)
const readSlow = () => read(KEYS.slowAnim)
const serverFalse = () => false

/** Whether to draw the debug mouse-detection frames. */
export function getShowDebugFrames(): boolean {
  return readFrames()
}
/** Turn the debug mouse-detection frames on/off. */
export function setShowDebugFrames(on: boolean): void {
  write(KEYS.frames, on)
}
/** Whether animations are stretched by {@link SLOW_ANIM_FACTOR}. */
export function getSlowAnimations(): boolean {
  return readSlow()
}
/** Turn 10x-slow animations on/off. */
export function setSlowAnimations(on: boolean): void {
  write(KEYS.slowAnim, on)
}

/**
 * Subscribe to a flag. `false` on the server and the first client render, so a stored `true` can
 * never cause a hydration mismatch; live thereafter.
 */
export function useShowDebugFrames(): boolean {
  return useSyncExternalStore(subscribe, readFrames, serverFalse)
}
export function useSlowAnimations(): boolean {
  return useSyncExternalStore(subscribe, readSlow, serverFalse)
}

/**
 * The style object carrying the animation-scale variable. Spread it onto a view's ROOT container:
 * every `duration-[calc(<base>ms*var(--apt-anim-scale,1))]` beneath it then stretches together, each
 * keeping its OWN base duration. The `,1` fallback means anything rendered outside such a container
 * is simply unaffected, so this can never change production timing.
 */
export function animScaleStyle(slow: boolean): Record<string, string> {
  return { "--apt-anim-scale": slow ? String(SLOW_ANIM_FACTOR) : "1" }
}
