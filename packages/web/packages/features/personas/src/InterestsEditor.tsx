"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Field, FieldGroup, ButtonBar } from "@agentic-toolkit/ui/blocks";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import { Button } from "@agentic-toolkit/ui/components/button";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { errMsg, httpStatus } from "@agentic-toolkit/data";
import {
  specialInterestsApi,
  type SpecialInterestRow,
} from "@agentic-toolkit/data/personas";

// A persona's one or two DEEP interests: three narrowing levels plus the author's own opinions.
//
// The stances go into the system prompt VERBATIM, which is the entire point — a persona with
// stances argues its corner instead of agreeing with whatever the user says. Nothing here is
// generated: an empty stances box means a persona that knows the topic but has no view on it.
//
// Interests are a child table with their own routes, so each one saves on its own rather than
// riding the persona draft's save. That keeps the pane honest (an interest is either saved or
// visibly unsaved) at the cost of a Save button per card.

/** The cap the backend enforces (400 past it). Mirrored here to disable the add button. */
const MAX_INTERESTS = 2;

/** A card's editable state. `id` is null until the first successful save. `key` is a client-only
 *  identity, stable for the card's whole lifetime, that `save`/`remove` address instead of the
 *  card's position in `drafts` — see `newKey` below for why. */
interface Draft {
  key: string;
  id: string | null;
  slug: string;
  general: string;
  topical: string;
  specific: string;
  stances: string;
}

/** A stable client-side identity for a draft card. Deliberately NOT derived from `id`: a brand-new
 *  card has no id at all, and that is exactly the card that must stay addressable across its first
 *  save. Deliberately NOT the array index either — `save`/`remove` are async and capture their
 *  target before an await, and a sibling's completion in between (a faster delete, a synchronous
 *  remove of an earlier card) can shift every later card's index out from under them, landing the
 *  eventual `map`/`filter` on the wrong row. `crypto.randomUUID` needs a secure context, so this
 *  falls back to a counter — uniqueness only has to hold for one component instance's lifetime. */
let keySeq = 0;
function newKey(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  keySeq += 1;
  return `draft-${Date.now()}-${keySeq}`;
}

function toDraft(row: SpecialInterestRow, key: string): Draft {
  return {
    key,
    id: row.id,
    slug: row.slug,
    general: row.general,
    topical: row.topical ?? "",
    specific: row.specific ?? "",
    stances: row.stances ?? "",
  };
}

/** The rdid segment for a new interest, derived from its most specific level so the author
 *  never has to name one. Lower-case, [a-z0-9-] only, no leading/trailing/repeated dashes. */
export function slugify(...levels: string[]): string {
  const source = levels.map((l) => l.trim()).filter(Boolean).pop() ?? "";
  // Slice to the rdid segment's length limit BEFORE stripping edge dashes, not after — a cut
  // that lands mid dash-run (e.g. a 63-char word followed by " b") leaves a trailing "-" if the
  // strip already ran, which the server then 400s on as an unusable slug the author never typed.
  return source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 64)
    .replace(/^-+|-+$/g, "");
}

/** The card's heading — the most specific level the author has typed, so it reads the way the
 *  interest narrows (Battlestar Galactica, or Space Opera, or just Science Fiction while the
 *  author is still filling it in), and "New interest" before anything is typed at all. */
function cardTitle(d: Draft): string {
  return d.specific.trim() || d.topical.trim() || d.general.trim() || "New interest";
}

/** Matches the pre-create hook's exact message (`backend/src/adh/src/crud/pre-create-hooks.ts`,
 *  `specialInterestCreate`) for the two-interest cap — the ONE 400 with a distinct, stable text.
 *  Every other 400 (a level over its 120-character limit, an unusable slug, …) comes back from
 *  generic CRUD's Zod-validation catch as the flat, field-blind "invalid request body" — so that
 *  branch below names the length limit instead of blaming a cap the author hasn't hit. */
const CAP_MESSAGE = /at most \d+ special interests?/i;

