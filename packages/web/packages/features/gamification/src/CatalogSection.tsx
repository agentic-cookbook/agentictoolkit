"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { isForbidden } from "@agentic-toolkit/data";
import {
  gamificationApi,
  type CatalogBadge,
  type RealmBadgeInput,
} from "@agentic-toolkit/data/gamification";
import { useReportSettingsDirty } from "@agentic-toolkit/resource";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Checkbox } from "@agentic-toolkit/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@agentic-toolkit/ui/components/dialog";
import { AlertModal } from "@agentic-toolkit/ui/components/alert-modal";
import { UnsavedChangesAlert } from "@agentic-toolkit/ui/components/unsaved-changes-alert";
import { Field } from "@agentic-toolkit/ui/blocks";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { List, ListItem } from "@agentic-toolkit/ui/components/list";
import { Select } from "@agentic-toolkit/ui/components/select";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";

import { useRealmCatalog } from "./realm-catalog";
import { forbiddenAware } from "./err-text";

/**
 * The realm's BADGE catalog — a focused authoring surface (not a CMS). Lists the realm's
 * EFFECTIVE badges from GET /gamification/realms/:eco/catalog, grouped by line, every row
 * `source`-tagged: `source:'default'` rows are read-only (a "Platform default" chip, no
 * controls); `source:'realm'` rows are editable/deletable. Drives POST/PUT/DELETE …/badges.
 * API validation (400) surfaces inline at the form that triggered it.
 *
 * The catalog itself comes from {@link useRealmCatalog}, not a fetch of its own — the level
 * ladder is the other half of the same response and is now a sibling topic, so the fetch
 * belongs above both.
 */

const TIERS = ["none", "bronze", "silver", "gold", "platinum"] as const;
const COMPARATORS = [">=", ">", "="] as const;

type Tier = (typeof TIERS)[number];
type Comparator = (typeof COMPARATORS)[number];

// Numbers are held as strings so the inputs can be cleared mid-edit; they're
// coerced + validated on submit.
interface BadgeDraft {
  name: string;
  description: string;
  icon: string;
  statKey: string;
  comparator: Comparator;
  threshold: string;
  badgeLine: string;
  tier: Tier;
  pointValue: string;
  hidden: boolean;
}

/** Why the badge dialog can't save yet, or null — the SAME two messages `submitBadge` sets, in the
 *  same order. They have to be rendered as well as set: `canSaveBadge` disables the button, so
 *  those `setFormError` branches are no longer reachable by clicking, and a non-numeric threshold
 *  (which looks like ordinary text) would otherwise grey Save out with no explanation. */
function badgeBlockedReason(d: BadgeDraft): string | null {
  if (!d.name.trim() || !d.icon.trim() || !d.statKey.trim() || !d.badgeLine.trim()) {
    return "Name, icon, stat key, and badge line are required.";
  }
  // Belt-and-braces only, and deliberately untested: both fields are `type="number"`, so the DOM
  // never hands back a non-numeric string (it hands back ""), and `Number("")` is 0 — finite. Kept
  // because it is submitBadge's second guard and the two must stay one function.
  if (!Number.isFinite(Number(d.threshold)) || !Number.isFinite(Number(d.pointValue))) {
    return "Threshold and point value must be numbers.";
  }
  return null;
}

/** The badge body a draft would be SAVED as. One function, two callers: `submitBadge` sends it and
 *  `badgeDirty` diffs it. Diffing the raw draft instead compared strings the write never carries —
 *  a trailing space in any text field, or `"05"` in a numeric one, flipped Save on for a PUT with a
 *  byte-identical body: exactly the no-op write the dirty gate exists to prevent. */
function badgePayload(d: BadgeDraft): RealmBadgeInput {
  return {
    name: d.name.trim(),
    description: d.description.trim(),
    icon: d.icon.trim(),
    statKey: d.statKey.trim(),
    comparator: d.comparator,
    threshold: Number(d.threshold),
    badgeLine: d.badgeLine.trim(),
    tier: d.tier,
    pointValue: Number(d.pointValue),
    hidden: d.hidden,
  };
}

function emptyBadgeDraft(): BadgeDraft {
  return {
    name: "",
    description: "",
    icon: "",
    statKey: "",
    comparator: ">=",
    threshold: "",
    badgeLine: "",
    tier: "none",
    pointValue: "0",
    hidden: false,
  };
}

function toBadgeDraft(b: CatalogBadge): BadgeDraft {
  return {
    name: b.name,
    description: b.description,
    icon: b.icon,
    statKey: b.statKey ?? "",
    comparator: (b.comparator ?? ">=") as Comparator,
    threshold: b.threshold != null ? String(b.threshold) : "",
    badgeLine: b.badgeLine ?? "",
    tier: (b.tier ?? "none") as Tier,
    pointValue: String(b.pointValue),
    hidden: b.hidden ?? false,
  };
}

type BadgeDialogState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; id: string };

const errText = forbiddenAware("You don't have access to change this realm's catalog.");

