/**
 * The persona chat status line: the action word pairs a persona cycles while it works, and
 * the glyph it animates through. Everything here is pure — no React, no network — because
 * three surfaces resolve it (the hub's editor pane, the registry's visitor preview, and the
 * editor's own live preview) and none of them should own the rules.
 *
 * Mirrors `ChatStatusConfig` in backend/src/adh/src/db/schema/persona.ts, which stores it.
 * When they disagree, the backend wins: `parseChatStatus` takes `unknown` on purpose.
 */

/**
 * What a persona can be doing. Three of these are emitted today (`think`, `respond`,
 * `retry`); the rest are the vocabulary authors can configure ahead of the producers that
 * will emit them. Nothing breaks in the meantime — an unemitted kind is simply never asked
 * for, and a persona that never configured one resolves through the fallback chain.
 *
 * Stored tags are FREE STRINGS, not this union. This list is what the UI offers and what
 * the producer can emit; the column holds whatever the author saved, so retiring a kind
 * never needs a migration.
 */
export const CHAT_STATUS_KINDS = [
  "think",
  "respond",
  "retry",
  "search",
  "tool",
  "memory",
  "knowledge",
  "research",
  "wire",
  "db",
] as const;

export type ChatStatusKind = (typeof CHAT_STATUS_KINDS)[number];

/** Both forms, always authored — see the renderer's StatusWordPair for why nothing derives one. */
export interface StatusWordPair {
  tags: string[];
  present: string;
  past: string;
}

export interface StatusIconSet {
  tags: string[];
  frames: string[];
}

export interface StatusTint {
  color: string;
  applies: "words" | "icons" | "both";
}

export interface ChatStatusConfig {
  words: StatusWordPair[];
  icons: StatusIconSet[];
  tint?: StatusTint;
}

/** What a resolved status hands the renderer. `frames` is one set, not a list of sets. */
export interface ResolvedChatStatus {
  words: StatusWordPair[];
  frames: string[];
  tint?: StatusTint;
}

/**
 * The set a new persona starts with, and the last step of the fallback chain. One constant
 * for both roles on purpose: "what an unconfigured persona shows" and "what a new persona is
 * given to edit" are the same knowledge, and two copies of it drift.
 */
export const CHAT_STATUS_DEFAULT: ChatStatusConfig = {
  words: [
    { tags: ["think"], present: "thinking", past: "thought" },
    { tags: ["respond"], present: "responding", past: "responded" },
    { tags: ["retry"], present: "trying again", past: "tried again" },
    { tags: [], present: "working", past: "worked" },
    { tags: [], present: "investigating", past: "investigated" },
  ],
  icons: [{ tags: [], frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] }],
};

/** A deep copy, so a draft's rows are never the constant's rows. */
export function chatStatusBlank(): ChatStatusConfig {
  return {
    words: CHAT_STATUS_DEFAULT.words.map((w) => ({ ...w, tags: [...w.tags] })),
    icons: CHAT_STATUS_DEFAULT.icons.map((i) => ({ ...i, tags: [...i.tags], frames: [...i.frames] })),
  };
}

/**
 * The picker library. A CODE constant, not a table: adding a word is a code change either
 * way (a table would need a seeding migration), and in code it ships, reviews and rolls back
 * with everything around it. Nothing here is ever written to an existing persona — the
 * author adds what they want, and new presets appear in the picker, never in their config.
 */
export const CHAT_STATUS_WORD_PRESETS: readonly StatusWordPair[] = [
  { tags: ["think"], present: "thinking", past: "thought" },
  { tags: ["think"], present: "pondering", past: "pondered" },
  { tags: ["think"], present: "mulling it over", past: "mulled it over" },
  { tags: ["think"], present: "figuring it out", past: "figured it out" },
  { tags: ["respond"], present: "responding", past: "responded" },
  { tags: ["respond"], present: "writing", past: "wrote" },
  { tags: ["retry"], present: "trying again", past: "tried again" },
  { tags: ["search"], present: "searching", past: "searched" },
  { tags: ["search"], present: "digging around", past: "dug around" },
  { tags: ["tool"], present: "running a tool", past: "ran a tool" },
  { tags: ["memory"], present: "remembering", past: "remembered" },
  { tags: ["knowledge"], present: "reading up", past: "read up" },
  { tags: ["research"], present: "researching", past: "researched" },
  { tags: ["wire"], present: "sending", past: "sent" },
  { tags: ["db"], present: "looking it up", past: "looked it up" },
  { tags: [], present: "working", past: "worked" },
  { tags: [], present: "investigating", past: "investigated" },
  { tags: [], present: "puttering", past: "puttered" },
];

