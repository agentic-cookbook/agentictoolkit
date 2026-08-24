"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"

import { Field, FIELD_LABEL_GROUP_CLASS } from "./field"
import { Input } from "../components/input"
import { cn } from "../lib/utils"
import { toneTextClass, type Tone } from "../lib/tone"

/** Where a slug stands: nothing to say, asking, free, or refused. */
export type SlugStatus = "idle" | "checking" | "available" | "unavailable"

export interface SlugVerdict {
  status: SlugStatus
  /** Why a slug was refused, when the checker said. Null otherwise. */
  reason: string | null
}

const IDLE: SlugVerdict = { status: "idle", reason: null }

/** Quiet time before asking. Long enough that a typed word is one question, short enough
 *  that the answer feels like part of typing. */
const DEFAULT_DEBOUNCE_MS = 350

/**
 * Ask, as the user types, whether a slug is free.
 *
 * Exported ALONGSIDE the field rather than hidden inside it because two callers need the same
 * answer: the field, to show it, and the host's Save, to refuse. Owning it here and reporting
 * it outward through a callback would make those two copies of one truth.
 *
 * Every answer is stamped with the slug it was asked about and dropped if the slug has moved
 * on — a slow "unavailable" for an abandoned slug must not block a save of the current one.
 * A checker that throws leaves the verdict `idle`: an editor cannot tell the difference
 * between "the network is down" and "the slug is taken", and refusing a save over the former
 * is the worse mistake.
 *
 * A verdict is about a PAIR — this slug, for this document — so `opts.subject` is what the
 * answer belongs to, and it is part of the stamp and part of the effect's key. Without it the
 * hook keys on the slug string alone, and `check` is invisible to the effect (it is read
 * through a ref, below): switching to another document whose slug reads the same string keeps
 * the previous document's verdict on screen, computed by a checker that excluded the OTHER
 * document's own route. "Available" then means "free for the paper you just left", and the
 * host's Save trusts it into a 409. Pass whatever identifies the subject — a document id — and
 * an answer for one subject is dropped the moment the subject moves on, exactly as an answer
 * for a stale slug already is. Omit it only where the hook has one lifelong subject.
 *
 * `check` is read through a ref rather than named in the effect's own dependency array. The
 * natural way to call this hook is `check={(s) => api.routeAvailable(id, s)}` — a fresh
 * function identity on every render, including the internal re-renders the hook triggers
 * itself via `setVerdict`. Depending on `check` directly means the effect's own first line,
 * `setVerdict({ status: "checking", reason: null })`, is a new object every run, so React never
 * bails out: render, effect, setState, render, new identity, effect, setState — forever. The
 * effect instead depends only on the checker's PRESENCE (`Boolean(check)`), and always calls
 * through `checkRef.current` so it still uses the latest function the host handed it.
 */
