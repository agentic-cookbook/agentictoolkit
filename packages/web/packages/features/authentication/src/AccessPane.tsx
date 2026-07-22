"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { KeyRound } from "lucide-react";
import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { bucketAccessApi } from "@agentic-toolkit/data/security";
import { schemasApi } from "@agentic-toolkit/data/markdown";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { Field, TopicSelectHint } from "@agentic-toolkit/ui/blocks";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Select } from "@agentic-toolkit/ui/components/select";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import {
  ButtonBar,
  CreateResourceDialog,
  useMasterDetailForm,
  useMasterDetailLevel,
  useRecordAffordance,
  type TopicLeaf,
} from "@agentic-toolkit/resource";
import { AccessGroupDetail } from "./AccessGroupDetail";
import {
  isEveryone,
  type AccessGroupInput,
  type AccessItem,
  type BucketRef,
  type Principal,
} from "./access-model";

/** The minimal user shape AccessPane reads from the host's user directory (id +
 *  enough to label a member row: a display name, falling back to email). */
export interface AccessDirectoryUser {
  id: string;
  displayName: string;
  email: string;
}

/** The minimal application shape AccessPane reads from the host's application directory. */
export interface AccessDirectoryApp {
  id: string;
  name: string;
}

function sortItems(items: AccessItem[]): AccessItem[] {
  // Group by bucket name, the seeded "everyone" first within each bucket, then by name.
  return [...items].sort(
    (a, b) =>
      a.bucketName.localeCompare(b.bucketName) ||
      Number(isEveryone(b.group)) - Number(isEveryone(a.group)) ||
      a.group.name.localeCompare(b.group.name),
  );
}

/**
 * The Ecosystems "Access" topic: every access list in the ecosystem (across all
 * buckets) in one place, each badged with its bucket. Decoupled from the bucket
 * editor — this is the single home for managing who can access what. Built on the
 * shared MasterDetailLayout + useMasterDetailForm, like the sibling Buckets/Users
 * panes.
 */
