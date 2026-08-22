"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * The platform's keyboard-shortcut registry: ONE `keydown` listener on the document, and a set of
 * declared chords on top of it.
 *
 * Every shortcut in this codebase used to be a `useEffect` adding its own `window` listener — nine
 * of them at last count, each with its own guard for "am I typing in a field", its own idea of
 * whether ⌘ or Ctrl is the command key, and no way for anyone to find out what keys are taken. That
 * is fine for one Escape handler inside one dialog, and it does not survive a chord that must work
 * anywhere on the page: a global opener needs a listener with no owner, and two of them on the same
 * chord silently both fire.
 *
 * So the knowledge that moves here is not "how to add a listener" — it is the three decisions every
 * one of those copies made separately:
 *
 *  - **what `mod` means.** A chord says `mod`, and the registry resolves it to ⌘ on Apple platforms
 *    and Ctrl everywhere else. The other one is never part of a chord: Ctrl+K on a Mac is a terminal
 *    binding (delete-to-end-of-line) that has nothing to do with the ⌘K a Mac user means.
 *  - **whether it fires while typing.** An UNMODIFIED chord does not fire when focus is in a text
 *    field — otherwise `?` would be unusable in every input on the page. A chord with `mod` or `alt`
 *    does fire, because that is the whole point of ⌘K: it is reachable from inside the search box it
 *    opens. `allowInInput` overrides the first case; nothing overrides the second.
 *  - **who wins when two match.** The MORE SPECIFIC chord (more declared modifiers), and among
 *    equals the most recently registered — i.e. the dialog that just mounted beats the page behind
 *    it. Exactly one handler runs.
 *
 * What the registry is NOT: an event-handling layer. It listens in the BUBBLE phase on `document`,
 * so a component that handles a key itself and calls `stopPropagation` still wins — local beats
 * global, which is what makes a dialog's own Escape safe from anything declared here.
 *
 * A registered chord is also ENUMERABLE ({@link useRegisteredShortcuts}), which is the other half of
 * the reason this exists: a keyboard surface nobody can list is a keyboard surface nobody discovers.
 */

/* ── Chords ───────────────────────────────────────────────────────────────── */

export interface ShortcutSpec {
  /**
   * The chord, e.g. `"mod+k"`, `"?"`, `"escape"`, `"shift+enter"`. Case-insensitive; modifiers are
   * `mod`, `alt` (or `option`) and `shift`, joined with `+`, in any order, before the key.
   *
   * The key names the CHARACTER the key produces, not the physical key: `"?"`, never `"shift+/"`.
   * That is what makes a chord layout-independent — on a keyboard where `?` needs no shift, `"?"`
   * still matches. `shift` is therefore only meaningful with a NAMED key (`"shift+enter"`), and is
   * ignored for single-character ones.
   */
  keys: string;
  /** What it does, in the words a help sheet would use. Required — an unlabelled chord is a chord
   *  that cannot be listed, and listing them is half of why they are registered here. */
  label: string;
  /** Groups the shortcut in an enumerated list. */
  group?: string;
  /** Fire even while focus is in a text field. Only affects UNMODIFIED chords — one carrying `mod`
   *  or `alt` always fires (see the module comment). */
  allowInInput?: boolean;
  /** Registered but inert, and omitted from the enumerated list, while false. Declaring a shortcut
   *  conditionally-inert beats mounting the hook conditionally, which React forbids. */
  enabled?: boolean;
  /** Keep it out of {@link useRegisteredShortcuts} — for a chord that is an implementation detail
   *  of one surface rather than something to advertise. It still fires. */
  hidden?: boolean;
}

/** A shortcut as an enumerated list sees it. */
export interface RegisteredShortcut {
  keys: string;
  label: string;
  group?: string;
}

interface Chord {
  mod: boolean;
  alt: boolean;
  shift: boolean;
  /** `event.key`, lowercased. */
  key: string;
  /** How many modifiers the chord declares — the tie-break when two chords match one event. */
  weight: number;
}

/** Spellings a chord may use for keys whose `event.key` is longer or less obvious. */
const KEY_ALIASES: Record<string, string> = {
  esc: "escape",
  space: " ",
  spacebar: " ",
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
  del: "delete",
  return: "enter",
  plus: "+",
};

