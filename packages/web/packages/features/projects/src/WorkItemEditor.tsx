"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { Field } from "@agentic-toolkit/ui/blocks/field";
import { Select } from "@agentic-toolkit/ui/components/select";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import { Button } from "@agentic-toolkit/ui/components/button";
import { useDirtyDraft } from "@agentic-toolkit/ui/hooks/useDirtyDraft";
import { projectWorkItemsApi, type WorkItem } from "@agentic-toolkit/data/projects";
import { projectActivityApi } from "@agentic-toolkit/data/projects";
import type { ProjectStatus, ProjectParticipant } from "@agentic-toolkit/data/projects";
import { useRecordAffordance } from "@agentic-toolkit/resource";
import { AssigneePicker, toOptionValue, fromOptionValue, type AssigneeValue } from "./AssigneePicker";
import { ActivityFeed, ACTIVITY_PAGE_SIZE } from "./ActivityFeed";
import { type BadgeVariant } from "./helpers";

/**
 * The EDIT form over a single work item: title, description, status, assignee
 * (AssigneePicker), priority, start/due dates, an optional parent, and its activity.
 *
 * It only ever edits an EXISTING item — creating is a modal ({@link NewWorkItemDialog}), because
 * in the hierarchical stack the detail pane always shows a real, selected record. It PATCHes
 * only the changed fields (→ .update). The one subtlety is the
 * assignee clear: dropping an assignee to "Unassigned" sends an explicit
 * `assigneeKind: null, assigneeId: null` — the T1 client keeps explicit null, so
 * the PATCH carries the clear rather than stripping it. Reload-after-write (the
 * saved row flows back through onSaved so the pane refreshes its list), matching
 * the sibling ProjectOverviewPane / TeamMembersPane panes.
 */

/* ── Priority ─────────────────────────────────────────────────────────────
 * Priority is a small int; this is its single source of truth — the editor's
 * Select options AND the list's Badge both read it, so a label/tone is defined
 * once. Badge tones are variants (never raw colors) per the UI gate — the
 * `BadgeVariant` type comes from the shared `./helpers` module. */
export const PRIORITIES: { value: number; label: string; variant: BadgeVariant }[] = [
  { value: 0, label: "None", variant: "neutral" },
  { value: 1, label: "Low", variant: "blue" },
  { value: 2, label: "Medium", variant: "orange" },
  { value: 3, label: "High", variant: "accent" },
  { value: 4, label: "Urgent", variant: "error" },
];

export function priorityMeta(n: number): { label: string; variant: BadgeVariant } {
  return PRIORITIES.find((p) => p.value === n) ?? { label: String(n), variant: "neutral" };
}

/** The item's stored assignee as the picker's value ({kind,id} | null). */
function assigneeOf(item: WorkItem | null): AssigneeValue | null {
  if (!item || !item.assigneeKind || !item.assigneeId) return null;
  return { assigneeKind: item.assigneeKind, assigneeId: item.assigneeId };
}

/**
 * The editor's draft shape — one object so `useDirtyDraft` can tell whether ANY field differs
 * from what was loaded. `assignee` is carried as its encoded option string (`toOptionValue`'s
 * `"kind:id"` | `""`), not the `{assigneeKind,assigneeId}` object `AssigneePicker` works with:
 * `useDirtyDraft`'s dirty-check compares non-array fields by `Object.is`, so an object-valued field
 * would read as dirty forever the first time it's set (a fresh object each keystroke/selection,
 * never `===` the baseline's). Reusing the picker's own string codec sidesteps that instead of
 * papering over it — the same discipline `sameValue` already applies to arrays, applied here via
 * the field's representation rather than a hook change.
 */
type WorkItemDraft = {
  title: string;
  description: string;
  statusId: string;
  assigneeOption: string;
  priority: number;
  startDate: string;
  dueDate: string;
  parentId: string;
};

/** Load a work item into the editor's draft shape — the ONE place "what a work item's editable
 *  fields look like as a draft" is defined, used both to seed the draft and (after a save) to
 *  rebuild the baseline from the server's row. `statuses` supplies the same first-status fallback
 *  the Status field itself falls back to when the item has none. */
