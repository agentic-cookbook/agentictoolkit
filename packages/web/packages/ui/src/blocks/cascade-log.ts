"use client"

/**
 * THE CASCADE INTERACTION LOG — dev-only tracing for `HierarchicalMenuDetail`'s cascading view.
 *
 * Why this exists: the cascade's regressions ("the menu I clicked moved", "it auto-collapsed when
 * it shouldn't") reproduce under a real hand and NOT under synthetic input, so every diagnosis so
 * far was reconstructed backwards from a verbal symptom report. This log replaces that guessing
 * with evidence: one console line per interaction event — every machine transition WITH ITS REASON,
 * every rail-click decision with the leafness it resolved (and where the declaration came from:
 * item / level / the `"detail"` fail-safe), every hold edge, every pointer-authority verdict with
 * the coordinates and region it judged, every level (un)registration, and every painted-geometry
 * change. One real repro with the switch on tells us which rule fired and why, instead of another
 * round of inference.
 *
 * Enabling: the `apt:debug:cascade-log` switch in `debug-options.ts` (flipped from a consuming
 * app's Debug panel, which only exists on dev/testing builds — production never mounts the panel).
 * Default OFF; `clog` is a cheap no-op while off, so the taps cost nothing in normal use.
 *
 * Reading: lines look like
 *
 *     [hmdv#41 +3521ms workspaces·i2] rail-click col=1 level=features row=personas action=select
 *       collapse=false guarded=true leadsTo=list(item)
 *
 * `#41` is a global sequence (interleavings across remounts stay ordered), `+3521ms` is since the
 * first line, `workspaces·i2` is surface + component instance (a route remount bumps the instance,
 * so state surviving a remount is visible as i2 continuing i1's story). Every line is also kept in
 * a bounded buffer: `__hmdvLogDump()` in the console returns the whole trace as one string
 * (`copy(__hmdvLogDump())` to grab it) — so a repro can be pasted even after the console scrolled.
 */

import { getCascadeLog } from "./debug-options"

type LogGlobals = {
  __hmdvLogSeq?: number
  __hmdvLogT0?: number
  __hmdvLog?: string[]
  __hmdvLogDump?: () => string
}

/** Pinned on `globalThis` so chunks/copies of this module share one sequence and one buffer. */
const g = globalThis as LogGlobals

const BUFFER_MAX = 4000

function fmt(v: unknown): string {
  if (v == null) return "∅"
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(1)
  if (Array.isArray(v)) return `[${v.map(fmt).join(",")}]`
  if (typeof v === "object")
    return `{${Object.entries(v as Record<string, unknown>)
      .map(([k, x]) => `${k}:${fmt(x)}`)
      .join(" ")}}`
  return String(v)
}

/**
 * Log one interaction event. No-op unless the `apt:debug:cascade-log` switch is on (and always on
 * the server, where the switch reads false).
 */
export function clog(scope: string, event: string, data?: Record<string, unknown>): void {
  if (!getCascadeLog()) return
  g.__hmdvLogT0 ??= Date.now()
  const seq = (g.__hmdvLogSeq = (g.__hmdvLogSeq ?? 0) + 1)
  const pairs = data
    ? " " +
      Object.entries(data)
        .map(([k, v]) => `${k}=${fmt(v)}`)
        .join(" ")
    : ""
  const line = `[hmdv#${seq} +${Date.now() - g.__hmdvLogT0}ms ${scope}] ${event}${pairs}`
  const buf = (g.__hmdvLog ??= [])
  buf.push(line)
  if (buf.length > BUFFER_MAX) buf.splice(0, buf.length - BUFFER_MAX)
  g.__hmdvLogDump ??= () => (g.__hmdvLog ?? []).join("\n")
  // console.log (not .debug): default console filters must show it — the whole point is pasteability.
  console.log(line)
}
