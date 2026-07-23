"use client"

/**
 * THE HTDV LAYOUT LOG — tracing for `HierarchicalTopicDetail`'s responsive layout: the wide↔narrow
 * mode decision, the covered/minimized stacks' fit passes (what got collapsed, what slid
 * off-screen, where the detail landed and why), the disclosure toggles, and the narrow stack's
 * push/pop. The HMDV cascade has `cascade-log.ts` for its interaction machine; this is the same
 * idea for the HTDV's GEOMETRY, born from the shrink-behavior bugs ("all the lists hid at once")
 * that are invisible in a screenshot and unreproducible from a verbal report — one live resize with
 * the log on shows exactly which phase fired at which width.
 *
 * Enabling: `setHtdvLayoutLog(on)` — flipped by the HOST, not a user switch. The adh shell turns it
 * on for every environment EXCEPT production (the call sits behind the same build-inlined
 * environment allowlist as the other dev tools, so a production bundle dead-code-eliminates it and
 * ships the default: off). `hlog` is a cheap no-op while off.
 *
 * Reading: lines look like
 *
 *     [htdv#12 +830ms workspaces] fit w=712 lists=3 covered=[ws,features] hidden=1 offshift=240
 *
 * `#12` is a global sequence, `+830ms` is since the first line, `workspaces` is the surface (the
 * stack's root level id). Every line is also kept in a bounded buffer: `__htdvLogDump()` in the
 * console returns the whole trace as one string (`copy(__htdvLogDump())` to grab it).
 */

type LogGlobals = {
  __htdvLogOn?: boolean
  __htdvLogSeq?: number
  __htdvLogT0?: number
  __htdvLog?: string[]
  __htdvLogDump?: () => string
}

/** Pinned on `globalThis` so chunks/copies of this module share one switch, sequence and buffer. */
const g = globalThis as LogGlobals

const BUFFER_MAX = 4000

/** Turn the HTDV layout log on/off. Host-called (see the module doc); default off. */
export function setHtdvLayoutLog(on: boolean): void {
  g.__htdvLogOn = on
}

/** Whether the HTDV layout log is on. */
export function getHtdvLayoutLog(): boolean {
  return g.__htdvLogOn === true
}

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

/** Log one layout event. No-op unless {@link setHtdvLayoutLog} turned the log on. */
export function hlog(scope: string, event: string, data?: Record<string, unknown>): void {
  if (!getHtdvLayoutLog()) return
  g.__htdvLogT0 ??= Date.now()
  const seq = (g.__htdvLogSeq = (g.__htdvLogSeq ?? 0) + 1)
  const pairs = data
    ? " " +
      Object.entries(data)
        .map(([k, v]) => `${k}=${fmt(v)}`)
        .join(" ")
    : ""
  const line = `[htdv#${seq} +${Date.now() - g.__htdvLogT0}ms ${scope}] ${event}${pairs}`
  const buf = (g.__htdvLog ??= [])
  buf.push(line)
  if (buf.length > BUFFER_MAX) buf.splice(0, buf.length - BUFFER_MAX)
  g.__htdvLogDump ??= () => (g.__htdvLog ?? []).join("\n")
  // console.log (not .debug): default console filters must show it — the whole point is pasteability.
  console.log(line)
}
