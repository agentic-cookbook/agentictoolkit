"use client"

import * as React from "react"
import { SpellCheck, Check, CircleAlert } from "lucide-react"

import { cn } from "../lib/utils"
import { Button, buttonVariants } from "./button"
import { Badge } from "./badge"
import { Spinner } from "./spinner"
import { Popover, PopoverTrigger, PopoverContent } from "./popover"
import { fieldCaptionClass } from "../lib/typography"

/** One spelling/grammar problem the linter found in the markdown source. */
export interface SpellIssue {
  /** 0-based character offset where the problem starts in the source. */
  start: number
  /** Character offset just past the problem (exclusive). */
  end: number
  /** The flagged substring (`source.slice(start, end)`). */
  flagged: string
  /** Human-readable description of the problem. */
  message: string
  /** Ordered replacement suggestions; may be empty (an empty string = removal). */
  suggestions: string[]
}

/**
 * The minimal linter contract `MarkdownSpellCheck` drives. The default
 * implementation lazy-loads harper.js's `WorkerLinter` (WASM in a Web Worker);
 * tests inject a fake so no WASM ever runs in jsdom.
 */
export interface MarkdownLinter {
  /** Lint markdown source, skipping code/markup; problems in document order. */
  lint(source: string): Promise<SpellIssue[]>
  /**
   * Return the next source with suggestion `suggestionIndex` of issue
   * `issueIndex` applied (indices into the most recent `lint(source)` result).
   */
  apply(
    source: string,
    issueIndex: number,
    suggestionIndex: number,
  ): Promise<string>
  /** Release any worker / WASM resources. */
  dispose(): void
}

/** Factory the component calls to obtain a linter (the dependency-injection seam). */
export type CreateMarkdownLinter = () => MarkdownLinter | Promise<MarkdownLinter>

// --- default harper.js-backed linter (lazy, client-only) ---------------------
//
// Minimal structural views of the harper.js objects we touch, declared locally
// so the exported types above never reference `harper.js`. That keeps harper out
// of this package's published `.d.ts` (and off every consumer's type-resolution
// path); harper itself is reached only through the dynamic `import()` below.
interface HarperSpan {
  start: number
  end: number
}
interface HarperSuggestion {
  get_replacement_text(): string
}
interface HarperLint {
  span(): HarperSpan
  message(): string
  suggestions(): HarperSuggestion[]
}
interface HarperWorkerLinter {
  lint(
    text: string,
    options: { language: "markdown"; dedup: boolean },
  ): Promise<HarperLint[]>
  applySuggestion(
    text: string,
    lint: HarperLint,
    suggestion: HarperSuggestion,
  ): Promise<string>
  dispose(): Promise<void>
}
interface HarperModule {
  WorkerLinter: new (init: { binary: unknown; dialect?: number }) => HarperWorkerLinter
  Dialect: { American: number }
}
interface HarperBinaryModule {
  binaryInlined: unknown
}

/**
 * The production linter: a harper.js `WorkerLinter` — the grammar checker runs
 * its WASM inside a Web Worker, fully offline, so it never blocks the UI thread.
 *
 * harper and its multi-MB WASM are imported only when this function runs, i.e.
 * the first time the user enables the check — never on initial page load. harper
 * builds the worker from an in-memory Blob URL, so no bundler worker-asset wiring
 * is needed.
 *
 * The WASM ships **inlined** (`harper.js/binaryInlined` — a self-contained
 * `data:` URL), NOT the separate-asset `harper.js/binary`. harper hands the
 * binary URL to its Web Worker via `postMessage`, and the worker `fetch`es it
 * from a `blob:` scope. Next.js/Turbopack rewrites the separate-asset
 * `new URL(..., import.meta.url)` to a ROOT-RELATIVE path
 * (`/_next/static/media/harper_wasm_bg.<hash>.wasm`), which a `blob:` worker
 * cannot resolve ("Failed to parse URL") — so the separate-asset path is broken
 * under Next. The inlined `data:` URL is absolute and needs no base resolution,
 * so it works in any bundler; the cost is a larger lazy chunk (only loaded on
 * opt-in).
 *
 * Markdown source mode (`LintOptions.language: 'markdown'`) makes harper parse
 * the input as Markdown and skip fenced code blocks + markup, so only prose is
 * checked — the whole point over the browser's native textarea spellcheck.
 * (Context7 `/automattic/harper` — `LintOptions`, `WorkerLinter`.)
 */
