// A form definition's slots — the ONE piece of game content this UI understands.
//
// `game.definitions.data` is opaque to adh everywhere else, and it stays opaque here:
// the raw-JSON editor is still the surface, and this module is a TYPED VIEW onto one
// key of it (`.slots`). Everything else in `data` is read, carried, and written back
// untouched.
//
// Why it earns the exception: a `kind = 'form'` definition's slots decide which values
// a player may TYPE. Per §6.5 of docs/features/game-schema.md, only free-text slot
// values are screened before an artifact is published or a term is minted, and that
// screening call is the ONLY thing standing between a player-supplied string and the
// game's shared vocabulary. So the choice must be explicit per slot — never a default,
// never inferred — which is why `FormSlot.input` is nullable and a slot with no choice
// made fails validation rather than quietly becoming one or the other.

/** How a slot is filled. There is no third value and no default. */
export type SlotInputMode = "free-text" | "curated";

export interface FormSlot {
  /** The slot's handle, unique within the form. */
  key: string;
  /** What the player sees above the slot. */
  label: string;
  /** `null` until the operator chooses. NOT a default — see this file's header. */
  input: SlotInputMode | null;
  /** Every OTHER key of this slot object, carried verbatim — the same reason `SlotsDoc.rest`
   *  exists one level up. A slot may hold anything the engine wants (a `min_rank`, an option
   *  list, a hint); this editor names three keys and must hand the rest back untouched. */
  extra?: Record<string, unknown>;
  /** Whether the source slot had a `label` THIS EDITOR TOOK — i.e. a string one. Absent and
   *  empty are different things to an engine, and this is a document adh only carries:
   *  minting `label: ""` on a slot that never had one is us writing content, which is
   *  exactly what we promised not to do. A non-string `label` was never taken and rides in
   *  `extra` instead, so this is false for it. */
  hadLabel?: boolean;
}

export interface SlotsDoc {
  slots: FormSlot[];
  /** Every OTHER key of `data`, carried verbatim so writing slots never drops one. */
  rest: Record<string, unknown>;
}

export type SlotsRead =
  | { ok: true; doc: SlotsDoc }
  /** Why the typed editor cannot be shown. Rendered to the operator beside the raw
   *  editor: what we can't read, we say so about — we never silently discard it. */
  | { ok: false; reason: string };

function isSlotMode(value: unknown): value is SlotInputMode {
  return value === "free-text" || value === "curated";
}

/**
 * Read `data`'s slots. Empty data is an empty form, not an error: a definition whose
 * `data` has never been written is exactly where an operator starts adding slots.
 */
export function readSlots(data: string): SlotsRead {
  const text = data.trim();
  if (!text) return { ok: true, doc: { slots: [], rest: {} } };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      reason:
        "This definition’s data isn’t valid JSON yet, so its slots can’t be edited as a list. Fix the JSON below and the slot editor comes back — nothing you typed has been changed.",
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      reason:
        "This definition’s data is valid JSON but not a JSON object, so it has nowhere to hold slots. Edit it below as an object with a “slots” list.",
    };
  }

  const obj = parsed as Record<string, unknown>;
  const rest = { ...obj };
  delete rest.slots;

  const raw = obj.slots;
  if (raw === undefined || raw === null) return { ok: true, doc: { slots: [], rest } };
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      reason:
        "This definition’s data has a “slots” key that isn’t a list, so it can’t be edited as one. Edit it below.",
    };
  }

  const slots: FormSlot[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return {
        ok: false,
        reason:
          "One of this definition’s slots isn’t an object, so the list can’t be edited here. Edit the data below.",
      };
    }
    const row = entry as Record<string, unknown>;
    if (typeof row.key !== "string") {
      return {
        ok: false,
        reason:
          "One of this definition’s slots has no text “key”, so the list can’t be edited here. Edit the data below.",
      };
    }
    // The rule for both of the keys this editor claims is the same, and it is about TYPE,
    // not name: a value we RECOGNISE is ours to rewrite, and one we do not is somebody
    // else's, so it stays in `extra` and is written back verbatim. A `label: 42` edited
    // through the text box used to come back as `label: ""` — we would have deleted a
    // number because it sat under a key we happen to use. An unrecognised `input` stays
    // too; the slot still reads as unanswered (below), so the form is invalid until a
    // human picks, and only then does the operator's answer overwrite it.
    const hasLabel = typeof row.label === "string";
    const extra = { ...row };
    delete extra.key;
    if (hasLabel) delete extra.label;
    if (isSlotMode(row.input)) delete extra.input;
    slots.push({
      key: row.key,
      label: hasLabel ? (row.label as string) : "",
      // Anything that is not one of the two known modes reads as NOT CHOSEN, which
      // makes the form invalid until a human picks one. An unrecognised mode must not
      // be allowed to pass for "curated" — that is the unscreened path.
      input: isSlotMode(row.input) ? row.input : null,
      extra,
      // Only a label we took is one we owe back. A non-string one is in `extra` now, so
      // claiming it here would write BOTH — ours empty, over theirs.
      hadLabel: hasLabel,
    });
  }
  return { ok: true, doc: { slots, rest } };
}

/**
 * Write `slots` back into `data`, keeping every other key — of the document AND of each
 * slot. Unreadable data is returned UNCHANGED rather than replaced: the operator's text is
 * theirs, and the editor that would have called this is not shown in that state anyway.
 *
 * The rule for a key adh does not own is the same in both directions: carry what was there,
 * and mint nothing that was not. Whitespace is the one thing this does rewrite (the document
 * is re-serialised at two-space indent), because JSON formatting carries no meaning; a KEY
 * NAME does, and an engine is free to read absent and empty as different answers.
 *
 * The one narrow exception is the surrounding whitespace of a slot key, which is TRIMMED —
 * because `validateSlots` judged the trimmed form, and what the operator approved has to be
 * what gets written. Leave it and a slot typed as `" hp"` passes validation as `hp` and
 * persists as something else, and two slots the validator rejected as duplicates would have
 * been distinct on disk. This never deletes or invents a key, and the raw JSON editor below
 * remains the way to write one whose whitespace is load-bearing.
 */
export function writeSlots(data: string, slots: FormSlot[]): string {
  const read = readSlots(data);
  if (!read.ok) return data;
  const serialized = slots.map((slot) => {
    const out: Record<string, unknown> = { key: slot.key.trim(), ...slot.extra };
    // An empty label on a slot that never had one is not written: `label: ""` would be a
    // key we invented. A slot that HAD a label keeps it, empty or not.
    if (slot.label !== "" || slot.hadLabel) out.label = slot.label;
    // A slot with no choice made carries no `input` of ours, so re-reading it yields `null`
    // again and the form stays invalid. Writing a placeholder would look like a choice on
    // the next read.
    if (slot.input !== null) out.input = slot.input;
    return out;
  });
  return JSON.stringify({ ...read.doc.rest, slots: serialized }, null, 2);
}

/** Returns the first problem with a form's slots, or null when they are all answerable. */
export function validateSlots(slots: FormSlot[]): string | null {
  const seen = new Set<string>();
  for (const slot of slots) {
    const key = slot.key.trim();
    if (!key) return "Every form slot needs a key.";
    if (seen.has(key)) return `Two form slots share the key “${key}”.`;
    seen.add(key);
    if (slot.input === null) {
      return `Choose free text or curated for the “${key}” slot — there is no default.`;
    }
  }
  return null;
}
