"use client";

import { useCallback, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { isForbidden, useResourceList } from "@agentic-toolkit/data";
import {
  gamificationApi,
  type RealmEventType,
  type RealmEventTypeInput,
} from "@agentic-toolkit/data/gamification";
import { useReportSettingsDirty } from "@agentic-toolkit/resource";
import { Button } from "@agentic-toolkit/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@agentic-toolkit/ui/components/dialog";
import { AlertModal } from "@agentic-toolkit/ui/components/alert-modal";
import { UnsavedChangesAlert } from "@agentic-toolkit/ui/components/unsaved-changes-alert";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { Field } from "@agentic-toolkit/ui/blocks";
import { Input } from "@agentic-toolkit/ui/components/input";
import { List, ListItem } from "@agentic-toolkit/ui/components/list";

import { forbiddenAware } from "./err-text";

/**
 * The realm CUSTOM EVENT TYPES editor — mirrors {@link CatalogSection}'s add/edit-dialog +
 * delete-confirm authoring pattern. Lists GET /gamification/realms/:eco/event-types: each row
 * names an event key and the gamification.stats stat_key it bumps (consumed by POST …/events).
 * Owns its own state and its own fetch — event types are not part of the catalog response, so
 * unlike the badges and the ladder there is nothing here to share. A duplicate name is a clean
 * 409 from the backend (isUniqueViolation), surfaced inline at the dialog that triggered it.
 */

interface EventTypeDraft {
  name: string;
  statKey: string;
}

function emptyDraft(): EventTypeDraft {
  return { name: "", statKey: "" };
}

function toDraft(t: RealmEventType): EventTypeDraft {
  return { name: t.name, statKey: t.statKey };
}

/** The draft's two fields, in one place — the comparison below iterates this list rather than
 *  reaching for `JSON.stringify` (key-order sensitive, and silently drops `undefined`-valued
 *  keys — sound in neither direction). Exported for a direct unit test. */
const EVENT_TYPE_DRAFT_FIELDS = ["name", "statKey"] as const;

export function sameEventTypeDraft(a: EventTypeDraft, b: EventTypeDraft): boolean {
  return EVENT_TYPE_DRAFT_FIELDS.every((k) => a[k] === b[k]);
}

type DialogState = { mode: "closed" } | { mode: "add" } | { mode: "edit"; id: string };

/** The dialog's one pre-submit rule, in one place: the reason shown beside a disabled Save AND the
 *  error `submit()` sets on its (now click-unreachable) guard path, so the two can't drift apart. */
const REQUIRED_FIELDS_MESSAGE = "Name and stat key are required.";

const errText = forbiddenAware("You don't have access to change this realm's event types.");

export function EventTypesSection({ ecosystemId }: { ecosystemId?: string }) {
  // Cached per realm, so coming back to a realm's event types paints them on the first frame and
  // re-reads behind that paint instead of blanking the list on every visit.
  const loadTypes = useCallback(async () => {
    if (!ecosystemId) return [] as RealmEventType[];
    try {
      return await gamificationApi.listEventTypes(ecosystemId);
    } catch (err) {
      // A 403 is EXPECTED on a realm the caller cannot author, so it is not an incident. Reported
      // here and rethrown with this section's own wording, which is why the call site passes
      // `reportErrors: false` — one failure reported twice under two contexts is worse than one.
      if (!isForbidden(err)) {
        reportUnexpectedAuthError(err, { feature: "gamification-event-types", step: "load" });
      }
      throw new Error(errText(err, "Failed to load event types."));
    }
  }, [ecosystemId]);
  const {
    items: types,
    error: loadError,
    reload,
  } = useResourceList<RealmEventType>(`realm:${ecosystemId ?? ""}:event-types`, loadTypes, {
    reportErrors: false,
  });

  // Swallowing: `submit`/`confirmDelete` below re-read AFTER their own write succeeded, so a failed
  // re-read must not be reported as a failed save or delete. It still reaches the screen — as
  // `loadError`.
  const refresh = useCallback(() => reload().catch(() => {}), [reload]);

  // ── Add/edit dialog ────────────────────────────────────────────────────────
  const [dialog, setDialog] = useState<DialogState>({ mode: "closed" });
  const [draft, setDraft] = useState<EventTypeDraft>(emptyDraft());
  // The loaded (edit) or blank (add) starting point, captured once per dialog open —
  // diffed against `draft` so Save stays disabled until something actually changes,
  // matching the badge dialog.
  const [baselineDraft, setBaselineDraft] = useState<EventTypeDraft>(emptyDraft());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // The unsaved-changes alert raised by a close attempt on a dirty draft.
  const [confirmingClose, setConfirmingClose] = useState(false);

  // ── Delete confirm ─────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<RealmEventType | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const dirty = useMemo(() => !sameEventTypeDraft(draft, baselineDraft), [draft, baselineDraft]);
  const blockedReason =
    draft.name.trim() === "" || draft.statKey.trim() === "" ? REQUIRED_FIELDS_MESSAGE : null;
  const canSave = dirty && blockedReason === null;

  // The open draft, reported to the settings registry so the exits the dialog can't see for
  // itself — reload, a link click, a rail row switch — ask before discarding. Gated on the dialog
  // being OPEN as well as dirty: `draft`/`baselineDraft` are only re-seeded on open, so a closed
  // dialog's leftovers must never arm anything.
  useReportSettingsDirty("gamification-event-types", dialog.mode !== "closed" && dirty);

  if (!ecosystemId) return null;

  function openAdd() {
    const blank = emptyDraft();
    setDraft(blank);
    setBaselineDraft(blank);
    setFormError(null);
    setDialog({ mode: "add" });
  }

  function openEdit(t: RealmEventType) {
    const loaded = toDraft(t);
    setDraft(loaded);
    setBaselineDraft(loaded);
    setFormError(null);
    setDialog({ mode: "edit", id: t.id });
  }

  function closeDialog() {
    setDialog({ mode: "closed" });
    setFormError(null);
  }

  /** Every way OUT of the dialog: Escape, a backdrop click and the × all arrive here through
   *  `onOpenChange`, and so does Cancel. Asks before throwing a dirty draft away; `dirty` is a
   *  real diff against the baseline the dialog opened on (blank for add), so opening a dialog
   *  and changing your mind never nags. */
  function requestCloseDialog() {
    if (saving) return;
    if (dirty) {
      setConfirmingClose(true);
      return;
    }
    closeDialog();
  }

  async function submit() {
    if (!ecosystemId) return;
    if (!draft.name.trim() || !draft.statKey.trim()) {
      setFormError(REQUIRED_FIELDS_MESSAGE);
      return;
    }
    const input: RealmEventTypeInput = { name: draft.name.trim(), statKey: draft.statKey.trim() };
    setSaving(true);
    setFormError(null);
    try {
      if (dialog.mode === "edit") {
        await gamificationApi.updateEventType(ecosystemId, dialog.id, input);
      } else {
        await gamificationApi.createEventType(ecosystemId, input);
      }
      closeDialog();
      await refresh();
    } catch (err) {
      if (!isForbidden(err)) {
        reportUnexpectedAuthError(err, { feature: "gamification-event-types", step: "save" });
      }
      setFormError(errText(err, "Could not save the event type."));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!ecosystemId || !deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await gamificationApi.deleteEventType(ecosystemId, deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      if (!isForbidden(err)) {
        reportUnexpectedAuthError(err, { feature: "gamification-event-types", step: "delete" });
      }
      setDeleteError(errText(err, "Could not delete the event type."));
    } finally {
      setDeleting(false);
    }
  }

  const isEdit = dialog.mode === "edit";

  return (
    <div>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-sm font-medium text-apt-text">Custom event types</p>
          <p className="mt-0.5 text-xs text-apt-text-muted">
            Realm-defined events your product can post (POST …/events) to award points — each
            names the stat it bumps.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={openAdd} aria-label="Add event type">
          <Plus data-icon="inline-start" />
          Add event type
        </Button>
      </div>

      {loadError && <p className="mt-4 text-sm text-apt-red">{loadError}</p>}
      {!types && !loadError && <p className="mt-4 text-sm text-apt-text-muted">Loading…</p>}

      {types && types.length === 0 && (
        <EmptyState
          className="mt-4"
          title="No custom event types yet"
          description="Add one to let this realm's product post its own gamification events."
        />
      )}

      {types && types.length > 0 && (
        <List className="mt-4">
          {types.map((t) => (
            <ListItem key={t.id} className="flex-wrap gap-2 py-2">
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-apt-text">{t.name}</span>
                <span className="ml-2 font-mono text-xs text-apt-text-muted">→ {t.statKey}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => openEdit(t)}
                  aria-label={`Edit ${t.name}`}
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                </Button>
                <Button
                  variant="destructive-ghost"
                  size="icon-sm"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteTarget(t);
                  }}
                  aria-label={`Delete ${t.name}`}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            </ListItem>
          ))}
        </List>
      )}

      {/* Add/Edit event type dialog */}
      <Dialog
        open={dialog.mode !== "closed"}
        onOpenChange={(open) => {
          if (!open) requestCloseDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit event type" : "Add event type"}</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <Field label="Name">
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="quest_completed"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </Field>

            <Field label="Stat key" hint="The gamification.stats key this event bumps by 1.">
              <Input
                value={draft.statKey}
                onChange={(e) => setDraft((d) => ({ ...d, statKey: e.target.value }))}
                placeholder="adventures"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </Field>

            {formError && (
              <p className="text-sm text-apt-red" role="alert">
                {formError}
              </p>
            )}

            {/* Why Save is grey — shown from the FIRST frame, not gated on `dirty`. `canSave`
                disables the button, so `submit()`'s own required-fields guard can no longer be
                reached by clicking; without this the Add dialog opens on a dead button with
                nothing explaining it. The requirement it states ("Name and stat key are
                required.") is precisely what the user opened the dialog to supply, so saying it
                up front is instruction rather than scolding. (An EDIT opens on a loaded row
                whose name and stat key are both set, so `blockedReason` is null there and this
                stays quiet without a `dirty` term.) */}
            {!formError && blockedReason && (
              <p className="text-sm text-apt-text-muted" role="status">
                {blockedReason}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={requestCloseDialog} disabled={saving}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving || !canSave}
                className={!saving ? "bg-apt-gold text-apt-bg hover:bg-apt-gold-bright" : ""}
              >
                {saving ? "Saving…" : isEdit ? "Save changes" : "Add event type"}
              </Button>
            </DialogFooter>
          </form>
          {/* Discard calls `closeDialog()` directly, NOT `requestCloseDialog()`: routing back
              through the gate would re-test `dirty` — still true — and re-raise the alert
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
        title="Delete event type?"
        description={
          deleteTarget ? (
            <>
              <span>{`Delete "${deleteTarget.name}"? Anything still posting this event will 404.`}</span>
              {deleteError && (
                <span className="mt-2 block text-apt-red" role="alert">
                  {deleteError}
                </span>
              )}
            </>
          ) : undefined
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        cancelLabel="Cancel"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
      />
    </div>
  );
}