/** Turn a save failure into something the author can act on. 409 = this persona already has an
 *  interest by that name, 403 = no write on the table (the `x-exposure` gate —
 *  `persona.special_interests` is owner-tier, so this only fires for someone who is not the
 *  owner). 400 covers two backend failures that share a status but not a cause — see
 *  `CAP_MESSAGE` above for how they're told apart. */
function saveError(err: unknown): string {
  const status = httpStatus(err);
  if (status === 400) {
    return CAP_MESSAGE.test(errMsg(err, ""))
      ? `A persona can hold at most ${MAX_INTERESTS} interests.`
      : "Each level must be 120 characters or fewer, and General can't be blank.";
  }
  if (status === 409) return "This persona already has an interest by that name.";
  if (status === 403) return "You don't have permission to change this persona's interests.";
  return errMsg(err, "Could not save this interest.");
}

export function InterestsEditor({ personaId }: { personaId: string | null }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A SET, not a single value: concurrent operations on DIFFERENT cards (delete B, then delete A
  // while B is still in flight) are a legitimate flow, not a same-card double-click, and each
  // card's own busy state must track only its own request regardless of what else is in flight.
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());

  const setBusy = (key: string, busy: boolean) =>
    setBusyKeys((prev) => {
      const next = new Set(prev);
      if (busy) next.add(key);
      else next.delete(key);
      return next;
    });

  const reload = useCallback(async () => {
    if (!personaId) return;
    setLoading(true);
    try {
      const rows = await specialInterestsApi.list(personaId);
      setDrafts(rows.map((row) => toDraft(row, newKey())));
      setError(null);
    } catch (err) {
      setError(errMsg(err, "Could not load this persona's interests."));
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!personaId) {
    return (
      <p className="text-sm text-apt-text-muted">
        Save this persona first to give it special interests.
      </p>
    );
  }

  const set = (index: number, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  const add = () =>
    setDrafts((prev) => [
      ...prev,
      { key: newKey(), id: null, slug: "", general: "", topical: "", specific: "", stances: "" },
    ]);

  // `save`/`remove` take the card's KEY, never its array index or position at call time. Both are
  // async: the array can reorder while one is in flight (a sibling's delete resolving first, a
  // synchronous remove of an earlier card), and an index captured at dispatch would then apply the
  // eventual `map`/`filter` to whatever card has slid into that slot — not the card the author
  // actually clicked. Keying by `key` makes the write land on the right row regardless of order.
  const save = async (key: string) => {
    const d = drafts.find((row) => row.key === key);
    if (!d) return;
    setBusy(key, true);
    setError(null);
    try {
      let saved: SpecialInterestRow;
      if (d.id) {
        saved = await specialInterestsApi.update(d.id, {
          general: d.general,
          topical: d.topical || null,
          specific: d.specific || null,
          stances: d.stances || null,
        });
      } else {
        // The slug is an rdid segment and immutable once minted (it names the interest's
        // storage bucket), so derive it ONCE, on create, from the most specific level.
        const slug = d.slug || slugify(d.general, d.topical, d.specific);
        saved = await specialInterestsApi.create({
          personaId,
          slug,
          general: d.general,
          topical: d.topical || null,
          specific: d.specific || null,
          stances: d.stances || null,
        });
      }
      // Patch ONLY this card from the server's response, addressed by its stable key — a
      // wholesale `reload()` would replace every card with fresh server rows, silently
      // discarding any sibling card's local edits that haven't been saved yet (including a
      // brand-new card with no id at all); an index-addressed patch would land on whichever
      // card now sits at that position if the array reordered while this save was in flight.
      setDrafts((prev) => prev.map((row) => (row.key === key ? toDraft(saved, key) : row)));
    } catch (err) {
      setError(saveError(err));
    } finally {
      setBusy(key, false);
    }
  };

  const remove = async (key: string) => {
    const d = drafts.find((row) => row.key === key);
    if (!d) return;
    if (!d.id) {
      setDrafts((prev) => prev.filter((row) => row.key !== key));
      return;
    }
    setBusy(key, true);
    setError(null);
    try {
      await specialInterestsApi.delete(d.id);
      // Drop just this card locally, addressed by key — see `save` above for why an
      // index-addressed filter is wrong once a concurrent operation can reorder the array.
      setDrafts((prev) => prev.filter((row) => row.key !== key));
    } catch (err) {
      setError(errMsg(err, "Could not remove this interest."));
    } finally {
      setBusy(key, false);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">Special interests</h3>
        <p className="text-xs text-apt-text-muted">
          One or two topics this persona knows deeply and has opinions about. Narrow from general
          to specific — Science Fiction → Space Opera → Battlestar Galactica. Whatever you write
          under Opinions goes into the persona&apos;s prompt word for word, so it will argue these
          points, including with you. Declaring an interest also creates a place to put research:
          fill it from the Knowledge facet.
        </p>
      </div>

      <ErrorText error={error} />

      {drafts.map((d, i) => (
        <FieldGroup key={d.key} title={cardTitle(d)}>
          {/* `Field` wraps caption + hint in the SAME <label> as the input, so a hint alone would
              fold into the field's accessible name and defeat an anchored `getByLabelText`
              query. Fix is the `aria-label` idiom from `add-users-modal.tsx`: it matches the
              input directly regardless of what text the surrounding label carries, so the hint
              stays for the author while the query stays exact. */}
          <Field label="General" hint="The broad field.">
            <Input
              aria-label="General"
              value={d.general}
              onChange={(e) => set(i, { general: e.target.value })}
              placeholder="Science Fiction"
              maxLength={120}
            />
          </Field>
          {/* The levels NARROW, so they fill left to right: there is no coherent "Space Opera"
              without a field it narrows, and the slug derives from the most specific one.
              Disabled only while BOTH this field and the one it narrows are empty — never while
              it already holds a value, loaded or typed. A row can legally arrive from the server
              with `topical: null, specific: 'X'` (no CHECK constraint ties the two), and clearing
              the parent level in-session must not strand the child's still-present value behind a
              disabled input the author can no longer reach to edit or clear. */}
          <Field label="Topical" hint="The narrower area within it.">
            <Input
              aria-label="Topical"
              value={d.topical}
              onChange={(e) => set(i, { topical: e.target.value })}
              placeholder="Space Opera"
              disabled={!d.general.trim() && !d.topical.trim()}
              maxLength={120}
            />
          </Field>
          <Field label="Specific" hint="The one thing it is intense about.">
            <Input
              aria-label="Specific"
              value={d.specific}
              onChange={(e) => set(i, { specific: e.target.value })}
              placeholder="Battlestar Galactica"
              disabled={!d.topical.trim() && !d.specific.trim()}
              maxLength={120}
            />
          </Field>
          <Field
            label="Opinions"
            hint="In the persona's own voice. Written verbatim into its prompt — this is what it will defend."
          >
            <Textarea
              aria-label="Opinions"
              value={d.stances}
              onChange={(e) => set(i, { stances: e.target.value })}
              placeholder="Loves the miniseries. Hates how the Cylons libel machine minds…"
              className="min-h-32 resize-y"
            />
          </Field>
          <ButtonBar>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void remove(d.key)}
              disabled={busyKeys.has(d.key)}
            >
              <Trash2 size={14} aria-hidden /> Remove
            </Button>
            <Button
              type="button"
              onClick={() => void save(d.key)}
              disabled={busyKeys.has(d.key) || !d.general.trim()}
            >
              Save interest
            </Button>
          </ButtonBar>
        </FieldGroup>
      ))}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={add}
          disabled={loading || drafts.length >= MAX_INTERESTS}
        >
          Add an interest
        </Button>
        {drafts.length >= MAX_INTERESTS && (
          <span className="text-xs text-apt-text-muted">
            A persona can hold at most two interests — deep beats broad.
          </span>
        )}
      </div>
    </section>
  );
}