export function parseChord(keys: string): Chord {
  const raw = keys.trim().toLowerCase();
  const parts = raw.split("+").map((p) => p.trim()).filter(Boolean);
  let mod = false;
  let alt = false;
  let shift = false;
  let key = "";
  for (const part of parts) {
    if (part === "mod") mod = true;
    else if (part === "alt" || part === "option") alt = true;
    else if (part === "shift") shift = true;
    else key = KEY_ALIASES[part] ?? part;
  }
  // `"+"` and `"mod++"` split into nothing but modifiers — the separator ate the key. Nothing needs
  // that chord today; recovering it here costs a line and beats a chord that silently never fires.
  if (key === "" && raw.endsWith("+")) key = "+";
  const weight = (mod ? 1 : 0) + (alt ? 1 : 0) + (shift ? 1 : 0);
  return { mod, alt, shift, key, weight };
}

/** ⌘ on Apple platforms, Ctrl elsewhere. `false` on the server (no navigator to ask). */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  // `platform` is deprecated but is the only field that still distinguishes an Apple desktop; the
  // user agent covers iOS and any engine that has already dropped it.
  return /mac|iphone|ipad|ipod/i.test(`${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`);
}

function matchesEvent(chord: Chord, e: KeyboardEvent): boolean {
  const command = isApplePlatform() ? e.metaKey : e.ctrlKey;
  const other = isApplePlatform() ? e.ctrlKey : e.metaKey;
  // The non-command modifier is never part of a chord, so holding it means the user asked for
  // something else (a browser or OS binding) — not for this.
  if (other) return false;
  if (chord.mod !== command) return false;
  if (chord.alt !== e.altKey) return false;
  if (e.key.toLowerCase() !== chord.key) return false;
  // Shift is compared exactly for a NAMED key; for a character key the character itself already
  // records whether shift was needed to produce it (see ShortcutSpec.keys).
  if (chord.shift) return e.shiftKey;
  return chord.key.length === 1 ? true : !e.shiftKey;
}

/** Where an unmodified chord must keep its hands off: the user is writing, not commanding. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (target === null || typeof HTMLElement === "undefined") return false;
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/* ── The registry ─────────────────────────────────────────────────────────── */

interface Entry {
  chord: Chord;
  spec: ShortcutSpec;
  run: (e: KeyboardEvent) => void;
  /** Registration order, so "most recent wins" is decidable. */
  seq: number;
}

const entries: Entry[] = [];
const listeners = new Set<() => void>();
let nextSeq = 0;
let bound = false;
/** The enumerated view, rebuilt on change so `useSyncExternalStore` sees a stable identity between
 *  registrations (a fresh array per read would re-render forever). */
let snapshot: RegisteredShortcut[] = [];
const EMPTY: RegisteredShortcut[] = [];

function rebuildSnapshot(): void {
  snapshot = entries
    .filter((e) => e.spec.enabled !== false && e.spec.hidden !== true)
    .map((e) => ({ keys: e.spec.keys, label: e.spec.label, group: e.spec.group }));
  for (const listener of [...listeners]) listener();
}

function onKeyDown(e: KeyboardEvent): void {
  // Mid-composition an IME reports every keystroke as a keydown; acting on one would fire a
  // shortcut while someone is spelling a word in Japanese.
  if (e.isComposing) return;
  const editable = isEditableTarget(e.target);
  const matched = entries.filter(
    (entry) =>
      entry.spec.enabled !== false &&
      matchesEvent(entry.chord, e) &&
      (!editable || entry.spec.allowInInput === true || entry.chord.mod || entry.chord.alt),
  );
  if (matched.length === 0) return;
  // Most specific first, then most recently registered — see the module comment.
  matched.sort((a, b) => b.chord.weight - a.chord.weight || b.seq - a.seq);
  e.preventDefault();
  matched[0]!.run(e);
}

function bind(): void {
  if (bound || typeof document === "undefined") return;
  document.addEventListener("keydown", onKeyDown);
  bound = true;
}

function unbind(): void {
  if (!bound || typeof document === "undefined") return;
  document.removeEventListener("keydown", onKeyDown);
  bound = false;
}

/**
 * Register a shortcut imperatively; returns the unregister. {@link useShortcut} is the React face of
 * this and is what components should use — this is for the rare owner that outlives a component.
 */
export function registerShortcut(
  spec: ShortcutSpec,
  run: (e: KeyboardEvent) => void,
): () => void {
  const entry: Entry = { chord: parseChord(spec.keys), spec, run, seq: nextSeq++ };
  entries.push(entry);
  bind();
  rebuildSnapshot();
  return () => {
    const i = entries.indexOf(entry);
    if (i < 0) return;
    entries.splice(i, 1);
    if (entries.length === 0) unbind();
    rebuildSnapshot();
  };
}

/**
 * Declare a shortcut for as long as the component is mounted.
 *
 * `run` may be a fresh closure every render — it is read through a ref, so only the SPEC's fields
 * re-register. That matters: re-registering on every render would reset the "most recent wins"
 * order on every keystroke of an unrelated input.
 */
