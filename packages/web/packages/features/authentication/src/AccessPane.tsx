"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { KeyRound } from "lucide-react";
import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { bucketAccessApi } from "@agentic-toolkit/data/security";
import { schemasApi } from "@agentic-toolkit/data/markdown";
import {
  ButtonBar,
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
  const renderRecordAffordance = useRecordAffordance();

  const refresh = useCallback(async () => {
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
      setBuckets(refs);
      setItems(sortItems(items));
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "bucket-access", step: "load-access" });
      setLoadError(err instanceof Error ? err.message : "Failed to load access lists.");
    }
  }, [ecosystemId]);

  const loadPrincipals = useCallback(async () => {
    try {
      const [users, apps] = await Promise.all([
        usersDirectory(ecosystemId),
        applicationsDirectory(ecosystemId),
      ]);
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

  const form = useMasterDetailForm<AccessItem, AccessGroupInput>({
    items,
    getId: (i) => i.group.id,
    urlSelection,
    blank: () => ({ bucketId: buckets[0]?.id ?? "", name: "", description: "" }),
    toInput: (i) => ({
      bucketId: i.group.bucketId,
      name: i.group.name,
      description: i.group.description,
    }),
    validate: (draft, others) => {
      if (!draft.bucketId) return "Choose a bucket.";
      if (!draft.name.trim()) return "Name is required.";
      const dup = others.some(
        (o) =>
          o.group.bucketId === draft.bucketId &&
          o.group.name.toLowerCase() === draft.name.trim().toLowerCase(),
      );
      if (dup) return `An access list named "${draft.name.trim()}" already exists in that bucket.`;
      return null;
    },
    differs: (a, b) =>
      a.bucketId !== b.bucketId ||
      a.name.trim() !== b.name.trim() ||
      a.description.trim() !== b.description.trim(),
    normalize: (d) => ({
      bucketId: d.bucketId,
      name: d.name.trim(),
      description: d.description.trim(),
    }),
    create: async (input) => {
      const group = await bucketAccessApi.createGroup(input.bucketId, {
        name: input.name,
        description: input.description,
      });
      return { group, bucketName: bucketNameFor(input.bucketId) };
    },
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
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {loadError && <p className="px-6 pt-4 text-sm text-apt-red">{loadError}</p>}
      <ButtonBar
        actions={form.actions}
        showCreate={false}
        trailing={
          form.creating
            ? renderRecordAffordance?.({
                method: "POST",
                path: "/bucket/buckets/{bucketId}/access-groups",
                pathValues: { bucketId: form.draft?.bucketId },
                title: "Create access group API",
              })
            : renderRecordAffordance?.({
                path: "/bucket/access-groups/{groupId}",
                pathValues: { groupId: form.selectedId },
                title: "Access group API",
              })
        }
        help={help}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-6 py-4">
        {form.editing && form.draft ? (
          <AccessGroupDetail
            key={form.detailKey}
            title={form.creating ? "New access list" : "Access list"}
            draft={form.draft}
            onChange={form.onChange}
            error={form.error}
            creating={form.creating}
            group={form.selected}
            buckets={buckets}
            principals={principals}
          />
        ) : (
          <EmptyState
            title={
              items === null ? "Loading…" : "Select an access list to edit, or create a new one."
            }
          />
        )}
      </div>
    </div>
  );
}
