"use client";

import {
  Fragment,
  useCallback,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  HierarchicalTopicDetail,
  type TopicDetailItem,
  type TopicLevel,
} from "@agentic-toolkit/ui/blocks";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { ResourceLanding } from "./resource-landing";
import {
  RailHostContext,
  StackLevels,
  useRailHost,
  type PaneExitGuard,
  type RailHostRegistry,
  type RegisteredLevels,
} from "./rail-host";

/** The deep-linkable LEAF inside a topic (e.g. the selected application within the
 *  Applications topic): the id lives in the URL, and `onSelect` re-routes to it. Topics
 *  whose pane is a master/detail thread this into `useMasterDetailForm({ urlSelection })`;
 *  single-record topics ignore it. */
export interface TopicLeaf {
  leafId: string | null;
  onSelect: (leafId: string | null) => void;
}

export interface ResourceTopic {
  id: string;
  label: string;
  icon: ReactNode;
  dividerAfter?: boolean;
  /** Render the topic's pane for the active resource id (undefined while "All"). `leaf`
   *  carries the deep-linkable leaf selection for master/detail topics; `subLeafFor` builds the
   *  deeper leaf for a grouping topic's member (…/<topic>/<member>/<entity>), so the member's own
   *  inner entity is deep-linkable too. Non-grouping topics ignore `subLeafFor`. */
  render: (
    scopedId: string | undefined,
    titleFor: (label: string) => string,
    leaf: TopicLeaf,
    subLeafFor: (memberId: string) => TopicLeaf,
  ) => ReactNode;
}

export interface ResourceLandingConfig<T> {
  title: string;
  help: string;
  emptyLabel: string;
  getSublabel: (item: T) => string;
  renderMeta: (item: T) => ReactNode;
}

/**
 * The shared orchestrator for a selectable-resource feature (Ecosystems / Persona
 * Services / Teams), as a HIERARCHICAL topic/detail (HierarchicalTopicDetail):
 *
 *   [ breadcrumbs · New… ]
 *   [ resource rail ] | [ topics rail ] | [ topic pane ]
 *
 * Level 0 is the resource list itself (no popup — the entity is a first-class rail
 * level); selecting one scopes the topics in level 1. With nothing selected ("All"),
 * the pane is the resource card landing; the entity-first model means New lives in
 * the top bar and Delete lives in the entity pane's Danger zone. URL-driven:
 * `<basePath>/all` or `<basePath>/<id>/<topic>`. All the selection/fallback/
 * default-topic wiring is owned here.
 *
 * (History: this was the hub's misnamed `ResourceTab` — never a tab, always the
 * feature orchestrator — renamed `ResourceExplorer` when it moved into the toolkit.)
 */
