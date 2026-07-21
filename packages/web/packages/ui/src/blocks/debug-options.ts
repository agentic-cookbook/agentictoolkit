"use client"

import { useSyncExternalStore } from "react"

/**
 * DEV-ONLY debug switches for the hierarchical views. Three today:
 *
 *  - SHOW MOUSE FRAMES — draw the mouse-detection rectangles the menus hit-test against. They are
 *    invisible by construction, so anything depending on them (auto-disclose, auto-collapse) is
 *    impossible to reason about from a screenshot: a rect that is one frame STALE looks exactly like
 *    a correct one. Seeing them is the difference between diagnosing and guessing.
 *  - SLOW ANIMATIONS — stretch every transition 10x, so a 300ms move takes 3s and can be watched.
 *    Scope is deliberate: TRANSITIONS and one-shot animations stretch, but indeterminate loops
 *    (spinners, skeleton sweeps, ambient pulses) do NOT. A loop has no choreography to study — every
 *    frame is already on screen — and at 10x a spinner reads as a hang rather than a slow spinner.
 *  - CASCADE LOG — one console line per cascade interaction event (machine transitions with their
 *    reasons, rail-click decisions with the resolved leafness, hold edges, pointer-authority
 *    verdicts, paint changes). The mouse frames show WHERE the regions are; this shows WHICH rule
 *    fired and WHY — the difference between "it moved" and a pasteable trace of what moved it.
 *    See `cascade-log.ts`.
 *
 * They live HERE rather than in a consuming app because this package owns the behaviour; an app's
 * Debug panel just flips them. Storage/notification mirrors the app-side `envOverride` store: the
 * values are in localStorage (shared across every copy of this module and every tab), and the
 * subscriber set is pinned on `globalThis` so a write from a Debug panel in one bundle chunk still
 * notifies a menu in another. All default OFF.
 */
const KEYS = {
  frames: "apt:debug:show-mouse-frames",
  slowAnim: "apt:debug:slow-animations",
  cascadeLog: "apt:debug:cascade-log",
} as const

/** How much longer everything takes with SLOW ANIMATIONS on. */
export const SLOW_ANIM_FACTOR = 10

/**
 * Tailwind's own default transition duration. Its `transition-*` utilities emit
 * `transition-duration: var(--tw-duration, var(--default-transition-duration))` and define
 * `--default-transition-duration: 150ms` on `:root`, so every transition that doesn't name an
 * explicit duration resolves through this one variable — and re-pointing it scales all of them at
 * once. Keep in step with the `--default-transition-duration` in Tailwind's `theme.css`.
 */
const TW_DEFAULT_TRANSITION_MS = 150

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
const readCascadeLog = () => read(KEYS.cascadeLog)
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
/** Whether the cascade interaction log is on (see `cascade-log.ts`). */
export function getCascadeLog(): boolean {
  return readCascadeLog()
}
/** Turn the cascade interaction log on/off. */
export function setCascadeLog(on: boolean): void {
  write(KEYS.cascadeLog, on)
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
export function useCascadeLog(): boolean {
  return useSyncExternalStore(subscribe, readCascadeLog, serverFalse)
}

/**
 * The CSS variables that stretch animation timing while SLOW ANIMATIONS is on. Apply them to the
 * DOCUMENT ROOT (`<html>`) while it's on and REMOVE them when it's off — never write an "off" value.
 * Both variables already have a resting definition (Tailwind's `--default-transition-duration`, and
 * the `, 1` fallback each duration carries), so absence IS the off state; writing `1` / `150ms`
 * instead would pin today's numbers and silently override a future change to either.
 *
 * Root, not a view container, for two reasons:
 *
 *  - Dialogs, popovers and menus render through a PORTAL into `document.body`, escaping the React
 *    tree entirely. A style on any view's container can never reach them; only an ancestor of the
 *    portal host can, and `<html>` is the one ancestor everything shares.
 *  - Tailwind defines `--default-transition-duration` on `:root`, so the override below has to land
 *    there to win. An inline style on `<html>` beats the stylesheet rule and still inherits.
 *
 * Between them the two variables cover every animation that doesn't hard-code its own duration:
 * the scale stretches each explicit `calc(<base> * var(--apt-anim-scale, 1))` duration (each keeping
 * its OWN base), and the Tailwind default covers every transition that never named one.
 *
 * A build that never applies these — production, where the Debug console is dead-code-eliminated —
 * keeps its stock timing, because an unset variable is a no-op on both counts.
 */
export function slowAnimationVars(): Record<string, string> {
  return {
    "--apt-anim-scale": String(SLOW_ANIM_FACTOR),
    "--default-transition-duration": `${TW_DEFAULT_TRANSITION_MS * SLOW_ANIM_FACTOR}ms`,
  }
}
