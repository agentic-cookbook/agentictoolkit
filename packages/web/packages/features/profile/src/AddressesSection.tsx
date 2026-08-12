"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Pencil, Trash2, Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@agentic-toolkit/ui/components/dialog";
import { AlertModal } from "@agentic-toolkit/ui/components/alert-modal";
import { DialogErrorText } from "@agentic-toolkit/ui/components/error-text";
import { UnsavedChangesAlert } from "@agentic-toolkit/ui/components/unsaved-changes-alert";
import { List, ListItem } from "@agentic-toolkit/ui/components/list";
import { Field } from "@agentic-toolkit/ui/blocks";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Input } from "@agentic-toolkit/ui/components/input";
import {
  createAddress,
  updateAddress,
  deleteAddress,
  resolvePrivacyLevel,
  addressesKey,
  type Address,
  type AddressWrite,
  type PrivacyGrant,
} from "@agentic-toolkit/data/profile";
import { DetailSection, useReportSettingsDirty } from "@agentic-toolkit/resource";
import { PrivacyLevelControl } from "./PrivacyLevelControl";

// ── Types ──────────────────────────────────────────────────────────────────────

type DialogState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; address: Address };

const EMPTY_DRAFT: AddressWrite = {
  label: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
};

function addressSummary(a: Address): string {
  return [a.line1, a.line2, a.city, a.country].filter(Boolean).join(", ");
}

/** The editable fields, in one place — the diff below and `handleSave`'s body agree by
 *  construction instead of by two hand-maintained field lists. */
const ADDRESS_FIELDS = [
  "label",
  "line1",
  "line2",
  "city",
  "region",
  "postalCode",
  "country",
] as const;

/** The loaded row as a draft — the baseline an edit is diffed against. */
function draftOf(address: Address): AddressWrite {
  return {
    label: address.label,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    region: address.region,
    postalCode: address.postalCode,
    country: address.country,
  };
}

/** TRIMMED field-by-field comparison, because `handleSave` writes the trimmed values:
 *  adding surrounding whitespace changes the textbox, not the record. */
function sameAddress(a: AddressWrite, b: AddressWrite): boolean {
  return ADDRESS_FIELDS.every((k) => a[k].trim() === b[k].trim());
}

export const ADDRESS_LINE1_REQUIRED_MESSAGE = "Address line 1 is required.";

/**
 * WHY Save can't fire, or null when nothing is blocking. A reason rather than a boolean
 * because the gate DISABLES Save, which is exactly what makes `handleSave`'s own
 * `setFormError` unreachable — a greyed-out Save has to say what it is waiting on.
 */
export function addressBlockedReason(draft: AddressWrite): string | null {
  return draft.line1.trim() === "" ? ADDRESS_LINE1_REQUIRED_MESSAGE : null;
}

// ── Component ──────────────────────────────────────────────────────────────────

export interface AddressesSectionProps {
  addresses: Address[];
  isLoading: boolean;
  grants: PrivacyGrant[];
  /** When true, suppresses the "Addresses" DetailSection heading so the
   *  topic's FeatureTitle serves as the heading instead. */
  hideSectionTitle?: boolean;
  /** When set, all reads/writes target this workspace (org) owner via ?workspace=; the
   *  react-query cache key is namespaced by it so org and personal caches never collide. */
  workspaceSlug?: string;
  /** When true, hides the per-item privacy tier control (orgs have no public card). */
  hidePrivacy?: boolean;
}

