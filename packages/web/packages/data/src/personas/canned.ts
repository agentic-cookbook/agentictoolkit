// The demo-chat predicate and pacing ceilings, mirrored from the backend.
//
// `backend/src/adh/src/llm/canned/config.ts` is AUTHORITATIVE: it decides both what the
// public persona payload publishes as `demoEnabled` and whether the turn facet actually
// claims the turn. The toolkit deliberately does not import backend or generated types, so
// this is a hand-kept copy — the same arrangement `wire.ts` already uses for the config's
// shape. Keep the two in step; when they disagree, the backend wins.
//
// It exists because owner-side surfaces hold the RAW `canned_chat` jsonb (the CRUD row), not
// the server's derived `demoEnabled` boolean, and each was re-deriving "does this persona
// demo?" from `enabled` alone. That reads true for a script the server refuses to serve — an
// empty one, one whose rows were added but never typed into, or a malformed row — so the UI
// promised a scripted demo the visitor would never get (and, with a real service configured,
// quietly held a live conversation on the owner's key instead).

/**
 * Ceilings on author-tunable pacing, mirroring CANNED_MAX_THINK_MS / CANNED_MAX_TOKEN_MS.
 *
 * The backend holds the turn's DB transaction open for the whole SSE stream, so pacing is time
 * the session sits idle-in-transaction against Postgres' 30 s backstop; past it the turn is
 * rolled back, taking the visitor's own message with it. The server CLAMPS over-ceiling values
 * rather than rejecting them, so these are here only to show the author the ceiling (as `max`
 * on the editor's inputs) before it silently bites.
 */
export const DEMO_MAX_THINK_MS = 5_000;
export const DEMO_MAX_TOKEN_MS = 500;

function nonBlank(s: string): boolean {
  return s.trim() !== "";
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === "string");
}

/** Mirrors parsePacing's accept/reject decision (not its clamping, which cannot change it). */
function pacingParses(raw: unknown): boolean {
  if (raw == null) return true; // absent pacing takes the defaults
  if (typeof raw !== "object" || Array.isArray(raw)) return false;
  const r = raw as Record<string, unknown>;
  for (const k of ["thinkMinMs", "thinkJitterMs", "tokenMinMs", "tokenJitterMs"] as const) {
    const v = r[k];
    if (v === undefined) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return false;
  }
  return r.reveal === undefined || r.reveal === "word" || r.reveal === "char";
}

/**
 * Mirrors parseScript + the content half of canClaim in one pass: is the script well-formed,
 * and does it leave at least one line the persona can actually say? Blank and whitespace-only
 * rows are dropped exactly as the server drops them — the editor's "Add" button creates one,
 * and a script of nothing but those cannot answer a single turn.
 */
function scriptCanSpeak(raw: unknown): boolean {
  if (typeof raw !== "object" || raw == null || Array.isArray(raw)) return false;
  const r = raw as Record<string, unknown>;
  const intro = r.intro ?? [];
  const fallbacks = r.fallbacks ?? [];
  const seeded = r.seeded ?? [];
  const onExhausted = r.onExhausted ?? "reshuffle";
  if (!isStringArray(intro) || !isStringArray(fallbacks)) return false;
  if (onExhausted !== "reshuffle" && onExhausted !== "hold-last") return false;
  if (!Array.isArray(seeded)) return false;
  let usableSeeded = 0;
  for (const s of seeded) {
    if (typeof s !== "object" || s == null) return false;
    const e = s as Record<string, unknown>;
    if (!isStringArray(e.match) || typeof e.reply !== "string") return false;
    // Needs both a keyword that can match and something to say, or it can never fire.
    if (e.match.some(nonBlank) && nonBlank(e.reply)) usableSeeded += 1;
  }
  return intro.some(nonBlank) || fallbacks.some(nonBlank) || usableSeeded > 0;
}

/**
 * Whether this persona will ACTUALLY demo: the raw config parses AND is switched on AND has a
 * line to say. Mirrors the backend's `canDemoChat` — "we advertise a demo" and "we will serve
 * a demo" have to be the same question, asked once.
 *
 * Takes `unknown` on purpose: some call sites hold a typed `CannedChatConfig | null`, others
 * the generated spec's loose jsonb value, and CRUD/import writes can put anything in the
 * column. Anything it cannot vouch for is not a demo.
 */
export function canDemoChat(raw: unknown): boolean {
  if (raw == null || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  if (r.enabled !== true) return false;
  return pacingParses(r.pacing) && scriptCanSpeak(r.script);
}
