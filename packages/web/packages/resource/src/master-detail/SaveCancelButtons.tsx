"use client";

import { X, Check } from "lucide-react";

import { Button } from "@agentic-toolkit/ui/components/button";

/**
 * The Cancel + Save pair shared by the master/detail button bar and the
 * single-record EditActionBar — so the borderless "[icon] title" buttons and
 * the Save-orange-when-enabled styling live in exactly one place.
 */
export function SaveCancelButtons({
  canCancel,
  canSave,
  saving = false,
  onCancel,
  onSave,
}: {
  canCancel: boolean;
  canSave: boolean;
  saving?: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <>
      <Button variant="ghost" size="sm" onClick={onCancel} disabled={!canCancel || saving}>
        <X data-icon="inline-start" />
        Cancel
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onSave}
        disabled={!canSave || saving}
        className={
          canSave ? "bg-apt-gold text-apt-bg hover:bg-apt-gold-bright" : "text-apt-text-muted"
        }
      >
        <Check data-icon="inline-start" />
        {saving ? "Saving…" : "Save"}
      </Button>
    </>
  );
}