export function CatalogSection({ ecosystemId }: { ecosystemId?: string }) {
  const { catalog, loadError, refresh } = useRealmCatalog();

  // ── Badge add/edit dialog ──────────────────────────────────────────────────
  const [dialog, setDialog] = useState<BadgeDialogState>({ mode: "closed" });
  const [draft, setDraft] = useState<BadgeDraft>(emptyBadgeDraft());
  // The loaded (edit) or blank (add) starting point, captured once per dialog
  // open — diffed against `draft` so Save stays disabled until something actually
  // changes, matching every other detail-view Save gate.
  const [baselineDraft, setBaselineDraft] = useState<BadgeDraft>(emptyBadgeDraft());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // The unsaved-changes alert raised by a close attempt on a dirty draft.
  const [confirmingClose, setConfirmingClose] = useState(false);

  // ── Delete confirm ─────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<CatalogBadge | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Badges grouped by line, preserving first-seen order.
  const groups = useMemo(() => {
    const map = new Map<string, CatalogBadge[]>();
    for (const b of catalog?.badges ?? []) {
      const key = b.badgeLine ?? "";
      const list = map.get(key);
      if (list) list.push(b);
      else map.set(key, [b]);
    }
    return [...map.entries()];
  }, [catalog]);

  const badgeDirty = useMemo(
    () => JSON.stringify(badgePayload(draft)) !== JSON.stringify(badgePayload(baselineDraft)),
    [draft, baselineDraft],
  );
  // Mirrors submitBadge's own guard checks (required fields + numeric threshold/point value) so
  // Save doesn't invite a doomed click — as a REASON, not a boolean, because a disabled Save that
  // won't say why is the bug this replaces.
  const badgeBlock = useMemo(() => badgeBlockedReason(draft), [draft]);
  const canSaveBadge = badgeDirty && badgeBlock === null;

  // The open draft, reported to the settings registry so the exits the dialog can't see for
  // itself — reload, a link click, a rail row switch — ask before discarding. Gated on the dialog
  // being OPEN as well as dirty: `draft`/`baselineDraft` are only re-seeded on open, so a closed
  // dialog's leftovers must never arm anything. A real payload diff, so a no-op edit the write
  // would drop never arms it either.
  useReportSettingsDirty("gamification-catalog", dialog.mode !== "closed" && badgeDirty);

  if (!ecosystemId) return null;

  // ── Badge dialog handlers ────────────────────────────────────────────────

  function openAdd() {
    const blank = emptyBadgeDraft();
    setDraft(blank);
    setBaselineDraft(blank);
    setFormError(null);
    setDialog({ mode: "add" });
  }

  function openEdit(b: CatalogBadge) {
    const loaded = toBadgeDraft(b);
    setDraft(loaded);
    setBaselineDraft(loaded);
    setFormError(null);
    setDialog({ mode: "edit", id: b.id });
  }

  function closeDialog() {
    setDialog({ mode: "closed" });
    setFormError(null);
  }

  /** Every way OUT of the badge dialog: Escape, a backdrop click and the × all arrive here
   *  through `onOpenChange`, and so does Cancel. Asks before throwing a dirty draft away;
   *  `badgeDirty` is a real diff against the baseline the dialog opened on (blank for add), so
   *  opening a dialog and changing your mind never nags. */
  function requestCloseDialog() {
    if (saving) return;
    if (badgeDirty) {
      setConfirmingClose(true);
      return;
    }
    closeDialog();
  }

  async function submitBadge() {
    if (!ecosystemId) return;
    const block = badgeBlockedReason(draft);
    if (block) {
      setFormError(block);
      return;
    }
    const input = badgePayload(draft);
    setSaving(true);
    setFormError(null);
    try {
      if (dialog.mode === "edit") {
        await gamificationApi.updateRealmBadge(ecosystemId, dialog.id, input);
      } else {
        await gamificationApi.createRealmBadge(ecosystemId, input);
      }
      closeDialog();
      await refresh();
    } catch (err) {
      if (!isForbidden(err)) {
        reportUnexpectedAuthError(err, { feature: "gamification-catalog", step: "save-badge" });
      }
      setFormError(errText(err, "Could not save the badge."));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!ecosystemId || !deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await gamificationApi.deleteRealmBadge(ecosystemId, deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      if (!isForbidden(err)) {
        reportUnexpectedAuthError(err, { feature: "gamification-catalog", step: "delete-badge" });
      }
      setDeleteError(errText(err, "Could not delete the badge."));
    } finally {
      setDeleting(false);
    }
  }

  const isEdit = dialog.mode === "edit";

  return (
    <div>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-sm font-medium text-apt-text">Catalog</p>
          <p className="mt-0.5 text-xs text-apt-text-muted">
            Platform defaults plus this realm&apos;s own badges. Defaults are read-only; add or
            edit realm badges here, then backfill to award them retroactively.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={openAdd} aria-label="Add realm badge">
          <Plus data-icon="inline-start" />
          Add badge
        </Button>
      </div>

      {loadError && <p className="mt-4 text-sm text-apt-red">{loadError}</p>}
      {!catalog && !loadError && <p className="mt-4 text-sm text-apt-text-muted">Loading…</p>}

      {/* Badges grouped by line */}
      {catalog && (
        <div className="mt-4 flex flex-col gap-5">
          {groups.length === 0 && (
            <p className="text-sm text-apt-text-muted">No badges in this realm yet.</p>
          )}
          {groups.map(([line, badges]) => (
            <div key={line || "(unlined)"}>
              <p className="mb-1.5 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-apt-text-dim">
                {line || "Ungrouped"}
              </p>
              <List>
                {badges.map((b) => {
                  const isRealm = b.source === "realm";
                  const comparator = b.comparator ?? ">=";
                  return (
                    <ListItem key={b.id} className="flex-wrap gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium text-apt-text">
                          {b.icon ? `${b.icon} ` : ""}
                          {b.name}
                        </span>
                        <span className="ml-2 font-mono text-xs text-apt-text-muted">
                          {b.statKey ?? "—"} {comparator} {b.threshold ?? "—"}
                          {b.tier && b.tier !== "none" ? ` · ${b.tier}` : ""}
                          {b.hidden ? " · hidden" : ""}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge variant={isRealm ? "accent" : "neutral"}>
                          {isRealm ? "Realm" : "Platform default"}
                        </Badge>
                        {isRealm && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openEdit(b)}
                              aria-label={`Edit ${b.name}`}
                            >
                              <Pencil className="size-3.5" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="destructive-ghost"
                              size="icon-sm"
                              onClick={() => {
                                setDeleteError(null);
                                setDeleteTarget(b);
                              }}
                              aria-label={`Delete ${b.name}`}
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </Button>
                          </>
                        )}
                      </div>
                    </ListItem>
                  );
                })}
              </List>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit realm badge dialog */}
      <Dialog
        open={dialog.mode !== "closed"}
        onOpenChange={(open) => {
          if (!open) requestCloseDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit realm badge" : "Add realm badge"}</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submitBadge();
            }}
          >
            <div className="flex gap-3">
              <Field label="Name" className="flex-1">
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Trailblazer"
                />
              </Field>
              <Field label="Icon" className="w-24">
                <Input
                  value={draft.icon}
                  onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))}
                  placeholder="🔥"
                />
              </Field>
            </div>

            <Field label="Description">
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Awarded for blazing the trail."
              />
            </Field>

            <div className="flex gap-3">
              <Field label="Stat key" className="flex-1">
                <Input
                  value={draft.statKey}
                  onChange={(e) => setDraft((d) => ({ ...d, statKey: e.target.value }))}
                  placeholder="adventures"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </Field>
              <Field label="Comparator" className="w-28">
                <Select
                  value={draft.comparator}
                  onChange={(e) => setDraft((d) => ({ ...d, comparator: e.target.value as Comparator }))}
                >
                  {COMPARATORS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Threshold" className="w-28">
                <Input
                  type="number"
                  value={draft.threshold}
                  onChange={(e) => setDraft((d) => ({ ...d, threshold: e.target.value }))}
                  placeholder="10"
                />
              </Field>
            </div>

            <div className="flex gap-3">
              <Field label="Badge line" className="flex-1">
                <Input
                  value={draft.badgeLine}
                  onChange={(e) => setDraft((d) => ({ ...d, badgeLine: e.target.value }))}
                  placeholder="adventures"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </Field>
              <Field label="Tier" className="w-32">
                <Select
                  value={draft.tier}
                  onChange={(e) => setDraft((d) => ({ ...d, tier: e.target.value as Tier }))}
                >
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Points" className="w-24">
                <Input
                  type="number"
                  value={draft.pointValue}
                  onChange={(e) => setDraft((d) => ({ ...d, pointValue: e.target.value }))}
                  placeholder="50"
                />
              </Field>
            </div>

            <Label className="flex items-center gap-2">
              <Checkbox
                checked={draft.hidden}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, hidden: v === true }))}
              />
              <span className="text-sm text-apt-text">Hidden until earned</span>
            </Label>

            {formError && (
              <p className="text-sm text-apt-red" role="alert">
                {formError}
              </p>
            )}

            {/* Why Save is grey. Gated on `badgeDirty` so the Add dialog doesn't open by
                complaining about fields nobody has been asked for yet — "nothing to save" needs
                no caption; "that threshold isn't a number" does. */}
            {!formError && badgeBlock && badgeDirty && (
              <p className="text-sm text-apt-text-muted" role="status">
                {badgeBlock}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={requestCloseDialog} disabled={saving}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving || !canSaveBadge}
                className={!saving ? "bg-apt-gold text-apt-bg hover:bg-apt-gold-bright" : ""}
              >
                {saving ? "Saving…" : isEdit ? "Save changes" : "Add badge"}
              </Button>
            </DialogFooter>
          </form>
          {/* Discard calls `closeDialog()` directly, NOT `requestCloseDialog()`: routing back
              through the gate would re-test `badgeDirty` — still true — and re-raise the alert
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
        title="Delete realm badge?"
        description={
          deleteTarget ? (
            <>
              <span>{`Delete "${deleteTarget.name}"? Members holding it lose it.`}</span>
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