export const CHAT_STATUS_ICON_PRESETS: readonly { name: string; frames: string[] }[] = [
  { name: "Braille", frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] },
  { name: "Sparkle", frames: ["·", "✢", "✳", "✶", "✻", "✽"] },
  { name: "Orb", frames: ["o", "O", "⊙", "◉"] },
  { name: "Arc", frames: ["◜", "◝", "◞", "◟"] },
  { name: "Blocks", frames: ["▖", "▘", "▝", "▗"] },
  { name: "Moon", frames: ["◐", "◓", "◑", "◒"] },
  { name: "Pulse", frames: ["▁", "▃", "▅", "▇", "▅", "▃"] },
];

function tagsOf(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((t): t is string => typeof t === "string" && t.trim() !== "").map((t) => t.trim());
}

function textOf(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseWords(v: unknown): StatusWordPair[] {
  if (!Array.isArray(v)) return [];
  const out: StatusWordPair[] = [];
  for (const row of v) {
    if (row === null || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const present = textOf(r.present);
    const past = textOf(r.past);
    // A pair with one half is not a pair, and there is nothing to derive the other from.
    if (!present || !past) continue;
    out.push({ tags: tagsOf(r.tags), present, past });
  }
  return out;
}

function parseIcons(v: unknown): StatusIconSet[] {
  if (!Array.isArray(v)) return [];
  const out: StatusIconSet[] = [];
  for (const row of v) {
    if (row === null || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const frames = Array.isArray(r.frames)
      ? r.frames.filter((f): f is string => typeof f === "string" && f !== "")
      : [];
    if (frames.length === 0) continue;
    out.push({ tags: tagsOf(r.tags), frames });
  }
  return out;
}

function parseTint(v: unknown): StatusTint | undefined {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return undefined;
  const r = v as Record<string, unknown>;
  const color = textOf(r.color);
  if (!color) return undefined;
  const applies = r.applies === "words" || r.applies === "icons" ? r.applies : "both";
  return { color, applies };
}

/**
 * Lenient by contract, the way `canDemoChat` is: this reads a jsonb column written by an
 * older or newer client, so it takes `unknown` and never throws. A persona's status line is
 * decoration; it must not be able to take a chat down.
 *
 * Drops malformed rows but does NOT substitute defaults for an empty list: an author who
 * deletes every word or every glyph set gets back `[]`, not `CHAT_STATUS_DEFAULT`'s rows.
 * `resolveChatStatus` already totalizes through its own fallback chain at render time, so a
 * parser-level substitution here would only make "this persona has no custom words"
 * inexpressible — deleting the last row would jump straight back to five instead of staying
 * at zero. The `raw === null` case just below is different in kind: a persona that never
 * configured `chat_status` at all still starts from `chatStatusBlank()`, because there is no
 * "the author deleted everything" to distinguish it from.
 */
export function parseChatStatus(raw: unknown): ChatStatusConfig {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return chatStatusBlank();
  const r = raw as Record<string, unknown>;
  const words = parseWords(r.words);
  const icons = parseIcons(r.icons);
  const tint = parseTint(r.tint);
  return { words, icons, ...(tint ? { tint } : {}) };
}

// `-Draft` twins of `tagsOf`/`textOf`: no trim, no empty-drop. A tag or a frame that is not a
// string is still rejected (an editor's controlled arrays are built from strings; anything
// else is a shape bug, not an in-progress edit), but an empty string or a bare space is one
// of the states an author passes through while typing and must round-trip unchanged.
function tagsOfDraft(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string") : [];
}

function textOfDraft(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function parseWordsDraft(v: unknown): StatusWordPair[] {
  if (!Array.isArray(v)) return [];
  const out: StatusWordPair[] = [];
  for (const row of v) {
    if (row === null || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    // Unlike `parseWords`, a half-written pair is kept: "half-written" is exactly what a row
    // looks like the instant it is added, or the instant its Past field is cleared to retype.
    out.push({ tags: tagsOfDraft(r.tags), present: textOfDraft(r.present), past: textOfDraft(r.past) });
  }
  return out;
}

function parseIconsDraft(v: unknown): StatusIconSet[] {
  if (!Array.isArray(v)) return [];
  const out: StatusIconSet[] = [];
  for (const row of v) {
    if (row === null || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const frames = Array.isArray(r.frames)
      ? r.frames.filter((f): f is string => typeof f === "string")
      : [];
    // Unlike `parseIcons`, a glyph set with zero frames is kept — that is what "Add glyph
    // set" produces before the author has typed a single character into it.
    out.push({ tags: tagsOfDraft(r.tags), frames });
  }
  return out;
}

/**
 * The EDITOR's narrowing, and deliberately not `parseChatStatus`.
 *
 * `parseChatStatus` is a STORAGE validator: it drops a word missing a half, drops a glyph set
 * with no frames, and trims. Those are the right rules for a blob arriving from the database
 * and exactly the wrong ones for a form, because every intermediate authoring state is one of
 * the rows it drops. Feeding a controlled editor through it makes "Add word pair" a no-op and
 * makes a space untypeable.
 *
 * So this narrows the SHAPE and preserves the CONTENT: same `unknown` input, same never-throws
 * contract, but incomplete rows survive and text passes through verbatim. Saving an incomplete
 * row is harmless — `parseChatStatus` drops it on the way back out.
 */
export function parseChatStatusDraft(raw: unknown): ChatStatusConfig {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return chatStatusBlank();
  const r = raw as Record<string, unknown>;
  const words = parseWordsDraft(r.words);
  const icons = parseIconsDraft(r.icons);
  const tint = parseTint(r.tint);
  return { words, icons, ...(tint ? { tint } : {}) };
}

function firstNonEmpty<T>(...lists: T[][]): T[] {
  for (const l of lists) if (l.length > 0) return l;
  return [];
}

/**
 * Total by construction: tagged rows, then untagged rows, then the built-in default. Words
 * and glyphs walk the chain independently, so a persona can have a special word for
 * searching without also needing a special glyph for it.
 *
 * Words vary WITHIN a turn (the caller draws from the returned list without replacement);
 * the glyph does not. When several icon sets match, the first wins — a glyph that swapped
 * alphabets mid-thought is exactly the continuity error this feature exists to avoid.
 */
export function resolveChatStatus(raw: unknown, kind: string): ResolvedChatStatus {
  const cfg = parseChatStatus(raw);
  const fallback = chatStatusBlank();

  // A word is eligible when it names this kind OR names nothing — the editor's hint says an
  // untagged word "fits anything", and an exclusive chain contradicted that. With one pair per
  // tag in CHAT_STATUS_DEFAULT, every kind the engine emits resolved to a ONE-element list, so
  // the shuffle bag redrew the same word forever and the status line never changed.
  const eligible = (list: StatusWordPair[]) =>
    list.filter((w) => w.tags.includes(kind) || w.tags.length === 0);
  const words = firstNonEmpty(eligible(cfg.words), eligible(fallback.words));

  // Icons stay EXCLUSIVE, unlike words just above — this asymmetry is deliberate, not a
  // leftover of the bug words had. When several icon sets match, the first wins: a glyph that
  // swapped alphabets mid-thought is exactly the continuity error this feature exists to
  // avoid, and a union would let an untagged glyph set interleave with a tagged one frame by
  // frame. Do not "fix" this to match the words chain above.
  const icons = firstNonEmpty(
    cfg.icons.filter((i) => i.tags.includes(kind)),
    cfg.icons.filter((i) => i.tags.length === 0),
    fallback.icons,
  );

  // `icons[0]!` is safe even though `cfg.icons` can now be `[]` (parseChatStatus no longer
  // substitutes defaults for an empty list — see its docstring): `fallback.icons` is
  // `chatStatusBlank()`'s icons, which always holds the one built-in glyph set, so the last
  // rung of the chain above is never empty and `firstNonEmpty` never returns `[]` here.
  return { words, frames: icons[0]!.frames, ...(cfg.tint ? { tint: cfg.tint } : {}) };
}