export function AccessPane({
  ecosystemId,
  help,
  leaf,
  usersDirectory,
  applicationsDirectory,
}: {
  ecosystemId?: string;
  /** Unused: the breadcrumb names the pane now (kept for the ScopedPane prop shape). */
  title?: ReactNode;
  help?: ReactNode;
  /** Deep-linkable access-list selection (`…/access/<groupId>`); omit for internal. */
  leaf?: TopicLeaf;
  /** The host's user directory (list users scoped to an ecosystem) — the user registry stays
   *  host-owned; this feature only needs id + a display label to populate the member picker. */
  usersDirectory: (ecosystemId: string | undefined) => Promise<AccessDirectoryUser[]>;
  /** The host's application directory (list applications scoped to an ecosystem) — the
   *  application registry stays host-owned; injected for the same reason as usersDirectory. */
  applicationsDirectory: (ecosystemId: string | undefined) => Promise<AccessDirectoryApp[]>;
}) {
  const [items, setItems] = useState<AccessItem[] | null>(null);
  const [buckets, setBuckets] = useState<BucketRef[]>([]);
  const [principals, setPrincipals] = useState<{ users: Principal[]; apps: Principal[] }>({
    users: [],
    apps: [],
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  // Creating an access list is a MODAL over the stack, never a blank leaf (HTD recipe
  // `must-create-in-modal`): the `+` opens it, and on save the new list is selected so
  // its REAL detail (members + grants) opens.
  const [newOpen, setNewOpen] = useState(false);
  const renderRecordAffordance = useRecordAffordance();

  // Latest-wins guards: both loaders re-run when their inputs change identity (ecosystemId,
  // or a host passing a fresh directory closure per render) AND are called imperatively
  // after mutations — a generation stamp makes any overlapped older response a no-op
  // instead of racing its stale result into state.
  const refreshGen = useRef(0);
  const principalsGen = useRef(0);

  const refresh = useCallback(async () => {
    const gen = ++refreshGen.current;
    setLoadError(null);
    try {
      // Two calls, not 1+N: the ecosystem's buckets (for names + the type picker) and
      // EVERY access group in one shot, joined client-side by bucketId. Groups whose
      // bucket isn't in this ecosystem's set are dropped (the bucket filter == the
      // ecosystem filter, since a group inherits its bucket's owner).
      const [defs, allGroups] = await Promise.all([
        schemasApi.list(ecosystemId),
        bucketAccessApi.listAllGroups(),
      ]);
      const refs: BucketRef[] = defs.map((d) => ({
        id: d.id,
        name: d.name,
        types: d.tables.map((t) => ({ id: t.id, name: t.name })),
      }));
      const nameByBucket = new Map(refs.map((b) => [b.id, b.name]));
      const items: AccessItem[] = allGroups
        .filter((group) => nameByBucket.has(group.bucketId))
        .map((group) => ({ group, bucketName: nameByBucket.get(group.bucketId) as string }));
      if (gen !== refreshGen.current) return; // superseded by a newer load
      setBuckets(refs);
      setItems(sortItems(items));
    } catch (err) {
      if (gen !== refreshGen.current) return;
      reportUnexpectedAuthError(err, { feature: "bucket-access", step: "load-access" });
      setLoadError(err instanceof Error ? err.message : "Failed to load access lists.");
    }
  }, [ecosystemId]);

  const loadPrincipals = useCallback(async () => {
    const gen = ++principalsGen.current;
    try {
      const [users, apps] = await Promise.all([
        usersDirectory(ecosystemId),
        applicationsDirectory(ecosystemId),
      ]);
      if (gen !== principalsGen.current) return; // superseded by a newer load
      setPrincipals({
        users: users.map((u) => ({ id: u.id, label: u.displayName || u.email })),
        apps: apps.map((a) => ({ id: a.id, label: a.name })),
      });
    } catch (err) {
      // Non-fatal: members can still be added by raw id without these lists.
      reportUnexpectedAuthError(err, { feature: "bucket-access", step: "load-principals" });
    }
  }, [ecosystemId, usersDirectory, applicationsDirectory]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void loadPrincipals();
  }, [loadPrincipals]);

  const bucketNameFor = (id: string) => buckets.find((b) => b.id === id)?.name ?? "—";

  const urlSelection = leaf
    ? { selectedId: leaf.leafId, onSelect: leaf.onSelect }
    : undefined;

  // The access-list draft's placement rules — bucket + name + description — extracted so the
  // form (edit) and the create MODAL share one source of truth (validation, trimming, the
  // create call). Members and grants are NOT placement; they live in the detail that opens once
  // the created list is selected.
  const groupBlank = (): AccessGroupInput => ({ bucketId: "", name: "", description: "" });
  const groupValidate = (draft: AccessGroupInput, others: AccessItem[]): string | null => {
    if (!draft.bucketId) return "Choose a bucket.";
    if (!draft.name.trim()) return "Name is required.";
    const dup = others.some(
      (o) =>
        o.group.bucketId === draft.bucketId &&
        o.group.name.toLowerCase() === draft.name.trim().toLowerCase(),
    );
    if (dup) return `An access list named "${draft.name.trim()}" already exists in that bucket.`;
    return null;
  };
  const groupNormalize = (d: AccessGroupInput): AccessGroupInput => ({
    bucketId: d.bucketId,
    name: d.name.trim(),
    description: d.description.trim(),
  });
  const createGroupItem = async (input: AccessGroupInput): Promise<AccessItem> => {
    const group = await bucketAccessApi.createGroup(input.bucketId, {
      name: input.name,
      description: input.description,
    });
    return { group, bucketName: bucketNameFor(input.bucketId) };
  };

  const form = useMasterDetailForm<AccessItem, AccessGroupInput>({
    items,
    getId: (i) => i.group.id,
    urlSelection,
    blank: groupBlank,
    toInput: (i) => ({
      bucketId: i.group.bucketId,
      name: i.group.name,
      description: i.group.description,
    }),
    validate: groupValidate,
    differs: (a, b) =>
      a.bucketId !== b.bucketId ||
      a.name.trim() !== b.name.trim() ||
      a.description.trim() !== b.description.trim(),
    normalize: groupNormalize,
    create: createGroupItem,
    update: async (id, input) => {
      const group = await bucketAccessApi.updateGroup(id, {
        name: input.name,
        description: input.description,
      });
      return { group, bucketName: bucketNameFor(group.bucketId) };
    },
    // The seeded "everyone" list is built in — reject its deletion with a clear message.
    remove: (item) =>
      isEveryone(item.group)
        ? Promise.reject(new Error("The “everyone” list is built in and can’t be deleted."))
        : bucketAccessApi.deleteGroup(item.group.id),
    confirmDelete: (item) =>
      `Delete access list "${item.group.name}"? Its members and grants will be removed.`,
    refresh,
    createLabel: "New access list",
  });

  // PUBLISH the access lists as a deeper stack level + register the editor's unsaved-work guard.
  useMasterDetailLevel({
    id: "access-list",
    title: "Access lists",
    form,
    items,
    getId: (i) => i.group.id,
    getLabel: (i) => (isEveryone(i.group) ? "Everyone" : i.group.name),
    getSublabel: (i) => i.bucketName,
    itemIcon: <KeyRound size={16} aria-hidden />,
    newLabel: "New access list",
    leaf,
    emptyLabel: items === null ? "Loading…" : "No access lists yet.",
    onNew: () => setNewOpen(true),
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ErrorText error={loadError} className="px-6 pt-4" />
      <ButtonBar
        actions={form.actions}
        showCreate={false}
        trailing={renderRecordAffordance?.({
          path: "/bucket/access-groups/{groupId}",
          pathValues: { groupId: form.selectedId },
          title: "Access group API",
        })}
        help={help}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-6 py-4">
        {form.editing && form.draft ? (
          <AccessGroupDetail
            key={form.detailKey}
            title="Access list"
            draft={form.draft}
            onChange={form.onChange}
            error={form.error}
            creating={form.creating}
            group={form.selected}
            buckets={buckets}
            principals={principals}
          />
        ) : items === null ? (
          <EmptyState title="Loading…" />
        ) : (
          <TopicSelectHint title="Select an access list to edit, or create a new one." />
        )}
      </div>

      {/* Create is a scoped modal: bucket + name + description only (members and grants live
          in the list's real detail, which opens once the created list is selected). */}
      {newOpen && (
        <CreateResourceDialog<AccessGroupInput, AccessItem>
          ariaLabel="New access list"
          heading="New access list"
          blank={groupBlank}
          validate={(d) => groupValidate(d, items ?? [])}
          create={(d) => createGroupItem(groupNormalize(d))}
          onClose={() => setNewOpen(false)}
          onCreated={(item) => {
            setNewOpen(false);
            void refresh();
            if (leaf) leaf.onSelect(item.group.id);
            else form.select(item.group.id);
          }}
          renderForm={(draft, onChange, error) => (
            <>
              <Field label="Bucket" hint="The bucket this access list controls.">
                <Select
                  value={draft.bucketId}
                  onChange={(e) => onChange({ ...draft, bucketId: e.target.value })}
                >
                  <option value="">Select a bucket…</option>
                  {buckets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Name" hint="Unique within the bucket.">
                <Input
                  /* eslint-disable-next-line jsx-a11y/no-autofocus -- focus the first text field on open */
                  autoFocus
                  value={draft.name}
                  placeholder="Editors"
                  onChange={(e) => onChange({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Description">
                <Textarea
                  rows={2}
                  value={draft.description}
                  placeholder="What this access list is for."
                  onChange={(e) => onChange({ ...draft, description: e.target.value })}
                />
              </Field>
              <ErrorText error={error} />
            </>
          )}
        />
      )}
    </div>
  );
}