export const createHarperLinter: CreateMarkdownLinter =
  async (): Promise<MarkdownLinter> => {
    const [harper, binaryMod] = (await Promise.all([
      import("harper.js"),
      import("harper.js/binaryInlined"),
    ])) as unknown as [HarperModule, HarperBinaryModule]

    const linter = new harper.WorkerLinter({
      binary: binaryMod.binaryInlined,
      dialect: harper.Dialect.American,
    })
    const options = { language: "markdown" as const, dedup: true }
    let lastLints: HarperLint[] = []

    return {
      async lint(source) {
        const lints = await linter.lint(source, options)
        lastLints = lints
        return lints.map((lint) => {
          const span = lint.span()
          return {
            start: span.start,
            end: span.end,
            flagged: source.slice(span.start, span.end),
            message: lint.message(),
            suggestions: lint
              .suggestions()
              .map((suggestion) => suggestion.get_replacement_text()),
          }
        })
      },
      async apply(source, issueIndex, suggestionIndex) {
        const lint = lastLints[issueIndex]
        if (!lint) return source
        const suggestion = lint.suggestions()[suggestionIndex]
        if (!suggestion) return source
        // harper applies the suggestion itself, so Replace/Remove/InsertAfter
        // kinds are all handled correctly (not a naive [start,end) splice).
        return linter.applySuggestion(source, lint, suggestion)
      },
      dispose() {
        void linter.dispose()
      },
    }
  }

type CheckStatus = "idle" | "loading" | "ready" | "error"

export interface MarkdownSpellCheckProps {
  /** Current markdown source to check. */
  value: string
  /** Apply an edit (the next full source) when a suggestion is accepted. */
  onApply: (next: string) => void
  /** Visible label / accessible name of the toggle. */
  label?: React.ReactNode
  /** Debounce, in ms, before re-linting after the source settles. */
  debounceMs?: number
  /** Linter factory (DI seam). Defaults to the lazy harper.js `WorkerLinter`. */
  createLinter?: CreateMarkdownLinter
  /** Disable the control. */
  disabled?: boolean
  className?: string
}

/**
 * An off-by-default editor-toolbar control that runs an optional, markdown-aware
 * spelling & grammar check over the editor's source via harper.js. It surfaces
 * each problem (flagged text + message + apply-a-suggestion actions) in a
 * lightweight popover panel — deliberately *not* inline squiggles on the
 * textarea, which would be far costlier. Drop it into `MarkdownEditor`'s
 * `toolbarExtras` slot, wired to the same `value` / change handler.
 *
 * Toggling the check on lazily loads harper (and its WASM) the first time, lints
 * the current source, and re-lints (debounced) as the source settles; toggling
 * off clears the panel. Reuses the shared `Popover` (Escape / outside-click
 * dismissal + focus restore) and `Button`.
 */
