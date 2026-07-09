"use client";

import { useState } from "react";
import { Layers } from "lucide-react";
import type { SiteGroupView } from "@agentic-toolkit/data/monitored-sites";
import { createGroup, deleteGroup, updateGroup } from "@agentic-toolkit/data/monitored-sites";
import {
  CreateResourceDialog,
  MasterDetailLeaf,
  useMasterDetailForm,
  useMasterDetailLevel,
  useRecordAffordance,
  type TopicLeaf,
} from "@agentic-toolkit/resource";
import {
  GroupDetail,
  groupBlank,
  groupToInput,
  groupValidate,
  type GroupDraft,
} from "./GroupDetail";

function groupDiffers(a: GroupDraft, b: GroupDraft): boolean {
  return (Object.keys(a) as (keyof GroupDraft)[]).some((k) => a[k].trim() !== b[k].trim());
}

function groupNormalize(d: GroupDraft): GroupDraft {
  // retentionDays stays the string input; the create/update adapters parse it.
  return { name: d.name.trim(), slug: d.slug.trim(), retentionDays: d.retentionDays };
}

/**
 * Groups, dismantled into the one-stack model: the groups list is PUBLISHED as a deeper rail level
 * (via {@link useMasterDetailLevel}); this component renders only the editor leaf (a group's name /
 * slug / retention). Selection is URL-driven + deep-linkable when a `leaf` is threaded (the
 * Dashboards route, `…/dashboards/groups/<groupId>`), else local. Sites reference these groups.
 */
export function GroupsSection({
  groups,
  onChanged,
  leaf,
  reservedSlugs,
}: {
  groups: SiteGroupView[] | null;
  onChanged: () => Promise<void>;
  /** Deep-linkable group selection (`…/dashboards/groups/<groupId>`); omit for internal. */
  leaf?: TopicLeaf;
  /** The HOST's reserved slug words (its URL-namespace protection) — rejected on save. */
  reservedSlugs?: ReadonlySet<string>;
}) {
  const renderRecordAffordance = useRecordAffordance();
  const urlSelection = leaf ? { selectedId: leaf.leafId, onSelect: leaf.onSelect } : undefined;
  // "New group" is a POPUP (like New Ecosystem / New site), not an inline blank form.
  const [newOpen, setNewOpen] = useState(false);

  const form = useMasterDetailForm<SiteGroupView, GroupDraft>({
    items: groups,
    getId: (g) => g.id,
    urlSelection,
    blank: groupBlank,
    toInput: groupToInput,
    validate: (draft, others) => groupValidate(draft, others.map((o) => o.slug), reservedSlugs),
    differs: groupDiffers,
    normalize: groupNormalize,
    create: (input) =>
      createGroup({
        name: input.name,
        slug: input.slug,
        retentionDays: parseInt(input.retentionDays, 10),
      }),
    update: (id, input) =>
      updateGroup(id, {
        name: input.name,
        slug: input.slug,
        retentionDays: parseInt(input.retentionDays, 10),
      }),
    remove: (g) => deleteGroup(g.id),
    confirmDelete: (g) =>
      `Delete group "${g.name}"? Its sites and their endpoints will be deleted too.`,
    refresh: onChanged,
    createLabel: "New group",
  });

  // PUBLISH the groups as a deeper stack level + register the editor's unsaved-work guard.
  useMasterDetailLevel({
    id: "monitor-groups-list",
    title: "Groups",
    form,
    items: groups,
    getId: (g) => g.id,
    getLabel: (g) => g.name,
    getSublabel: (g) => `${g.slug} · ${g.retentionDays}d`,
    itemIcon: <Layers size={16} aria-hidden />,
    newLabel: "New group",
    leaf,
    emptyLabel: groups === null ? "Loading…" : "No groups yet.",
    onNew: () => setNewOpen(true),
  });

  return (
    <>
      <MasterDetailLeaf
        form={form}
        trailing={renderRecordAffordance?.({
          path: "/monitoring/site-groups/{id}",
          pathValues: { id: form.selectedId },
          title: "Site group API",
        })}
        emptyTitle={groups === null ? "Loading…" : "Select a group to edit, or create a new one."}
        renderDetail={(draft) => (
          <GroupDetail
            key={form.detailKey}
            title="Group"
            draft={draft}
            onChange={form.onChange}
            error={form.error}
          />
        )}
      />
      {newOpen && (
        <CreateResourceDialog
          ariaLabel="New group"
          heading="New group"
          blank={groupBlank}
          validate={(d) => groupValidate(d, (groups ?? []).map((g) => g.slug), reservedSlugs)}
          create={(d) =>
            createGroup({
              name: d.name,
              slug: d.slug,
              retentionDays: parseInt(d.retentionDays, 10),
            })
          }
          onClose={() => setNewOpen(false)}
          onCreated={(group) => {
            setNewOpen(false);
            void onChanged();
            leaf?.onSelect(group.id);
          }}
          renderForm={(draft, onChange, error) => (
            <GroupDetail draft={draft} onChange={onChange} error={error} />
          )}
        />
      )}
    </>
  );
}