function draftFromItem(item: WorkItem, statuses: ProjectStatus[]): WorkItemDraft {
  return {
    title: item.title,
    description: item.description ?? "",
    statusId: item.statusId ?? statuses[0]?.id ?? "",
    assigneeOption: toOptionValue(assigneeOf(item)),
    priority: item.priority,
    startDate: item.startDate ?? "",
    dueDate: item.dueDate ?? "",
    parentId: item.parentId ?? "",
  };
}

/* ── Per-item activity + comment composer (edit mode only) ──────────────────
 * The work item's own activity trail (a keyset ActivityFeed over
 * workItemActivity) plus a composer: a comment posts to the item, then the feed
 * refreshes by re-mounting via a bumped `key` — the ActivityFeed refresh idiom. */
function ItemActivitySection({ workItemId }: { workItemId: string }): ReactElement {
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    (before?: string) =>
      projectActivityApi.workItemActivity(workItemId, {
        limit: ACTIVITY_PAGE_SIZE,
        before,
      }),
    [workItemId],
  );

  async function submit() {
    const trimmed = body.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    setError(null);
    try {
      await projectActivityApi.addComment(workItemId, trimmed);
      if (!mounted.current) return;
      setBody("");
      // Re-mount the feed so it re-loads with the new comment at the top.
      setRefreshKey((k) => k + 1);
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : "Failed to post comment.");
      }
    } finally {
      if (mounted.current) setPosting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-apt-border pt-5">
      <h3 className="text-sm font-semibold text-apt-text">Activity</h3>
      <div className="flex items-start gap-2">
        <Input
          value={body}
          aria-label="Comment"
          placeholder="Add a comment…"
          onChange={(e) => {
            setError(null);
            setBody(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
        />
        <Button onClick={() => void submit()} disabled={posting || !body.trim()}>
          {posting ? "Posting…" : "Comment"}
        </Button>
      </div>
      <ErrorText error={error} />
      <ActivityFeed key={refreshKey} load={load} />
    </div>
  );
}

export function WorkItemEditor({
  projectId,
  item,
  statuses,
  participants,
  workItems,
  onSaved,
  onCancel,
}: {
  projectId: string;
  /** The item being edited. Creating goes through NewWorkItemDialog, never this editor. */
  item: WorkItem;
  statuses: ProjectStatus[];
  participants: ProjectParticipant[];
  /** the project's work items, for the parent picker (the edited item is excluded). */
  workItems: WorkItem[];
  onSaved: (saved: WorkItem) => void;
  onCancel: () => void;
}): ReactElement {
  // The host-injected per-record affordance (the hub's api-explorer button); null on
  // a standalone feature site → the trailing slot renders nothing.
  const renderRecordAffordance = useRecordAffordance();
  // Seeded once from `item`; the pane keys this editor by item id (or "new") so a
  // switch remounts it with fresh state — no derive-from-props effect needed.
  const { draft, set, dirty, commit, baseline } = useDirtyDraft<WorkItemDraft>(() =>
    draftFromItem(item, statuses),
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = dirty && draft.title.trim().length > 0;
  // Parent options: every other work item in the project (an item can't parent itself).
  const parentOptions = useMemo(
    () => workItems.filter((w) => w.id !== item.id),
    [workItems, item.id],
  );

  async function save() {
    if (!draft.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const patch = buildPatch();
      // Nothing changed → skip the no-op PATCH (empty body) and adopt the
      // unchanged item, avoiding a pointless network round-trip.
      const saved =
        Object.keys(patch).length === 0
          ? item
          : await projectWorkItemsApi.update(item.id, patch);
      // Adopt the saved row as the new baseline so Save re-disables until the next edit. This is
      // DEFENSIVE, not load-bearing for the current consumer: WorkItemsSurface's onSaved clears
      // selectedId, which unmounts this editor on every successful save (a fresh instance mounts
      // if the same item is reselected), so nothing here observes the moved baseline today. Keep
      // it anyway — single-source-of-truth is still right, and it's what makes this editor correct
      // for any FUTURE consumer that keeps it mounted across a save (e.g. an inline/non-modal
      // surface), the same way `baseline` itself is a general-purpose hook extension rather than
      // something built to this one consumer's current unmount behavior.
      commit(draftFromItem(saved, statuses));
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save work item.");
    } finally {
      setSaving(false);
    }
  }

  // Edit mode: PATCH only the changed fields, diffed against the hook's committed BASELINE (what
  // was actually loaded/last saved) rather than the `item` prop — after `commit()` above the
  // baseline is the server's row while `item` is still the stale pre-save prop, so the two would
  // disagree exactly when it matters. Clearing the assignee / a date / the parent sends an
  // explicit null (the T1 client keeps it), which is the backend's clear semantics.
  function buildPatch(): Parameters<typeof projectWorkItemsApi.update>[1] {
    const patch: Parameters<typeof projectWorkItemsApi.update>[1] = {};
    if (draft.title.trim() !== baseline.title) patch.title = draft.title.trim();
    if (draft.description.trim() !== baseline.description) {
      patch.description = draft.description.trim();
    }
    if (draft.statusId !== baseline.statusId) patch.statusId = draft.statusId;

    if (draft.assigneeOption !== baseline.assigneeOption) {
      const decoded = fromOptionValue(draft.assigneeOption);
      patch.assigneeKind = (decoded?.assigneeKind ?? null) as WorkItem["assigneeKind"];
      patch.assigneeId = decoded?.assigneeId ?? null;
    }

    if (draft.priority !== baseline.priority) patch.priority = draft.priority;

    const newStart = draft.startDate || null;
    if (newStart !== (baseline.startDate || null)) patch.startDate = newStart;
    const newDue = draft.dueDate || null;
    if (newDue !== (baseline.dueDate || null)) patch.dueDate = newDue;
    const newParent = draft.parentId || null;
    if (newParent !== (baseline.parentId || null)) patch.parentId = newParent;

    return patch;
  }

  return (
    <div className="flex max-w-xl flex-col gap-5">
      {item && (
        <div className="flex justify-end">
          {renderRecordAffordance?.({
            path: "/project/work-items/{id}",
            pathValues: { id: item.id },
            title: "Work item API",
          })}
        </div>
      )}
      <Field label="Title">
        <Input
          /* eslint-disable-next-line jsx-a11y/no-autofocus -- intentional focus-on-open for the editor's first field */
          autoFocus
          value={draft.title}
          onChange={(e) => {
            setError(null);
            set("title", e.target.value);
          }}
          placeholder="Design the landing page"
        />
      </Field>

      <Field label="Description">
        <Textarea
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="What needs to happen? (optional)"
          rows={3}
        />
      </Field>

      <Field label="Status">
        <Select value={draft.statusId} onChange={(e) => set("statusId", e.target.value)}>
          {statuses.length === 0 && <option value="">Default</option>}
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>

      <AssigneePicker
        participants={participants}
        value={fromOptionValue(draft.assigneeOption)}
        onChange={(v) => set("assigneeOption", toOptionValue(v))}
      />

      <Field label="Priority">
        <Select
          value={String(draft.priority)}
          onChange={(e) => set("priority", Number(e.target.value))}
        >
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="flex flex-wrap gap-4">
        <Field label="Start date" className="min-w-40 flex-1">
          <Input
            type="date"
            value={draft.startDate}
            onChange={(e) => set("startDate", e.target.value)}
          />
        </Field>
        <Field label="Due date" className="min-w-40 flex-1">
          <Input
            type="date"
            value={draft.dueDate}
            onChange={(e) => set("dueDate", e.target.value)}
          />
        </Field>
      </div>

      <Field label="Parent" hint="An optional parent work item in this project.">
        <Select value={draft.parentId} onChange={(e) => set("parentId", e.target.value)}>
          <option value="">None</option>
          {parentOptions.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title}
            </option>
          ))}
        </Select>
      </Field>

      <ErrorText error={error} />

      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={() => void save()} disabled={!canSave || saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      {/* Activity + comments live only on a saved item (needs a real id). */}
      <ItemActivitySection workItemId={item.id} />
    </div>
  );
}
