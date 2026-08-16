// .../features/personas/src/InkScriptEditor.tsx
"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  demoPreviewApi,
  type CannedInk,
  type DemoPreviewDiagnostic,
  type DemoPreviewTurn,
} from "@agentic-toolkit/data/personas";
import { Field } from "@agentic-toolkit/ui/blocks";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Checkbox } from "@agentic-toolkit/ui/components/checkbox";
import { EditorToolbar } from "@agentic-toolkit/ui/components/editor-toolbar";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { SyntaxQuickReference } from "@agentic-toolkit/ui/components/quick-reference";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import { cn } from "@agentic-toolkit/ui/lib/utils";
import { fieldCaptionClass } from "@agentic-toolkit/ui/lib/typography";

/** How long the author has to stop typing before the script is sent to be compiled. */
const LINT_DEBOUNCE_MS = 600;

/**
 * The ink cheat-sheet, in the shape `MarkdownQuickReference` established.
 *
 * Two of these are ADH's, not ink's — `# match:` and `# off_script` are tags this platform reads
 * (see the tag-placement hint the server returns) — and they are the two an author reaches for
 * first, so they lead. Everything else is stock ink, spelled the way Inkle's own documentation
 * spells it.
 */
const INK_SYNTAX: ReadonlyArray<{ label: string; syntax: string }> = [
  { label: "Choice + synonyms", syntax: "+ [Yes # match: yes, sure, ok]\n    -> engaged" },
  { label: "Catch-all choice", syntax: "+ [Anything else # off_script]\n    Not my area." },
  { label: "Section", syntax: "=== engaged ===" },
  { label: "Go to a section", syntax: "-> engaged" },
  { label: "End the story", syntax: "-> DONE" },
  { label: "Off-script section", syntax: "=== off_script ===\nThat's outside my line of work." },
  { label: "Count the visits", syntax: "{ off_script:\n- 1: First time.\n- else: Understood.\n}" },
  { label: "Condition", syntax: "{ off_script < 3: -> invite | -> offer }" },
  { label: "Comment", syntax: "// not shown to anyone" },
];

function InkQuickReference() {
  return (
    <SyntaxQuickReference
      title="Ink quick reference"
      ariaLabel="Ink quick reference"
      triggerLabel="Ink"
      entries={INK_SYNTAX}
      // Ink examples are multi-line and its labels are longer than markdown's.
      contentClassName="w-96"
      columnsClassName="grid-cols-[8rem_1fr]"
    />
  );
}

const SEVERITY_CLASS: Record<DemoPreviewDiagnostic["severity"], string> = {
  error: "text-apt-red",
  warning: "text-apt-gold",
  info: "text-apt-text-muted",
};

/**
 * The compiler's own words, as a list under the textarea.
 *
 * The precedent is `ui/components/markdown-spellcheck.tsx`, which is deliberately a list rather
 * than inline squiggles: a `<textarea>` cannot carry marks inside its text, and the alternative
 * (a contenteditable overlay tracking the caret) is the code-editor library this feature exists
 * to avoid. A line number is a good enough anchor for a script of a few dozen lines.
 */
function Diagnostics({ items }: { items: DemoPreviewDiagnostic[] }) {
  if (items.length === 0) return null;
  return (
    <ul role="list" aria-label="Script problems" className="flex flex-col gap-1">
      {items.map((d, i) => (
        <li key={`${d.line ?? "?"}-${i}`} className={cn("text-xs", SEVERITY_CLASS[d.severity])}>
          {d.line === null ? null : (
            <span className="font-mono">{`line ${d.line}: `}</span>
          )}
          {d.message}
        </li>
      ))}
    </ul>
  );
}

/**
 * What the story will accept next, and — the point of the panel — the words each choice ACTUALLY
 * answers to.
 *
 * A `# match:` tag written outside the choice's square brackets attaches to something else and
 * leaves the choice matching its own wording. Nothing about that is visible in the source, so
 * this list is the only place it shows: the author looks for the synonyms they typed, does not
 * find them, and the hint underneath says where they went.
 */