export function ResourceExplorer<T>({
  all,
  promoteTopics,
  defaultId,
  activeId,
  activeTopic,
  activeLeafId,
  activeMemberEntityId,
  basePath,
  items,
  getId,
  getLabel,
  itemIcon,
  nameSuffix,
  topics,
  landing,
  newLabel,
  renderDialog,
}: {
  all?: boolean;
  /** Promote the TOPICS to the first (and only) rail: no resource list, no "All" landing. The
   *  scoped resource is `activeId ?? defaultId`, so the feature opens straight on the default
   *  resource's topics. The Ecosystem feature uses this — its resource list moves into a topic
   *  ("Child Ecosystems") instead of being the top-level rail. Persona Services / Teams leave it
   *  unset and keep the classic list-first arrangement. */
  promoteTopics?: boolean;
  /** The resource to scope to when the URL names none — only consulted in `promoteTopics`. */
  defaultId?: string;
  activeId?: string;
  activeTopic?: string;
  /** The 4th URL segment: a deep-linkable leaf inside the active topic's pane. For a grouping
   *  topic this selects the group MEMBER; its inner entity rides `activeMemberEntityId` below. */
  activeLeafId?: string;
  /** The 5th URL segment: for a grouping topic, the deep-linkable inner entity of the open member
   *  (…/<topic>/<member>/<entity>) — a persona, a bucket, a user. Non-grouping topics ignore it. */
  activeMemberEntityId?: string;
  basePath: string;
  items: T[] | null;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  /** Leading icon for each resource rail row (e.g. <Network/>); a neutral ring
   *  fills in when omitted so the collapsed icon strip is never blank. */
  itemIcon?: ReactNode;
  /** Suffix in feature titles, e.g. "Ecosystem" → "Applications (Core Ecosystem)". */
  nameSuffix: string;
  topics: ResourceTopic[];
  /** The "All" card-landing config — required for the classic list-first arrangement; omit in
   *  `promoteTopics` mode, which has no "All" landing (the resource list moves into a topic). */
  landing?: ResourceLandingConfig<T>;
  newLabel: string;
  /** The "New …" dialog; call onCreated(newId) to switch to the created resource. Optional in
   *  `promoteTopics` mode, where the "New" affordance lives on the promoted resource-list topic
   *  (which owns its own dialog) rather than on a top-level rail. */
  renderDialog?: (onClose: () => void, onCreated: (id: string) => void) => ReactNode;
}): ReactElement {
  const router = useRouter();
  const [newOpen, setNewOpen] = useState(false);

  const validTopics = new Set(topics.map((t) => t.id));

  // In `promoteTopics` mode a bare/unknown path scopes to the DEFAULT resource (there is no
  // "All" landing — the feature opens straight on the default's topics). Otherwise the classic
  // list-first behaviour applies: an unknown/deleted id (or a topic word mistaken for an id)
  // falls back to the "All" landing once the list has loaded, rather than a phantom-scoped pane.
  const requestedId = activeId ?? (promoteTopics ? defaultId : undefined);
  const explicitAll = !promoteTopics && all === true;
  const loaded = items !== null;
  const knownId = requestedId !== undefined && (items ?? []).some((i) => getId(i) === requestedId);
  // Bare base path (no id, not explicit /all): render the "All" landing. There is no
  // resume / last-id tracking (see below) — the user picks an entity. Never "All" in promoteTopics.
  const bare = !explicitAll && requestedId === undefined;
  const isAll =
    !promoteTopics &&
    (explicitAll || bare || (loaded && requestedId !== undefined && !knownId));

  // The active resource scopes the topics: the URL id (or, in promoteTopics, the default).
  const scopedId = isAll ? undefined : requestedId;
  // No auto-select: an absent/unknown topic is "nothing selected" (the topics list shows with no
  // focus), NOT a coerced first topic.
  const topic = !isAll && activeTopic && validTopics.has(activeTopic) ? activeTopic : null;

  const active = items?.find((i) => getId(i) === scopedId);
  // "Members (Core Platform Ecosystem)" — but the entity topic's label already IS the
  // nameSuffix, so don't double it ("Ecosystem (Core Platform)", not "… Ecosystem)").
  const titleFor = (label: string) =>
    !active
      ? label
      : label === nameSuffix
        ? `${label} (${getLabel(active)})`
        : `${label} (${getLabel(active)} ${nameSuffix})`;

  const newButtonLabel = newLabel.replace(/…+$/, "").trim();

  // No resume / no last-id tracking: nothing is auto-selected. A bare base path shows the "All"
  // landing (every entity as a card); the user picks an entity (and then a topic) themselves.

  // Level 0 = the resource list; level 1 = the topics scoped to the selection.
  // The rail shows just the name (one line) — the reverse-domain id / sublabel still
  // appears on the "All" cards, so the list stays uncluttered.
  const entityItems: TopicDetailItem[] = (items ?? []).map((it) => ({
    id: getId(it),
    label: getLabel(it),
    icon: itemIcon,
  }));
  const topicItems: TopicDetailItem[] = topics.map((t) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
    dividerAfter: t.dividerAfter,
  }));

  const resourceLevel: TopicLevel = {
    id: "resource",
    title: landing?.title ?? "",
    items: entityItems,
    selectedId: isAll ? null : (scopedId ?? null),
    // No default topic appended — selecting an entity shows its topics list with nothing focused.
    onSelect: (id) => router.push(`${basePath}/${id}`, { scroll: false }),
    onClear: () => router.push(basePath, { scroll: false }),
    emptyLabel: landing?.emptyLabel ?? "",
    // "New …" is a right-justified `+` in the resource list header.
    onNew: () => setNewOpen(true),
    newLabel: newButtonLabel,
  };
  const topicLevel: TopicLevel = {
    id: "topic",
    // The topics list belongs to the selected entity — name it after that entity (falling back to
    // the entity noun in promoteTopics, where a rail header reads "Ecosystem" until the name loads).
    title: entityItems.find((e) => e.id === scopedId)?.label ?? (promoteTopics ? nameSuffix : "Topics"),
    items: topicItems,
    selectedId: topic,
    onSelect: (id) => {
      if (scopedId) router.push(`${basePath}/${scopedId}/${id}`, { scroll: false });
    },
    onClear: () => {
      if (scopedId) router.push(`${basePath}/${scopedId}`, { scroll: false });
    },
  };
  // promoteTopics (Ecosystem): the topics ARE the first rail — no resource list, no "All".
  const levels: TopicLevel[] = promoteTopics ? [topicLevel] : [resourceLevel, topicLevel];

  // DUAL MODE: inside a rail host (the hub's one-rail workspace shell), PUBLISH the resource + topic
  // levels into the host's one merged HierarchicalTopicDetail (the breadcrumb tail — workspace ▸
  // feature ▸ entity ▸ topic — is derived from these levels). Standalone (no host — e.g. a feature
  // site's /home, or /home/persona-services), render an own HTD below.
  const chrome = useRailHost();

  // The deep-linkable leaf inside the active topic (the 5th level): its id lives in the
  // URL after `<id>/<topic>`, and selecting one re-routes there. A master/detail topic
  // threads this through `useMasterDetailForm({ urlSelection })`; others ignore it.
  const leaf: TopicLeaf = {
    leafId: activeLeafId ?? null,
    onSelect: (leafId) => {
      if (!scopedId || !topic) return;
      router.push(
        leafId
          ? `${basePath}/${scopedId}/${topic}/${leafId}`
          : `${basePath}/${scopedId}/${topic}`,
        { scroll: false },
      );
    },
  };

  // One level deeper: for a GROUPING topic, the open member (the leaf) is itself a rail, so its own
  // inner entity rides a 5th segment (…/<topic>/<member>/<entity>). This builds that entity leaf for
  // a given member, so a grouped persona / bucket / user deep-links exactly like its standalone route.
  const subLeafFor = (memberId: string): TopicLeaf => ({
    leafId: activeMemberEntityId ?? null,
    onSelect: (entityId) => {
      if (!scopedId || !topic) return;
      router.push(
        entityId
          ? `${basePath}/${scopedId}/${topic}/${memberId}/${entityId}`
          : `${basePath}/${scopedId}/${topic}/${memberId}`,
        { scroll: false },
      );
    },
  });

  // `children` land in the frontier pane: the "All" card landing while nothing is selected, a
  // "pick a topic" placeholder once an entity is selected but no topic is, else the topic's pane
  // (keyed by scopedId so a resource switch remounts it).
  const content =
    promoteTopics && !scopedId ? (
      // Default resource still resolving (or the tenant has none): hold the frontier.
      <EmptyState title="Loading…" />
    ) : isAll && landing ? (
      <ResourceLanding
        items={items}
        title={landing.title}
        help={landing.help}
        emptyLabel={landing.emptyLabel}
        basePath={basePath}
        getId={getId}
        getLabel={getLabel}
        getSublabel={landing.getSublabel}
        cardHref={(item) => `${basePath}/${getId(item)}`}
        renderMeta={landing.renderMeta}
      />
    ) : topic == null ? (
      <EmptyState title="Select a topic to view." />
    ) : (
      <Fragment key={scopedId}>
        {topics.find((t) => t.id === topic)?.render(scopedId, titleFor, leaf, subLeafFor)}
      </Fragment>
    );

  const dialog =
    newOpen &&
    renderDialog?.(
      () => setNewOpen(false),
      (id) => {
        setNewOpen(false);
        router.push(`${basePath}/${id}`, { scroll: false });
      },
    );

  // Inside the host: publish the levels and render the leaf content as its detail — the host owns
  // the one merged HTD. StackLevels advances the depth so a deeper view (a group member, a
  // master/detail list) lands after these. Standalone: become our OWN host (StandaloneRailHost)
  // and publish through the SAME StackLevels path, so a topic pane's publishers — the master/detail
  // list level AND, crucially, its leaf editor's unsaved-work guard — reach the HTD exactly as they
  // do in the hub shell (without a host they silently no-op and edits are discarded unprompted).
  const published = (
    <>
      <StackLevels levels={levels}>{content}</StackLevels>
      {dialog}
    </>
  );
  if (chrome) return published;
  return <StandaloneRailHost>{published}</StandaloneRailHost>;
}

