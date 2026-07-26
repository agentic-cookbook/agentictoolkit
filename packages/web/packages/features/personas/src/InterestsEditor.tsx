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

/** A card's editable state. `id` is null until the first successful save. */
interface Draft {
  id: string | null;
  slug: string;
  general: string;
  topical: string;
  specific: string;
  stances: string;
}

function toDraft(row: SpecialInterestRow): Draft {
  return {
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
  return source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** The card's heading — the most specific level the author has typed, so it reads the way the
 *  interest narrows (Battlestar Galactica, or Space Opera, or just Science Fiction while the
 *  author is still filling it in), and "New interest" before anything is typed at all. */
function cardTitle(d: Draft): string {
  return d.specific.trim() || d.topical.trim() || d.general.trim() || "New interest";
}

/** Turn a save failure into something the author can act on. The three the backend actually
 *  returns are distinguishable by status alone: 400 = the two-interest cap or an unusable name,
 *  409 = this persona already has an interest by that name, 403 = no write on the table (the
 *  `x-exposure` gate — `persona.special_interests` is owner-tier, so this only fires for someone
 *  who is not the owner). */
function saveError(err: unknown): string {
  const status = httpStatus(err);
  if (status === 400)
    return `A persona can hold at most ${MAX_INTERESTS} interests, and each needs a name with at least one letter or number.`;
  if (status === 409) return "This persona already has an interest by that name.";
  if (status === 403) return "You don't have permission to change this persona's interests.";
  return errMsg(err, "Could not save this interest.");
}

export function InterestsEditor({ personaId }: { personaId: string | null }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyIndex, setBusyIndex] = useState<number | null>(null);

  const reload = useCallback(async () => {
    if (!personaId) return;
    setLoading(true);
    try {
      const rows = await specialInterestsApi.list(personaId);
      setDrafts(rows.map(toDraft));
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
      { id: null, slug: "", general: "", topical: "", specific: "", stances: "" },
    ]);

  const save = async (index: number) => {
    // `index` always comes from mapping `drafts` itself (see the render below), so this is
    // never actually undefined — the guard is here only to satisfy noUncheckedIndexedAccess.
    const d = drafts[index];
    if (!d) return;
    setBusyIndex(index);
    setError(null);
    try {
      if (d.id) {
        await specialInterestsApi.update(d.id, {
          general: d.general,
          topical: d.topical || null,
          specific: d.specific || null,
          stances: d.stances || null,
        });
      } else {
        // The slug is an rdid segment and immutable once minted (it names the interest's
        // storage bucket), so derive it ONCE, on create, from the most specific level.
        const slug = d.slug || slugify(d.general, d.topical, d.specific);
        await specialInterestsApi.create({
          personaId,
          slug,
          general: d.general,
          topical: d.topical || null,
          specific: d.specific || null,
          stances: d.stances || null,
        });
      }
      await reload();
    } catch (err) {
      setError(saveError(err));
    } finally {
      setBusyIndex(null);
    }
  };

  const remove = async (index: number) => {
    const d = drafts[index];
    if (!d) return;
    if (!d.id) {
      setDrafts((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    setBusyIndex(index);
    setError(null);
    try {
      await specialInterestsApi.delete(d.id);
      await reload();
    } catch (err) {
      setError(errMsg(err, "Could not remove this interest."));
    } finally {
      setBusyIndex(null);
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
        <FieldGroup key={d.id ?? `new-${i}`} title={cardTitle(d)}>
          {/* No `hint` on these three: Field renders caption + hint inside the SAME <label> as
              the input, so a hint would fold into the field's accessible name. The narrowing
              guidance instead lives once, in the intro paragraph above; the placeholder
              (Science Fiction → Space Opera → Battlestar Galactica) carries the rest. */}
          <Field label="General">
            <Input
              value={d.general}
              onChange={(e) => set(i, { general: e.target.value })}
              placeholder="Science Fiction"
            />
          </Field>
          {/* The levels NARROW, so they fill left to right: there is no coherent "Space Opera"
              without a field it narrows, and the slug derives from the most specific one. */}
          <Field label="Topical">
            <Input
              value={d.topical}
              onChange={(e) => set(i, { topical: e.target.value })}
              placeholder="Space Opera"
              disabled={!d.general.trim()}
            />
          </Field>
          <Field label="Specific">
            <Input
              value={d.specific}
              onChange={(e) => set(i, { specific: e.target.value })}
              placeholder="Battlestar Galactica"
              disabled={!d.topical.trim()}
            />
          </Field>
          <Field
            label="Opinions"
            hint="In the persona's own voice. Written verbatim into its prompt — this is what it will defend."
          >
            <Textarea
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
              onClick={() => void remove(i)}
              disabled={busyIndex === i}
            >
              <Trash2 size={14} aria-hidden /> Remove
            </Button>
            <Button
              type="button"
              onClick={() => void save(i)}
              disabled={busyIndex === i || !d.general.trim()}
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
