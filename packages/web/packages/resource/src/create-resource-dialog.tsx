"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@agentic-toolkit/ui/components/button";
import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";

/**
 * The shared "New …" modal for a resource tab: the resource form (no top button
 * bar) with Cancel / Save at the lower right, plus a close (×) button that mirrors
 * Cancel. The dialog only dismisses through Save, Cancel, or × — clicking the
 * backdrop is inert and Esc routes through the same guarded close — so a stray
 * click can't discard a half-filled form. When the draft has unsaved edits,
 * closing first prompts the user to Save, Discard, or keep editing.
 * `renderForm` supplies the entity-specific fields; `validate`/`create` close over
 * any context they need (e.g. the taken-identifiers list).
 */
export function CreateResourceDialog<TInput, TResult>({
  ariaLabel,
  heading,
  blank,
  validate,
  create,
  onClose,
  onCreated,
  renderForm,
}: {
  ariaLabel: string;
  heading: string;
  blank: () => TInput;
  validate: (draft: TInput) => string | null;
  create: (draft: TInput) => Promise<TResult>;
  onClose: () => void;
  onCreated: (result: TResult) => void;
  renderForm: (
    draft: TInput,
    onChange: (next: TInput) => void,
    error: string | null,
  ) => ReactNode;
}) {
  const [draft, setDraft] = useState<TInput>(blank);
  // A stable baseline (the empty form) for the unsaved-changes guard.
  const [pristine] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Save is enabled once the form has any input; clicking validates and surfaces
  // the precise problem (e.g. the reverse-domain identifier rule) inline, rather
  // than leaving the button silently disabled with no explanation.
  const dirty = JSON.stringify(draft) !== JSON.stringify(pristine);

  // Cancel / × / Esc route here: a pristine form closes immediately; a dirty one
  // raises the Save / Discard prompt instead of dismissing.
  function requestClose() {
    if (dirty) setConfirming(true);
    else onClose();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (confirming) setConfirming(false);
      else if (dirty) setConfirming(true);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming, dirty, onClose]);

  async function save() {
    const problem = validate(draft);
    if (problem) {
      setError(problem);
      setConfirming(false); // surface the validation error on the form
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onCreated(await create(draft));
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "create-resource-dialog", step: "save" });
      setError(err instanceof Error ? err.message : "Failed to create.");
      setSaving(false);
      setConfirming(false);
    }
  }

  // A modal PORTALS to the body. `fixed` took it out of the layout, but it stayed in the tree — and
  // a modal that is still a descendant of the pane that opened it inherits that pane's fate: the
  // hierarchical stack marks every pane that is not on top `inert` + `aria-hidden` in narrow mode, so
  // opening "New …" from a list header rendered a dialog nobody could type into (the form silently
  // refused every keystroke and Save stayed disabled). It also inherits any ancestor stacking context
  // or `overflow: hidden`, which a full-screen overlay must not. The body is the only parent that
  // owns none of that. Rendered only on the client — the server has no `document`, and a modal never
  // opens during SSR anyway.
  const overlay = (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div className="relative my-8 flex w-full max-w-3xl flex-col gap-4 rounded-xl border border-apt-border bg-apt-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold text-apt-text">{heading}</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            onClick={requestClose}
            disabled={saving}
          >
            <X />
          </Button>
        </div>
        {renderForm(draft, setDraft, error)}
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={requestClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>

        {confirming && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/50 p-6"
            role="alertdialog"
            aria-modal="true"
            aria-label="Unsaved changes"
          >
            <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-apt-border bg-apt-surface p-5 shadow-xl">
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-apt-text">Unsaved changes</h3>
                <p className="text-sm text-apt-text-muted">
                  You have unsaved changes. Save them before closing?
                </p>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setConfirming(false)}
                  disabled={saving}
                >
                  Keep editing
                </Button>
                <Button
                  variant="destructive-ghost"
                  onClick={onClose}
                  disabled={saving}
                >
                  Discard
                </Button>
                <Button onClick={save} disabled={saving || !dirty}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(overlay, document.body);
}