export function useSlugAvailability(
  slug: string,
  check?: (slug: string) => Promise<{ available: boolean; reason?: string }>,
  opts?: { debounceMs?: number; subject?: string | null },
): SlugVerdict {
  const [verdict, setVerdict] = useState<SlugVerdict>(IDLE)
  const debounceMs = opts?.debounceMs ?? DEFAULT_DEBOUNCE_MS
  const subject = opts?.subject ?? null
  // The stamp is the PAIR, joined by a character no id or slug can contain, so no two pairs
  // can spell the same key.
  const question = `${subject ?? ""}\u0000${slug}`
  const asked = useRef<string | null>(null)
  const checkRef = useRef(check)
  checkRef.current = check

  useEffect(() => {
    if (!slug || !checkRef.current) {
      asked.current = null
      setVerdict(IDLE)
      return
    }
    setVerdict({ status: "checking", reason: null })
    asked.current = question
    const timer = setTimeout(() => {
      const currentCheck = checkRef.current
      if (!currentCheck) return
      void currentCheck(slug)
        .then((res) => {
          if (asked.current !== question) return
          setVerdict(
            res.available
              ? { status: "available", reason: null }
              : { status: "unavailable", reason: res.reason ?? null },
          )
        })
        .catch(() => {
          if (asked.current === question) setVerdict(IDLE)
        })
    }, debounceMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `check` is read through
    // `checkRef.current`, never named here; only its presence should retrigger the effect.
    // `question` carries both `slug` and `subject`, so naming it names them.
  }, [question, slug, debounceMs, Boolean(check)])

  return verdict
}

export interface DocumentIdentityFieldProps {
  title: string
  onTitleChange: (title: string) => void
  slug: string
  onSlugChange: (slug: string) => void
  /** How a title becomes a slug. Injected: the alphabet belongs to the host's route space,
   *  not to this control. */
  slugify: (title: string) => string
  /** What to say about the slug. Produced by {@link useSlugAvailability}; omit for a control
   *  that offers no verdict. */
  verdict?: SlugVerdict
  titleLabel?: string
  slugLabel?: string
  disabled?: boolean
  className?: string
}

const STATUS_TEXT: Record<SlugStatus, string | null> = {
  idle: null,
  checking: "Checking…",
  available: "Available",
  unavailable: "Unavailable",
}

// Tone, not a hand-rolled `status → text-apt-*` map — `lib/tone.ts` is the one home for that
// table (see its header comment), and `text-apt-ok`/`text-apt-danger` are not real tokens:
// Tailwind v4 emits nothing for an unknown utility, so a hand-rolled map renders both verdicts
// in the inherited colour while every test still passes.
const STATUS_TONE: Record<SlugStatus, Tone> = {
  idle: "muted",
  checking: "muted",
  available: "success",
  unavailable: "error",
}

/**
 * What a document is CALLED and where it LIVES — the pair that identifies it, above its body.
 *
 * The slug follows the title until the author edits the slug, then stops for good: that is
 * exactly the affordance the spec asks for ("the user can edit the slug after the title is
 * edited to preserve the title but create a unique slug"). `touched` is session state, not
 * document state — mount this with `key={documentId}` so opening another document starts
 * following again.
 *
 * Both rows use `Field layout="inline"`, so the two labels share a right-aligned column with
 * whatever else the host puts in the same `--apt-field-label-w` group (the Categories/Tags
 * control is the sibling case).
 */
export function DocumentIdentityField({
  title,
  onTitleChange,
  slug,
  onSlugChange,
  slugify,
  verdict = IDLE,
  titleLabel = "Title",
  slugLabel = "Slug",
  disabled = false,
  className,
}: DocumentIdentityFieldProps) {
  const [touched, setTouched] = useState(false)
  // Field layout="inline" wraps its caption AND its children in ONE <Label>, so the slug row's
  // <label> literally contains the status span too — its implicit accessible name would grow
  // (and mutate on every verdict change) to include whatever the verdict currently says.
  // aria-labelledby overrides that implicit wrapping association, so the id it points at is
  // the sole source of the name; aria-describedby then carries the verdict as a DESCRIPTION,
  // which is allowed to change and to also live in an aria-live region.
  const slugCaptionId = useId()
  const slugStatusId = useId()

  const handleTitle = useCallback(
    (next: string) => {
      onTitleChange(next)
      if (!touched) onSlugChange(slugify(next))
    },
    [onTitleChange, onSlugChange, slugify, touched],
  )

  const status = STATUS_TEXT[verdict.status]

  return (
    <div
      data-slot="document-identity"
      className={cn("flex w-full flex-col gap-3", FIELD_LABEL_GROUP_CLASS, className)}
    >
      <Field label={titleLabel} layout="inline">
        <Input
          value={title}
          disabled={disabled}
          onChange={(e) => handleTitle(e.target.value)}
          placeholder="Untitled"
        />
      </Field>
      <Field label={<span id={slugCaptionId}>{slugLabel}</span>} layout="inline">
        <div className="flex w-full items-center gap-2">
          <Input
            value={slug}
            disabled={disabled}
            aria-labelledby={slugCaptionId}
            aria-describedby={status ? slugStatusId : undefined}
            className="flex-1 font-mono text-[0.8rem]"
            onChange={(e) => {
              setTouched(true)
              onSlugChange(e.target.value)
            }}
          />
          {/* Unconditionally mounted (only its TEXT is conditional): an `aria-live` region has
              to already exist in the DOM before its content changes, or assistive tech has
              nothing to have observed the mutation on — mounting the span together with its
              first content means the first verdict, the one most likely to matter
              ("Unavailable", the one that blocks Save), is the one most likely to go
              unannounced. */}
          <span
            data-slot="slug-status"
            id={slugStatusId}
            aria-live="polite"
            className={cn("shrink-0 text-xs", toneTextClass(STATUS_TONE[verdict.status]))}
          >
            {status ? (verdict.reason ?? status) : null}
          </span>
        </div>
      </Field>
    </div>
  )
}
