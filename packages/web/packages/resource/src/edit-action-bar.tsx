"use client";

import type { ReactNode } from "react";

import { SaveCancelButtons } from "./master-detail/SaveCancelButtons";

/**
 * The recessed action bar for single-record settings panes (Profile, Account, a realm's
 * gamification config) — same look as the master/detail toolbar (it shares the
 * SaveCancelButtons pair), just Cancel + Save right-aligned. `status` shows an inline
 * saved/error message on the left. Cancel is enabled whenever there are edits to discard
 * (`dirty`).
 *
 * Here rather than in a host because a single-record pane is exactly what a feature package
 * ships: it sits next to SaveCancelButtons, which it is a layout around, and the second host
 * to need one (the gamification site) would otherwise have copied thirty lines whose only
 * interesting content is which side the buttons go on.
 */
export function EditActionBar({
  dirty,
  canSave,
  saving = false,
  onCancel,
  onSave,
  status,
}: {
  dirty: boolean;
  canSave: boolean;
  saving?: boolean;
  onCancel: () => void;
  onSave: () => void;
  status?: ReactNode;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Editing actions"
      className="flex items-center gap-1 border-y border-apt-border bg-apt-bg px-6 py-2"
    >
      <div className="min-w-0 flex-1 truncate text-sm">{status}</div>
      <SaveCancelButtons
        canCancel={dirty}
        canSave={canSave}
        saving={saving}
        onCancel={onCancel}
        onSave={onSave}
      />
    </div>
  );
}
