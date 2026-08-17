"use client"

import * as React from "react"

import { Button } from "../components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/dialog"
import { Progress } from "../components/progress"

/**
 * THE MODAL A LONG BATCH RUNS BEHIND: a bar, the name of the item in flight, a per-item log, and —
 * when something fails — the choice of whether the rest should go.
 *
 * The parts are already here: `Dialog` and `Progress`, both shadcn-provenance. What is not is the
 * SHAPE of a batch that can partly succeed, and the three decisions that shape encodes:
 *
 * 1. IT HALTS ON AN ERROR AND ASKS. Setting `error` stops the run and offers Continue and Stop.
 *    The alternative — power through and present a list at the end — decides on the operator's
 *    behalf that the remaining items should go, when the first failure is often the evidence that
 *    they should not (a wrong destination fails the same way for every user after it).
 * 2. IT DOES NOT CLOSE ITSELF. A modal that dismisses on completion takes the only record of what
 *    happened with it, and leaves the operator holding a partly-applied batch with no list of
 *    which part. `finished` swaps the decision buttons for Close; the user closes it.
 * 3. IT IS NOT DISMISSIBLE MID-RUN. `Dialog` already disables backdrop dismissal by default; the
 *    `onOpenChange` below additionally swallows Escape/× until the run has ended — closing the
 *    window does not stop the requests, so a dialog that vanished on a stray click or keypress
 *    would leave the batch running invisibly.
 *
 * It is TRANSPORT-AGNOSTIC on purpose: it renders state and emits decisions, and the host owns the
 * loop. That is what "globally shared" has to mean here — any batch operation can drive it, and
 * none of them need a streaming protocol to do so.
 *
 * `done` is a COUNT of completed items, not a boolean. Progress is items, not elapsed time or
 * bytes: the host drives a loop of discrete operations, and "3 of 8 users moved" is a fact, where
 * a smoothly-animating bar would be a guess.
 */
export interface ProgressResult {
  id: string
  /** How the operator refers to this item — an email, a name. Not a uuid. */
  label: React.ReactNode
  status: "ok" | "failed"
  message?: string
}

export interface ProgressError {
  message: string
  itemLabel?: React.ReactNode
}

export interface ProgressModalProps {
  open: boolean
  title: React.ReactNode
  description?: React.ReactNode
  /** Completed items. */
  done: number
  total: number
  /** The item in flight, named. Omitted between items. */
  currentLabel?: React.ReactNode
  /** Set when the run has HALTED on an error and is awaiting a decision. */
  error?: ProgressError | null
  /**
   * The run has ended — finished, or stopped by the operator. A separate flag rather than
   * `done === total` because a Stop ends the run short and must still offer Close.
   */
  finished?: boolean
  /** Shown only while `error` is set. */
  onContinue?: () => void
  /** Shown only while `error` is set. */
  onStop?: () => void
  /** Shown only when `finished`. */
  onClose?: () => void
  /** Per-item outcomes, rendered as a running log. */
  results?: ReadonlyArray<ProgressResult>
  /**
   * What a log row says when the item carried no `message` of its own. Deliberately generic
   * defaults: this block runs any batch, and a hardcoded "moved" would be a lie in a delete run.
   * A host with a better verb passes it.
   */
  okLabel?: React.ReactNode
  failedLabel?: React.ReactNode
}

export function ProgressModal({
  open,
  title,
  description,
  done,
  total,
  currentLabel,
  error = null,
  finished = false,
  onContinue,
  onStop,
  onClose,
  results = [],
  okLabel = "done",
  failedLabel = "failed",
}: ProgressModalProps): React.ReactElement {
  // An empty batch should never have been started, but a NaN width reads to the operator as a
  // broken dialog rather than as the empty batch it is.
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const halted = error != null && !finished

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Escape and the × route through here. Until the run has ended there is nothing to route
        // TO: closing the window does not stop the requests.
        if (!next && finished) onClose?.()
      }}
    >
      <DialogContent showClose={finished} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Progress value={pct} />
          <div className="flex items-baseline justify-between gap-3 text-xs text-apt-text-muted">
            <span className="min-w-0 truncate">
              {currentLabel ?? (finished ? "Finished" : halted ? "Paused" : "Working…")}
            </span>
            <span className="shrink-0 font-mono">
              {done} of {total}
            </span>
          </div>
        </div>

        {halted && (
          <div className="rounded-md border border-apt-red/40 bg-apt-red/5 p-2 text-xs">
            {error?.itemLabel != null && (
              <div className="font-medium text-apt-text">{error.itemLabel}</div>
            )}
            <div className="text-apt-red">{error?.message}</div>
          </div>
        )}

        {results.length > 0 && (
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-apt-border p-2">
            {results.map((result) => (
              <div key={result.id} className="text-xs">
                <span className="font-medium text-apt-text">{result.label}</span>
                {result.status === "failed" ? (
                  <>
                    {" — "}
                    <span className="text-apt-red">{result.message ?? failedLabel}</span>
                  </>
                ) : (
                  <span className="text-apt-text-muted"> — {result.message ?? okLabel}</span>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          {finished ? (
            onClose && (
              <Button size="sm" onClick={onClose}>
                Close
              </Button>
            )
          ) : halted ? (
            <>
              {onStop && (
                <Button size="sm" variant="ghost" onClick={onStop}>
                  Stop
                </Button>
              )}
              {onContinue && (
                <Button size="sm" onClick={onContinue}>
                  Continue
                </Button>
              )}
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