function Choices({ turn }: { turn: DemoPreviewTurn }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className={fieldCaptionClass}>What it will accept next</p>
      {turn.choices.length === 0 ? (
        <p className="text-xs text-apt-text-muted">
          Nothing — the story has ended here. A visitor&apos;s next message goes off script.
        </p>
      ) : (
        <ul role="list" className="flex flex-col gap-1.5">
          {turn.choices.map((c, i) => (
            <li key={`${c.text}-${i}`} className="text-xs">
              <span className="text-apt-text">{c.text}</span>
              {c.offScript ? (
                <span className="ml-1.5 text-apt-text-muted">(catch-all)</span>
              ) : null}
              <span className="ml-1.5 font-mono text-apt-text-muted">
                {c.keywords.join(", ")}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-apt-text-muted">{turn.tagPlacementHint}</p>
    </div>
  );
}

interface Said {
  role: "user" | "assistant";
  content: string;
}

/** What the transcript shows for a turn the demo declines — see `canEscalate`. */
const ESCALATED = "(the real model answers here — the demo says nothing)";

/**
 * Author an ink demo script, and hold a conversation with it before saving.
 *
 * Everything the panel knows comes from one endpoint, `POST /persona/demo-preview`: it compiles
 * the draft and plays a turn through the SAME engine a visitor gets. There is no ink compiler in
 * the browser on purpose — a second one could disagree with the one the save path enforces, and
 * it could not show escalation at all, because whether a persona has a real model to fall through
 * to is not something this side knows.
 *
 * Two calls, one shape. With no message and no history the story plays its opening, which is the
 * as-you-type lint; with a message and the transcript so far it plays that turn.
 */
export function InkScriptEditor({
  value,
  onChange,
  disabled,
}: {
  value: CannedInk | null | undefined;
  onChange: (next: CannedInk | null) => void;
  disabled?: boolean;
}) {
  const ink = value ?? { source: "", signInLine: "" };
  /**
   * Emptying both fields removes the `ink` key rather than storing a blank one — the persona
   * goes back to demoing on its keyword script, and the config says so instead of carrying a
   * husk that every reader has to test for a blank source.
   */
  const emit = (next: CannedInk) =>
    onChange(next.source.trim() === "" && next.signInLine.trim() === "" ? null : next);
  const [debouncedSource, setDebouncedSource] = useState(ink.source);
  const [said, setSaid] = useState<Said[]>([]);
  const [draft, setDraft] = useState("");
  const [canEscalate, setCanEscalate] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSource(ink.source), LINT_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [ink.source]);

  // The lint. Keyed by the source alone: `signInLine` cannot change whether the script compiles,
  // and re-linting on every keystroke of it would be a request per character.
  const lint = useQuery({
    queryKey: ["demo-preview-lint", debouncedSource],
    queryFn: () => demoPreviewApi.play({ source: debouncedSource }),
    // A blank source is a draft nobody has written yet, not an error to report.
    enabled: debouncedSource.trim() !== "",
    // The answer is a pure function of the source, so a source the author scrolls back to needs
    // no second round trip.
    staleTime: Infinity,
  });

  const play = useMutation({
    mutationFn: (message: string) =>
      demoPreviewApi.play({
        source: ink.source,
        signInLine: ink.signInLine || undefined,
        message,
        history: said,
        canEscalate,
      }),
    onSuccess: (turn, message) => {
      setSaid((prior) => [
        ...prior,
        { role: "user", content: message },
        { role: "assistant", content: turn.text ?? ESCALATED },
      ]);
      setDraft("");
    },
  });

  // The turn whose standing choices are worth showing: the one just played, else the opening.
  const shown: DemoPreviewTurn | undefined = play.data ?? lint.data;
  const errors = (lint.data?.diagnostics ?? []).filter((d) => d.severity === "error");

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="ink-source" className={fieldCaptionClass}>
            Ink script
          </Label>
          <EditorToolbar ariaLabel="Ink editor toolbar">
            <InkQuickReference />
          </EditorToolbar>
        </div>
        <Textarea
          id="ink-source"
          rows={18}
          // Ink source is full of non-words, the same reason MarkdownEditor turns it off.
          spellCheck={false}
          disabled={disabled}
          className="font-mono text-[0.8rem]"
          placeholder={"Hi — I'm Bob. I name pets for a living.\nGot one that needs a name?"}
          value={ink.source}
          onChange={(e) => emit({ ...ink, source: e.target.value })}
        />
        {lint.isError ? (
          <ErrorText error="Couldn't check the script just now. It will be checked again when you save." className="text-xs" />
        ) : null}
        <Diagnostics items={lint.data?.diagnostics ?? []} />
        {errors.length > 0 ? (
          <p role="status" className="text-xs text-apt-gold">
            While demo chat is on, this persona can&apos;t be saved until the script compiles.
            Switch demo chat off to park the draft.
          </p>
        ) : null}
      </div>

      <Field
        label="Sign-in line"
        hint="What the persona says to a signed-out visitor whose message the script doesn't cover. Leave blank for the platform default."
      >
        <Input
          value={ink.signInLine}
          disabled={disabled}
          placeholder="Sign in and I can actually answer that."
          onChange={(e) => emit({ ...ink, signInLine: e.target.value })}
        />
      </Field>

      <div className="flex flex-col gap-2 rounded-md border border-apt-border p-3">
        <div className="flex items-center justify-between gap-3">
          <p className={fieldCaptionClass}>Try it</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={said.length === 0}
            onClick={() => {
              setSaid([]);
              play.reset();
            }}
          >
            Start over
          </Button>
        </div>

        {/* The two demos are different conversations, so the author has to be able to see both:
            an anonymous visitor gets the script's own off-script branch (or the sign-in line),
            a signed-in one falls through to the persona's real model and the demo says nothing. */}
        <div className="flex items-center gap-2 text-xs">
          <Checkbox
            checked={canEscalate}
            onCheckedChange={(checked) => setCanEscalate(checked === true)}
            aria-label="Preview a signed-in visitor"
          />
          <span>Preview a signed-in visitor (off-script goes to the real model)</span>
        </div>

        <ul role="list" className="flex flex-col gap-1.5">
          {said.map((m, i) => (
            <li key={i} className="text-xs">
              <span className={fieldCaptionClass}>{m.role === "user" ? "Visitor" : "Persona"}</span>
              <span
                className={cn(
                  "ml-2 whitespace-pre-wrap",
                  m.content === ESCALATED ? "text-apt-text-muted" : "text-apt-text",
                )}
              >
                {m.content}
              </span>
            </li>
          ))}
        </ul>

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim() === "") return;
            play.mutate(draft);
          }}
        >
          <Input
            aria-label="Say something to the persona"
            value={draft}
            disabled={disabled || ink.source.trim() === ""}
            placeholder="Say something…"
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button
            type="submit"
            size="sm"
            disabled={disabled || play.isPending || draft.trim() === "" || ink.source.trim() === ""}
          >
            Send
          </Button>
        </form>
        {play.isError ? <ErrorText error="Couldn't play that turn. Please try again." className="text-xs" /> : null}

        {shown ? <Choices turn={shown} /> : null}
      </div>
    </div>
  );
}
