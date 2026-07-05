"use client";

import * as React from "react";
import { Trash2, TriangleAlert } from "lucide-react";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { Label } from "../components/label";
import { Disclosure } from "../components/disclosure";
import { cn } from "../lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "../components/dialog";

type Phase = "warn" | "confirm";

/** Props for {@link DeleteEntitySection}. */
export interface DeleteEntitySectionProps {
  /** Singular entity noun, e.g. "Ecosystem" — used in the button and copy. */
  entityNoun: string;
  /** The exact value the user must type to confirm (the entity's rdid). */
  confirmValue: string;
  /** Child data the delete cascades through, e.g. "applications, buckets, and users". */
  childEntities: string;
  /** Performs the delete (and any post-delete navigation). Throwing shows an inline error. */
  onConfirm: () => Promise<void>;
  /** Optional override for the danger-section description line. */
  description?: React.ReactNode;
}

const article = (noun: string): string =>
  /^[aeiou]/i.test(noun.trim()) ? "an" : "a";

/**
 * The "Danger" section for an entity's own settings pane: a **disclosure**
 * (collapsed by default, neutral styling) that reveals a destructive Delete
 * button only once opened — the `apt-red` accent appears solely in the disclosed
 * state, so a closed Danger zone doesn't shout (least-astonishment). The Delete
 * button is gated behind a two-phase confirm dialog — first an acknowledgement
 * ("Do you wish to proceed?"), then a type-to-confirm step whose "Permanently
 * Delete" button only enables once the entity's exact identifier is typed
 * (case-sensitive, no extra whitespace). Shared across every FTD route (see
 * websites/shared/recipes/focused-topic-detail.md).
 */
export function DeleteEntitySection({
  entityNoun,
  confirmValue,
  childEntities,
  onConfirm,
  description,
}: DeleteEntitySectionProps): React.ReactElement {
  const inputId = React.useId();
  // The section is a disclosure, collapsed by default (so the destructive
  // affordance is opt-in, not always-present). Controlled here so the red accent
  // can track the open state.
  const [disclosed, setDisclosed] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>("warn");
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const noun = entityNoun.toLowerCase();
  // Exact match: case-sensitive, no normalization/trim — typed must equal the rdid.
  // Guard the empty case: an empty `confirmValue` would match the initial empty
  // input and arm the destructive button with no typing at all.
  const confirmEnabled = confirmValue.length > 0 && typed === confirmValue && !busy;

  function reset(): void {
    setOpen(false);
    setPhase("warn");
    setTyped("");
    setBusy(false);
    setError(null);
  }

  function onOpenChange(next: boolean): void {
    if (next) {
      setOpen(true);
      return;
    }
    if (busy) return; // never dismiss mid-delete
    reset();
  }

  async function handleConfirm(): Promise<void> {
    if (!confirmEnabled) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      reset(); // parent navigates away on success; close defensively
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to delete ${noun}.`);
      setBusy(false);
    }
  }

  return (
    <section aria-label="Danger Zone">
      {/* Collapsed + neutral by default; the apt-red accent appears only once the
          section is disclosed, so the destructive affordance doesn't shout
          (least-astonishment). The primitive's title is apt-text, so the title
          node recolors itself red in the open state. The warning glyph stays
          apt-gold (its own color) in both states. */}
      <Disclosure
        open={disclosed}
        onOpenChange={setDisclosed}
        title={
          <span
            className={cn(
              "inline-flex items-center gap-1.5",
              disclosed && "text-apt-red",
            )}
          >
            <TriangleAlert className="size-4 shrink-0 text-apt-gold" aria-hidden />
            Danger Zone
          </span>
        }
        className={disclosed ? "border-apt-red/40 bg-apt-red/5" : undefined}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-apt-text-muted">
            {description ?? (
              <>
                Permanently delete this {noun} and all of its data. This cannot be
                undone.
              </>
            )}
          </p>
          <div>
            <Button
              variant="destructive-ghost"
              size="sm"
              onClick={() => {
                setPhase("warn");
                setOpen(true);
              }}
            >
              <Trash2 data-icon="inline-start" />
              Delete {entityNoun}
            </Button>
          </div>
        </div>
      </Disclosure>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showClose={!busy}>
          {phase === "warn" ? (
            <>
              <DialogHeader>
                <DialogTitle>Delete {entityNoun}?</DialogTitle>
                <DialogDescription>
                  Deleting {article(entityNoun)} {noun} deletes all the data
                  associated with the {noun}, including {childEntities}. Do you
                  wish to proceed?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" size="sm" onClick={reset}>
                  Cancel
                </Button>
                <Button
                  variant="destructive-ghost"
                  size="sm"
                  onClick={() => setPhase("confirm")}
                >
                  Yes
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Permanently delete this {entityNoun}</DialogTitle>
                <DialogDescription>
                  You are about to permanently delete this {entityNoun}. Enter{" "}
                  <span className="font-mono text-apt-text">
                    &ldquo;{confirmValue}&rdquo;
                  </span>{" "}
                  below to confirm.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor={inputId} className="sr-only">
                  Type {confirmValue} to confirm deletion
                </Label>
                <Input
                  id={inputId}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  value={typed}
                  placeholder={confirmValue}
                  onChange={(e) => setTyped(e.target.value)}
                  aria-invalid={error ? true : undefined}
                />
                {error && <p className="text-sm text-apt-red">{error}</p>}
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleConfirm}
                  disabled={!confirmEnabled}
                >
                  {busy ? "Deleting…" : "Permanently Delete"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
