"use client";

import { X, Check } from "lucide-react";

import { Button } from "@agenticdevelopertoolkit/ui/components/button";

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
  // ONE inert-ness term, keyed by every affordance that expresses it. A control that is
  // `disabled` must not also look enabled: `canSave` alone is a statement about the DRAFT
  // (dirty && valid), and it stays TRUE while a save is in flight — the busy term is applied
  // here, at the button. Keying the gold `className` off `canSave` while keying `disabled`
  // off `canSave || saving` therefore painted a gold, enabled-looking button that reads
  // "Saving…" and ignores clicks. Derive once; the styling follows the disabled state by
  // construction rather than restating half of it.
  const saveDisabled = !canSave || saving;
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
        disabled={saveDisabled}
        className={
          saveDisabled ? "text-apt-text-muted" : "bg-apt-gold text-apt-bg hover:bg-apt-gold-bright"
        }
      >
        <Check data-icon="inline-start" />
        {saving ? "Saving…" : "Save"}
      </Button>
    </>
  );
}