export function useShortcut(spec: ShortcutSpec, run: (e: KeyboardEvent) => void): void {
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });
  const { keys, label, group, allowInInput, enabled, hidden } = spec;
  useEffect(
    () =>
      registerShortcut({ keys, label, group, allowInInput, enabled, hidden }, (e) =>
        runRef.current(e),
      ),
    [keys, label, group, allowInInput, enabled, hidden],
  );
}

/** Every shortcut currently registered and visible — the list a help sheet or a palette renders.
 *  Empty on the server, because nothing has mounted to register anything yet. */
export function useRegisteredShortcuts(): RegisteredShortcut[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => EMPTY,
  );
}

/* ── Capture ──────────────────────────────────────────────────────────────── */

/** `event.key` values that name a modifier rather than a chord — pressing one alone is a
 *  user still mid-chord, not a chord. */
const MODIFIER_KEYS = new Set(["meta", "control", "shift", "alt", "altgraph", "capslock"]);

/** Keys a chord may never be RECORDED onto, whatever modifiers are held. Escape and Tab are
 *  structural: Escape dismisses the surface a recorder runs inside, and Tab is how a keyboard
 *  user leaves it, so capturing either would take away the way out of the recorder itself. */
const UNBINDABLE_KEYS = new Set(["escape", "tab"]);

/** Chord spellings for `event.key` values {@link parseChord}'s `+` split cannot carry. */
const KEY_SPELLINGS: Record<string, string> = { " ": "space" };

/**
 * Turn a live keydown into the chord string that would match it — the inverse of
 * {@link parseChord}, for a UI that records a shortcut by asking the user to press one.
 *
 * Returns `null` when the event is not a recordable chord: a bare modifier press, Escape or
 * Tab, or the non-command modifier (Ctrl on Apple, ⌘ elsewhere) — which `matchesEvent` refuses
 * outright, so a chord recorded from it could never fire again.
 *
 * `shift` is emitted only where `matchesEvent` actually reads it: alongside `mod`/`alt`, or on
 * a NAMED key. For a bare character the character itself already records that shift was held
 * (`"?"`, never `"shift+/"`) — see {@link ShortcutSpec.keys}.
 */
export function chordFromEvent(e: KeyboardEvent): string | null {
  const key = e.key.toLowerCase();
  if (MODIFIER_KEYS.has(key)) return null;
  if (UNBINDABLE_KEYS.has(key)) return null;
  const apple = isApplePlatform();
  const command = apple ? e.metaKey : e.ctrlKey;
  const other = apple ? e.ctrlKey : e.metaKey;
  if (other) return null;
  const parts: string[] = [];
  if (command) parts.push("mod");
  if (e.altKey) parts.push("alt");
  const spelled = KEY_SPELLINGS[key] ?? key;
  if (e.shiftKey && (command || e.altKey || spelled.length > 1)) parts.push("shift");
  parts.push(spelled);
  return parts.join("+");
}

/** Do two chord strings name the same keystroke? Compares the PARSED chords, so
 *  `"mod+shift+k"` and `"shift+mod+K"` are recognised as one binding — which is what a
 *  conflict check needs, since neither spelling is canonical. */
export function sameChord(a: string, b: string): boolean {
  const x = parseChord(a);
  const y = parseChord(b);
  return x.mod === y.mod && x.alt === y.alt && x.shift === y.shift && x.key === y.key;
}

/* ── Display ──────────────────────────────────────────────────────────────── */

const NAMED_KEY_LABELS: Record<string, string> = {
  escape: "Esc",
  enter: "Enter",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  backspace: "⌫",
  delete: "Del",
  tab: "Tab",
  " ": "Space",
};

/**
 * A chord as a human reads it: `"mod+k"` → `⌘K` on Apple platforms, `Ctrl+K` elsewhere.
 *
 * CLIENT-ONLY by nature — it asks the platform, and the server has no answer, so a chord rendered
 * into server HTML would hydrate to a different string. Render it inside something the user opened
 * (every surface in this package that shows one is), or gate it on mount.
 */
export function formatChord(keys: string): string {
  const chord = parseChord(keys);
  const apple = isApplePlatform();
  const parts: string[] = [];
  if (chord.mod) parts.push(apple ? "⌘" : "Ctrl");
  if (chord.alt) parts.push(apple ? "⌥" : "Alt");
  if (chord.shift) parts.push(apple ? "⇧" : "Shift");
  parts.push(NAMED_KEY_LABELS[chord.key] ?? chord.key.toUpperCase());
  return parts.join(apple ? "" : "+");
}