/**
 * The standalone rail host: when ResourceExplorer renders OUTSIDE a host (a feature site's /home),
 * it provides its OWN {@link RailHostContext} so the topic panes' publishers work exactly as they
 * do inside the hub shell — the master/detail lists register as deeper rail levels, and the leaf
 * editor's unsaved-work guard flows into the one HTD's exit gate (so Back / breadcrumb-up / re-click
 * prompts Save/Discard/Cancel instead of silently discarding). Mirrors the hub's
 * WorkspaceChromeProvider semantics (local registry + composite guard + depth-merged stack), trimmed
 * to the standalone case: no toolbar slot, no shell workspace/feature levels, no breadcrumb.
 */
function StandaloneRailHost({ children }: { children: ReactNode }): ReactElement {
  const [registry, setRegistry] = useState<ReadonlyMap<string, RegisteredLevels>>(new Map());
  const [guards, setGuards] = useState<ReadonlyMap<string, PaneExitGuard>>(new Map());

  const registerLevels = useCallback((id: string, entry: RegisteredLevels) => {
    setRegistry((prev) => {
      const next = new Map(prev);
      next.set(id, entry);
      return next;
    });
  }, []);
  const unregisterLevels = useCallback((id: string) => {
    setRegistry((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);
  // Register/replace or (guard === null) withdraw one publisher's guard — the withdraw path is how a
  // guard clears when its editor unmounts (useRailExitGuard's cleanup), mirroring the hub host.
  const registerExitGuard = useCallback((id: string, guard: PaneExitGuard | null) => {
    setGuards((prev) => {
      if (guard === null && !prev.has(id)) return prev;
      const next = new Map(prev);
      if (guard === null) next.delete(id);
      else next.set(id, guard);
      return next;
    });
  }, []);

  // The one guard the HTD consults: dirty when ANY publisher is dirty; save() persists every dirty
  // publisher (all must succeed before the gated navigation proceeds).
  const exitGuard = useMemo<PaneExitGuard | null>(() => {
    if (guards.size === 0) return null;
    const all = [...guards.values()];
    return {
      isDirty: () => all.some((g) => g.isDirty()),
      save: async () => {
        for (const g of all) {
          if (g.isDirty() && !(await g.save())) return false;
        }
        return true;
      },
    };
  }, [guards]);

  const mergedLevels = useMemo(
    () => [...registry.values()].sort((a, b) => a.depth - b.depth).flatMap((e) => e.levels),
    [registry],
  );

  const host = useMemo<RailHostRegistry>(
    () => ({ registerLevels, unregisterLevels, registerExitGuard, toolbarSlot: null }),
    [registerLevels, unregisterLevels, registerExitGuard],
  );

  return (
    <RailHostContext.Provider value={host}>
      <HierarchicalTopicDetail levels={mergedLevels} showBreadcrumb={false} exitGuard={exitGuard}>
        {children}
      </HierarchicalTopicDetail>
    </RailHostContext.Provider>
  );
}