export function MarkdownSpellCheck({
  value,
  onApply,
  label = "Check spelling",
  debounceMs = 600,
  createLinter = createHarperLinter,
  disabled,
  className,
}: MarkdownSpellCheckProps) {
  const [open, setOpen] = React.useState(false)
  const [status, setStatus] = React.useState<CheckStatus>("idle")
  const [issues, setIssues] = React.useState<SpellIssue[]>([])
  const linterRef = React.useRef<Promise<MarkdownLinter> | null>(null)
  const hasLintedRef = React.useRef(false)

  // Obtain the linter, building it (and importing harper) at most once per mount.
  const ensureLinter = React.useCallback((): Promise<MarkdownLinter> => {
    if (!linterRef.current) {
      linterRef.current = Promise.resolve(createLinter())
    }
    return linterRef.current
  }, [createLinter])

  // Lint while the panel is open, re-linting as the source settles. The first
  // pass after opening runs immediately; later passes (on source change) debounce
  // so a burst of edits coalesces into one check. This is a genuine async side
  // effect keyed on open/value — not state being synced from props.
  React.useEffect(() => {
    if (!open) {
      hasLintedRef.current = false
      return
    }
    let cancelled = false
    const immediate = !hasLintedRef.current
    const run = async (): Promise<void> => {
      hasLintedRef.current = true
      // Keep the prior list visible during a re-lint; only show "Checking…" on
      // the first pass (or after an error).
      setStatus((prev) => (prev === "ready" ? prev : "loading"))
      try {
        const linter = await ensureLinter()
        const found = await linter.lint(value)
        if (cancelled) return
        setIssues(found)
        setStatus("ready")
      } catch {
        if (cancelled) return
        setIssues([])
        setStatus("error")
      }
    }
    const handle = window.setTimeout(run, immediate ? 0 : debounceMs)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [open, value, debounceMs, ensureLinter])

  // Release the worker when the control unmounts.
  React.useEffect(() => {
    return () => {
      void linterRef.current?.then((linter) => linter.dispose()).catch(() => {})
    }
  }, [])

  function handleOpenChange(next: boolean): void {
    setOpen(next)
    if (!next) {
      setStatus("idle")
      setIssues([])
    }
  }

  async function applySuggestion(
    issueIndex: number,
    suggestionIndex: number,
  ): Promise<void> {
    try {
      const linter = await ensureLinter()
      const next = await linter.apply(value, issueIndex, suggestionIndex)
      // The source change flows back through `value`, which re-lints the panel.
      onApply(next)
    } catch {
      setStatus("error")
    }
  }

  const accessibleName = typeof label === "string" ? label : "Check spelling"
  const count = issues.length

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        aria-label={accessibleName}
        aria-pressed={open}
        disabled={disabled}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), className)}
      >
        <SpellCheck data-icon="inline-start" />
        {label}
        {open && status === "ready" && count > 0 && (
          <Badge variant="error" className="ml-0.5">
            {count}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-80 max-h-[24rem] overflow-auto"
      >
        <div className="space-y-3">
          <p className={fieldCaptionClass}>
            Spelling &amp; grammar
          </p>

          {status === "loading" && (
            <div className="flex items-center gap-2 text-sm text-apt-text-muted">
              <Spinner className="size-3.5" />
              Checking…
            </div>
          )}

          {status === "error" && (
            <div className="flex items-start gap-2 text-sm text-apt-red">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>Spell check is unavailable in this browser.</span>
            </div>
          )}

          {status === "ready" && count === 0 && (
            <p className="text-sm text-apt-text-muted">No issues found.</p>
          )}

          {status === "ready" && count > 0 && (
            <ul aria-label="Spelling and grammar issues" className="space-y-2.5">
              {issues.map((issue, i) => (
                <li
                  key={`${issue.start}-${issue.end}-${i}`}
                  className="space-y-1.5 border-b border-apt-border pb-2.5 last:border-0 last:pb-0"
                >
                  <p className="text-sm">
                    <span className="rounded bg-apt-surface-2 px-1 py-0.5 font-mono text-[0.8rem] text-apt-red">
                      {issue.flagged || "—"}
                    </span>
                  </p>
                  <p className="text-xs text-apt-text-muted">{issue.message}</p>
                  {issue.suggestions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {issue.suggestions.slice(0, 4).map((suggestion, j) => (
                        <Button
                          key={`${j}-${suggestion}`}
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => applySuggestion(i, j)}
                          aria-label={`Replace “${issue.flagged}” with “${suggestion || "nothing"}”`}
                        >
                          <Check data-icon="inline-start" />
                          {suggestion || "Remove"}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-apt-text-dim">No suggestion.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