export function AddressesSection({
  addresses,
  isLoading,
  grants,
  hideSectionTitle = false,
  workspaceSlug,
  hidePrivacy = false,
}: AddressesSectionProps) {
  const qc = useQueryClient();
  const [dialogState, setDialogState] = useState<DialogState>({ mode: "closed" });
  const [draft, setDraft] = useState<AddressWrite>(EMPTY_DRAFT);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // The unsaved-changes alert raised by a close attempt on a dirty draft.
  const [confirmingClose, setConfirmingClose] = useState(false);

  // Personal keeps the bare key (shared with any other consumer/invalidator); an org
  // workspace namespaces its own cache slice. Shared with the reading panel — see addressesKey.
  const listKey = addressesKey(workspaceSlug);
  const wsOpts = workspaceSlug ? { workspace: workspaceSlug } : undefined;

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (body: AddressWrite) => createAddress(body, wsOpts),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listKey });
      closeDialog();
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error ? err.message : "Could not save. Try again.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: AddressWrite }) =>
      updateAddress(id, body, wsOpts),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listKey });
      closeDialog();
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error ? err.message : "Could not save. Try again.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAddress(id, wsOpts),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listKey });
      setDeleteTarget(null);
      setDeleteError(null);
    },
    onError: (err: unknown) => {
      // Keep the dialog open so the user sees the failure.
      setDeleteError(
        err instanceof Error ? err.message : "Could not delete. Try again.",
      );
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  function openAdd() {
    setDraft(EMPTY_DRAFT);
    setFormError(null);
    setDialogState({ mode: "add" });
  }

  function openEdit(address: Address) {
    setDraft(draftOf(address));
    setFormError(null);
    setDialogState({ mode: "edit", address });
  }

  function closeDialog() {
    setDialogState({ mode: "closed" });
    setFormError(null);
  }

  /** Every way OUT of the dialog: Escape, a backdrop click and the × all arrive here through
   *  `onOpenChange`, and so does Cancel. Asks before throwing a dirty draft away. */
  function requestCloseDialog() {
    if (isPending) return;
    if (draftDirty) {
      setConfirmingClose(true);
      return;
    }
    closeDialog();
  }

  function handleSave() {
    // Re-checked here, not only at the button: a form's DEFAULT submit (Enter in a text
    // field) reaches this handler without going through the button that carries them.
    if (isPending) return;
    const blocked = addressBlockedReason(draft);
    if (blocked) {
      setFormError(blocked);
      return;
    }
    if (!dirty) return;
    setFormError(null);
    const body: AddressWrite = {
      label: draft.label.trim(),
      line1: draft.line1.trim(),
      line2: draft.line2.trim(),
      city: draft.city.trim(),
      region: draft.region.trim(),
      postalCode: draft.postalCode.trim(),
      country: draft.country.trim(),
    };
    if (dialogState.mode === "add") {
      createMutation.mutate(body);
    } else if (dialogState.mode === "edit") {
      updateMutation.mutate({ id: dialogState.address.id, body });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const dialogOpen = dialogState.mode !== "closed";
  const dialogTitle =
    dialogState.mode === "add" ? "Add address" : "Edit address";

  // Edit has a loaded baseline — gate Save on `dirty` too, so re-saving an untouched
  // address (a silent no-op write that still invalidates the list) isn't offered. Add has
  // no baseline to diff against, so it's exempt: filling the required field IS the change.
  const dirty =
    dialogState.mode !== "edit" || !sameAddress(draft, draftOf(dialogState.address));
  // What the CLOSE gate diffs against: the state the dialog OPENED on — the loaded row for an
  // edit, the blank draft for an add. Deliberately NOT the Save gate's `dirty` above, which is
  // unconditionally true in add mode; reusing it would raise the discard alert on every Add
  // dialog the user opens and thinks better of, which is worse than the bug it fixes.
  const draftDirty =
    dialogOpen &&
    !sameAddress(draft, dialogState.mode === "edit" ? draftOf(dialogState.address) : EMPTY_DRAFT);
  // The same draft diff, reported to the settings registry so the exits the dialog can't see for
  // itself — reload, a link click, a rail row switch — ask before discarding.
  useReportSettingsDirty("profile-addresses", draftDirty);

  const blockedReason = addressBlockedReason(draft);
  // dirty && valid ONLY — the in-flight term is applied at the button below.
  const canSave = dirty && blockedReason === null;

  // ── Shared content ─────────────────────────────────────────────────────────

  const addButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={openAdd}
      aria-label="Add address"
    >
      <Plus data-icon="inline-start" />
      Add
    </Button>
  );

  const listContent = isLoading ? (
    <p className="py-2 text-sm text-apt-text-muted">Loading…</p>
  ) : addresses.length === 0 ? (
    <p className="py-2 text-sm text-apt-text-muted">
      No addresses yet. Add one to show it on your card.
    </p>
  ) : (
    <List>
      {addresses.map((address) => {
        const level = hidePrivacy ? "only-me" : resolvePrivacyLevel(grants, "addresses", address.id);
        return (
          <ListItem key={address.id} className="flex-wrap gap-2 py-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <MapPin
                className="size-3.5 shrink-0 text-apt-text-muted"
                aria-hidden="true"
              />
              <div className="min-w-0">
                {address.label && (
                  <div className="font-mono text-[0.65rem] uppercase tracking-wide text-apt-text-dim">
                    {address.label}
                  </div>
                )}
                <div className="truncate text-sm text-apt-text">
                  {addressSummary(address)}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {!hidePrivacy && (
                <PrivacyLevelControl
                  targetTable="addresses"
                  targetId={address.id}
                  level={level}
                  ariaLabel={`Address visibility${address.label ? ` — ${address.label}` : ""}`}
                />
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => openEdit(address)}
                aria-label={`Edit address${address.label ? ` — ${address.label}` : ""}`}
              >
                <Pencil className="size-3.5" aria-hidden="true" />
              </Button>
              <Button
                variant="destructive-ghost"
                size="icon-sm"
                onClick={() => setDeleteTarget(address)}
                aria-label={`Delete address${address.label ? ` — ${address.label}` : ""}`}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          </ListItem>
        );
      })}
    </List>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {hideSectionTitle ? (
        <div className="flex flex-col gap-4">
          <div className="flex min-h-8 items-center justify-end">
            {addButton}
          </div>
          {listContent}
        </div>
      ) : (
        <DetailSection title="Addresses" action={addButton}>
          {listContent}
        </DetailSection>
      )}

      {/* Add/Edit dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) requestCloseDialog();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>

          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => { e.preventDefault(); handleSave(); }}
          >
            <Field label="Label (optional)">
              <Input
                id="address-label"
                value={draft.label}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, label: e.target.value }))
                }
                placeholder="Home, Work…"
              />
            </Field>

            <Field
              label="Address line 1"
              error={formError ?? undefined}
            >
              <Input
                id="address-line1"
                value={draft.line1}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, line1: e.target.value }));
                  setFormError(null);
                }}
                placeholder="123 Main St"
                aria-required="true"
                aria-invalid={formError != null}
                autoComplete="address-line1"
              />
            </Field>

            <Field label="Address line 2 (apt, suite, unit — optional)">
              <Input
                id="address-line2"
                value={draft.line2}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, line2: e.target.value }))
                }
                placeholder="Apt 4B"
                autoComplete="address-line2"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="City">
                <Input
                  id="address-city"
                  value={draft.city}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, city: e.target.value }))
                  }
                  placeholder="City"
                  autoComplete="address-level2"
                />
              </Field>

              <Field label="State / Region">
                <Input
                  id="address-region"
                  value={draft.region}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, region: e.target.value }))
                  }
                  placeholder="State"
                  autoComplete="address-level1"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Postal code">
                <Input
                  id="address-postal-code"
                  value={draft.postalCode}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, postalCode: e.target.value }))
                  }
                  placeholder="Postal code"
                  autoComplete="postal-code"
                />
              </Field>

              <Field label="Country">
                <Input
                  id="address-country"
                  value={draft.country}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, country: e.target.value }))
                  }
                  placeholder="Country"
                  autoComplete="country-name"
                />
              </Field>
            </div>

            <DialogFooter>
              {/* Say WHY Save is dark. No `dirty` term is needed to keep this quiet on an
                  untouched edit: `blockedReason` speaks only for VALIDITY, and a stored
                  address always has the line 1 it was created with. "Nothing has changed
                  yet" is self-explanatory; an unfilled required field is not. */}
              {blockedReason && (
                <p className="mr-auto text-sm text-apt-text-muted" role="status">
                  {blockedReason}
                </p>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={requestCloseDialog}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!canSave || isPending}
                className={
                  canSave && !isPending
                    ? "bg-apt-gold text-apt-bg hover:bg-apt-gold-bright"
                    : ""
                }
              >
                {isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
          {/* Discard calls `closeDialog()` directly, NOT `requestCloseDialog()`: routing back
              through the gate would re-test `draftDirty` — still true — and re-raise the alert
              forever. */}
          <UnsavedChangesAlert
            open={confirmingClose}
            onDiscard={() => {
              setConfirmingClose(false);
              closeDialog();
            }}
            onStay={() => setConfirmingClose(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertModal
        open={deleteTarget != null}
        tone="error"
        title="Remove address?"
        description={
          deleteTarget ? (
            <>
              <span>
                {`Remove ${deleteTarget.label || addressSummary(deleteTarget)} from your card?`}
              </span>
              <DialogErrorText error={deleteError} />
            </>
          ) : undefined
        }
        confirmLabel="Remove"
        confirmVariant="destructive"
        cancelLabel="Cancel"
        busy={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            setDeleteError(null);
            deleteMutation.mutate(deleteTarget.id);
          }
        }}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
      />
    </>
  );
}
