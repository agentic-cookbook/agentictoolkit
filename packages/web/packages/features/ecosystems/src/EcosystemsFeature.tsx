"use client";

import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Settings, Table2, Users, KeyRound, Network, Boxes, Plus, Inbox, Send, Database } from "lucide-react";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Checkbox } from "@agentic-toolkit/ui/components/checkbox";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import {
  ResourceExplorer,
  ResourceLanding,
  CreateResourceDialog,
  StackGroupDetail,
  useStackLevel,
  type ResourceTopic,
  type TopicLeaf,
  type GroupTopicItem,
} from "@agentic-toolkit/resource";
import { useResourceList, makeEntityDeleteHandler, writeLastId } from "@agentic-toolkit/data";
import { ecosystemsApi, type Ecosystem } from "@agentic-toolkit/data/ecosystems";
import { EcosystemSettingsPane } from "./EcosystemSettingsPane";
import { EcosystemDetail, ecoBlank, ecoValidate, ecoNormalize } from "./EcosystemDetail";
import { EcoRequestsPane, EcoPendingUsersPane, EcoInvitesPane } from "./EcosystemInvitationPanes";
import { useEcosystemCapabilities } from "./use-ecosystem-capabilities";

/** The host's ecosystem-scoped topic rail config (the hub's `ECOSYSTEM_TOPICS` SSoT),
 *  with the icon already resolved by the host from its own icon registry (FEATURE_META
 *  for the workspace-feature topics, a host-local icon map for the rest) — the package
 *  never needs to know where an icon comes from, only how to render it. */
export interface EcosystemsTopicConfig {
  id: string;
  label: string;
  icon: ReactNode;
  dividerAfter?: boolean;
  /** An opt-in capability id — the topic is hidden unless the scoped ecosystem has it
   *  enabled (see useEcosystemCapabilities). Omitted topics always show. */
  capability?: string;
}

/** What `renderTopicPane` needs to reconstruct a host-owned config pane's exact call
 *  (mirrors the hub's Applications/Integrations/Schemas/Access/Users panes' shared
 *  `{ ecosystemId, title, help, leaf }` shape, minus `help` — the host's own renderer
 *  closure already has `helpFor` in scope, so it resolves its own help key per pane). */
export interface RenderTopicPaneCtx {
  ecosystemId?: string;
  title?: ReactNode;
  leaf?: TopicLeaf;
}

/**
 * The topic rows for the two topics this package renders ENTIRELY in-package (the entity
 * Settings pane and the Child Ecosystems rail). The package is the SSoT for what it renders:
 * a host composing only these (a feature-site mount) spreads them instead of hand-copying
 * ids/labels/icons that would silently drift; the hub builds its fuller rail from its own
 * ECOSYSTEM_TOPICS catalog, where these two ids appear with the same meaning.
 */
export const IN_PACKAGE_TOPICS: EcosystemsTopicConfig[] = [
  { id: "settings", label: "Settings", icon: <Settings size={16} aria-hidden />, dividerAfter: false },
  {
    id: "child-ecosystems",
    label: "Child Ecosystems",
    icon: <Boxes size={16} aria-hidden />,
    dividerAfter: false,
  },
];

export interface EcosystemsFeatureProps {
  basePath: string;
  /** The workspace slug whose (primary) ecosystem the feature opens on when the URL names
   *  none — the hub passes its route slug. Like basePath, supplied by the host rather than
   *  read from useParams here, so a host without a [slug] route (a feature site) fails
   *  visibly at the prop seam instead of silently deriving undefined. Absent ⇒ default-
   *  ecosystem resolution is disabled (the platform-wide ecosystem-scoping decision for
   *  site mounts — feature-platform-phase2 §2 — is still open) and a bare path renders the
   *  ecosystem card landing instead; deep-linked /<ecoId> paths never consult it. */
  workspaceSlug?: string;
  /** The ecosystem-scoped topic rail (host SSoT: settings/topics.ts's ECOSYSTEM_TOPICS). */
  topics: EcosystemsTopicConfig[];
  /** Render a non-ecosystems workspace feature's own content for a topic/group-member this
   *  feature reuses verbatim (Communities / Messaging / Research / Dashboards / All Data) —
   *  the host's `renderFeaturePanel` from feature-panels.tsx. */
  renderFeaturePanel?: (feature: string, opts?: { subLeaf?: TopicLeaf }) => ReactNode;
  /** Render a host-owned settings pane this feature composes but doesn't own: the topic ids
   *  "applications" | "integrations", and the group-member ids "buckets" | "access" | "users". */
  renderTopicPane?: (topicId: string, ctx: RenderTopicPaneCtx) => ReactNode;
  /** Contextual help lookup (the hub's helpFor), keyed `ecosystems/<topic>`. Only consulted for
   *  this feature's OWN pane (Settings) — renderTopicPane resolves help for host-owned panes
   *  itself. Omit to render no help. */
  helpFor?: (key: string) => string | undefined;
  activeTopic?: string;
  activeEcoId?: string;
  activeLeafId?: string;
  /** The 5th URL segment: the deep-linkable inner entity of an open GROUP member. */
  activeMemberEntityId?: string;
}

/** The topic groups whose detail pane is a nested topic→detail sub-rail — the single source for
 *  both the membership check and the per-group members map below. */
const GROUP_IDS = ["storage", "invitations"] as const;
type GroupId = (typeof GROUP_IDS)[number];
const isGroupId = (id: string): id is GroupId => (GROUP_IDS as readonly string[]).includes(id);

/**
 * The Child Ecosystems topic as a hierarchical topic-detail RAIL published into the merged stack
 * (like every sibling topic), not a card landing: the ecosystems this one owns are the rows, the
 * header `+` opens the New Ecosystem dialog, and selecting a child RE-SCOPES the whole Ecosystem
 * rail to it (its topics take column 3) — the same navigation the old cards did via `cardHref`.
 * Nothing is "selected within" this list (a pick drills out to the child), so `selectedId` is null.
 */
function ChildEcosystemsLevel({
  items,
  basePath,
  onNew,
}: {
  items: Ecosystem[] | null;
  basePath: string;
  onNew: () => void;
}): ReactElement {
  const router = useRouter();
  useStackLevel({
    id: "child-ecosystems-list",
    title: "Child Ecosystems",
    items: (items ?? []).map((e) => ({
      id: e.id,
      label: e.name,
      sublabel: e.identifier,
      icon: <Boxes size={16} aria-hidden />,
    })),
    selectedId: null,
    onSelect: (id) => router.push(`${basePath}/${id}`, { scroll: false }),
    onClear: () => {},
    onNew,
    newLabel: "New Ecosystem",
    emptyLabel: items === null ? "Loading…" : "No child ecosystems yet.",
  });
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <EmptyState title="Select a child ecosystem to open it, or create a new one." />
    </div>
  );
}

// The members of each grouping topic, as nested topic→detail sub-rails. Ecosystem-scoped
// config panes (Buckets/Access/Users) take the selected ecosystem id + a scoped title, via
// the host-injected renderTopicPane; the feature members (All Data) reuse the feature's own
// content via renderFeaturePanel. `titleFor` scopes the pane title to the ecosystem.
function groupMembers(
  ecoId: string | undefined,
  titleFor: (label: string) => string,
  renderTopicPane: (topicId: string, ctx: RenderTopicPaneCtx) => ReactNode,
  renderFeaturePanel: (feature: string, opts?: { subLeaf?: TopicLeaf }) => ReactNode,
): Record<GroupId, GroupTopicItem[]> {
  // Each member render receives a `subLeaf` — the deep-linkable inner-entity selection ceded by the
  // group (the URL segment AFTER this member). Host-owned config panes take it as their `leaf`;
  // the feature panels take it (via renderFeaturePanel) as their `urlSelection`; members with no
  // inner URL-selection (All Data / Requests / Pending users / Invites) ignore it.
  return {
    storage: [
      { id: "buckets", label: "Buckets", icon: <Table2 size={16} aria-hidden />,
        render: (subLeaf) => renderTopicPane("buckets", { ecosystemId: ecoId, title: titleFor("Buckets"), leaf: subLeaf }) },
      { id: "access", label: "Access", icon: <KeyRound size={16} aria-hidden />,
        render: (subLeaf) => renderTopicPane("access", { ecosystemId: ecoId, title: titleFor("Access"), leaf: subLeaf }) },
      { id: "all-data", label: "All Data", icon: <Database size={16} aria-hidden />,
        render: () => renderFeaturePanel("all-data") },
    ],
    // Users (topic id "invitations", kept for deep-link stability): the ecosystem's people —
    // the Users master/detail (host-owned) followed by Requests / Pending users / Invites, each a
    // prop-driven shared pane wired to the ecosystem-scoped /auth/ecosystems/<rdid>/* routes. A
    // group only renders once an ecosystem is selected, but guard `ecoId` rather than asserting it
    // (`ecoId!`): the Users config pane accepts `undefined` and degrades gracefully, whereas the
    // invitation panes require a string and would otherwise build a GET
    // /auth/ecosystems/undefined/... → 404 "Failed to load".
    invitations: [
      { id: "users", label: "Users", icon: <Users size={16} aria-hidden />,
        render: (subLeaf) => renderTopicPane("users", { ecosystemId: ecoId, title: titleFor("Users"), leaf: subLeaf }) },
      { id: "requests", label: "Requests", icon: <Inbox size={16} aria-hidden />,
        render: () => (ecoId ? <EcoRequestsPane ecosystemRdid={ecoId} /> : null) },
      { id: "pending-users", label: "Pending users", icon: <Users size={16} aria-hidden />,
        render: () => (ecoId ? <EcoPendingUsersPane ecosystemRdid={ecoId} /> : null) },
      { id: "invites", label: "Invites", icon: <Send size={16} aria-hidden />,
        render: () => (ecoId ? <EcoInvitesPane ecosystemRdid={ecoId} /> : null) },
    ],
  };
}

/**
 * The Ecosystems feature. It opens on the workspace's DEFAULT (primary) ecosystem and shows
 * ITS topics as the first rail (Settings / Storage / AI / … / Child Ecosystems) — the ecosystem
 * list is not a top-level rail; it lives inside the Child Ecosystems topic, which drills into
 * a child by re-scoping the whole rail to it. All the selection/fallback/default-topic wiring
 * lives in ResourceExplorer (`promoteTopics`).
 *
 * Host-composed: `topics`, `renderFeaturePanel`, `renderTopicPane`, and `helpFor` are supplied
 * by the host (the hub route + its EcosystemsTab shim) from its own registries — see each prop's
 * doc comment. This lets a host reuse its existing feature panels + config panes unchanged while
 * this package owns the ecosystem selection/scoping/create/delete orchestration.
 */
export function EcosystemsFeature({
  basePath,
  workspaceSlug,
  topics: topicsConfig,
  // A minimal host (a feature-site mount whose topics are only the in-package rows)
  // injects neither renderer; the no-op defaults keep those topic ids unrenderable
  // rather than crashing, exactly like a host passing explicit stubs.
  renderFeaturePanel = () => null,
  renderTopicPane = () => null,
  helpFor,
  activeTopic,
  activeEcoId,
  activeLeafId,
  activeMemberEntityId,
}: EcosystemsFeatureProps): ReactElement {
  const router = useRouter();
  // Feature links are workspace-relative: <basePath>/... The host-supplied slug stays
  // constant while navigating within this workspace (so the FTD cache/last-id keys stay
  // stable and don't re-flash), and switching workspaces re-scopes the whole rail.
  const slug = workspaceSlug;
  const { items: ecosystems, reload, error } = useResourceList(
    basePath,
    ecosystemsApi.list,
  );

  // Ecosystems opens on the workspace's DEFAULT (primary) ecosystem when the URL names none —
  // its topics, not a list. Resolve that id from the workspace slug (the same resolver the
  // standalone /messaging route uses); react-query dedupes concurrent readers.
  const defaultIdQuery = useQuery({
    queryKey: ["ecosystem-id-for-slug", slug],
    // enabled gates on slug != null, so the assertion can't be reached with undefined.
    queryFn: () => ecosystemsApi.ecosystemIdForSlug(slug as string),
    enabled: slug != null && activeEcoId == null,
    retry: false,
  });
  const defaultId = defaultIdQuery.data ?? undefined;
  // The scoped ecosystem: the URL id, else the resolved workspace default.
  const scopedId = activeEcoId ?? defaultId ?? undefined;

  // The scoped ecosystem's row may be a hidden default — `list()` omits isDefault ecosystems, so
  // the id the feature opens on (via the isDefault fallback) can be absent from `ecosystems`. Fetch
  // it directly ONLY when it's missing, and merge it in; otherwise EcosystemSettingsPane can't bind
  // (Settings shows its empty state), the Delete section vanishes, and the topic titles lose the
  // ecosystem name. Existing deep-links whose id IS in the list skip this fetch entirely.
  const scopedMissing =
    scopedId != null && ecosystems !== null && !ecosystems.some((e) => e.id === scopedId);
  const scopedEcoQuery = useQuery({
    queryKey: ["ecosystem", scopedId],
    queryFn: () => ecosystemsApi.get(scopedId as string),
    enabled: scopedMissing,
    retry: false,
  });
  const scopedEco = scopedEcoQuery.data ?? null;
  // Items for scoping/binding/title (topics rail + Settings pane): the list plus the scoped default
  // when list() hid it. The Child Ecosystems list keeps using the raw `ecosystems`, so the default
  // the feature is scoped to stays OUT of its own child list.
  const scopedItems =
    scopedMissing && scopedEco ? [...(ecosystems ?? []), scopedEco] : ecosystems;

  // The CHILD ecosystems of the scoped ecosystem — fetched server-scoped to owner_id = scopedId
  // (the ecosystems in the namespace it owns), NOT the caller's whole manageable set. This is what
  // the Child Ecosystems topic lists; it re-fetches when the rail re-scopes to a different ecosystem.
  const childrenQuery = useQuery({
    queryKey: ["ecosystem-children", scopedId],
    queryFn: () => ecosystemsApi.listChildren(scopedId as string),
    enabled: scopedId != null,
    retry: false,
  });
  const children = childrenQuery.data ?? null;

  // A deep-link to an ecosystem id that no longer exists (deleted row, stale bookmark/shared link):
  // bounce to the bare feature path, which re-resolves to the workspace default. Only on a CONFIRMED
  // 404 — `get` rethrows transient errors, so the query settling with `null` means "does not exist",
  // never "a request blipped". Guarded on `activeEcoId` so the default's own resolution never loops.
  const scopedDeleted =
    activeEcoId != null &&
    scopedMissing &&
    scopedEcoQuery.isSuccess &&
    scopedEcoQuery.data === null;
  useEffect(() => {
    if (scopedDeleted) router.replace(basePath, { scroll: false });
  }, [scopedDeleted, router, basePath]);

  // A tenant with genuinely NO ecosystems — not even a hidden default (the resolver settled with no
  // id AND the list loaded empty). Offer a first-run create instead of a perpetual "Loading…".
  const noEcosystems =
    activeEcoId == null &&
    defaultIdQuery.isSuccess &&
    defaultId == null &&
    ecosystems !== null &&
    ecosystems.length === 0;

  // "New Ecosystem" lives on the Child Ecosystems list (there is no top-level resource rail now),
  // so this feature owns the create dialog rather than ResourceExplorer's promoted resource level.
  const [newOpen, setNewOpen] = useState(false);
  // Opt-in escape hatch: create a TOP-LEVEL ecosystem (owner = the caller/principal) instead of a
  // child of the scoped one. Lives outside the create draft so toggling it never marks the form
  // dirty; reset every time the dialog opens so the default (child-of-scoped) is never sticky.
  const [createTopLevel, setCreateTopLevel] = useState(false);

  // The ONE way the create dialog opens — the explicit flag makes each site's intent
  // (top-level vs child-of-scoped) true by construction instead of relying on scopedId
  // happening to be undefined on some paths (the drift a review round caught).
  const openCreateDialog = (topLevel: boolean) => {
    setCreateTopLevel(topLevel);
    setNewOpen(true);
  };

  // Opt-in capability gate: hide capability-marked topics (e.g. Messaging) unless the
  // SCOPED ecosystem has enabled them (default off). Non-gated topics always show.
  const { capabilities } = useEcosystemCapabilities(scopedId, workspaceSlug);
  const visibleTopics = topicsConfig.filter(
    (t) => t.capability == null || capabilities.includes(t.capability),
  );

  const topics: ResourceTopic[] = visibleTopics.map((t) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
    dividerAfter: t.dividerAfter,
    render: (ecoId, titleFor, leaf, subLeafFor) => {
      if (t.id === "settings") {
        return (
          <EcosystemSettingsPane
            ecosystemId={ecoId}
            items={scopedItems}
            refresh={reload}
            loadError={error}
            title={titleFor(t.label)}
            help={helpFor?.(`ecosystems/${t.id}`)}
            onDelete={
              ecoId
                ? makeEntityDeleteHandler({
                    basePath,
                    id: ecoId,
                    router,
                    del: ecosystemsApi.delete,
                    reload,
                  })
                : undefined
            }
            onRenamed={async (newId) => {
              // Point the resume key at the new rdid up front, so it never lingers
              // on the old (now-freed) id during the navigation that follows.
              writeLastId(basePath, newId);
              await reload();
              router.replace(
                `${basePath}/${newId}/${topicsConfig[0]?.id}`,
                { scroll: false },
              );
            }}
          />
        );
      }
      if (t.id === "applications" || t.id === "integrations") {
        // Top-level (non-grouped) host-owned config topics: thread the URL leaf so a
        // selected entity deep-links (/ecosystems/<id>/<topic>/<entityId>).
        return renderTopicPane(t.id, { ecosystemId: ecoId, title: titleFor(t.label), leaf });
      }
      if (t.id === "child-ecosystems") {
        // The ecosystems THIS one owns — `children` is server-scoped to owner_id = the scoped
        // ecosystem (its child namespace), so it shows only genuine children, not the tenant-wide
        // set. Published as a topic-detail rail (not a card landing): selecting a child re-scopes the
        // whole Ecosystem rail to it; the header "+" creates a child of the current ecosystem.
        return (
          <ChildEcosystemsLevel
            items={children}
            basePath={basePath}
            onNew={() => openCreateDialog(false)}
          />
        );
      }
      // Storage / Users are grouping topics → a nested topic→detail sub-rail of their members;
      // keyed by group id so switching groups resets the sub-selection. The chosen member
      // (Buckets / Access / …) is URL-driven + deep-linkable: it rides the leaf segment
      // (…/ecosystems/<id>/<group>/<member>) via the L1 group's urlSelection, exactly as the
      // top-level applications/integrations topics thread their leaf. `renderSubLeaf` cedes the NEXT
      // segment to the open member, so the member's inner entity (a bucket, a user) is itself
      // deep-linkable (…/ecosystems/<id>/<group>/<member>/<entity>).
      if (isGroupId(t.id)) {
        return (
          <StackGroupDetail
            key={t.id}
            levelId={`ecosystem-${t.id}`}
            title={t.label}
            items={groupMembers(ecoId, titleFor, renderTopicPane, renderFeaturePanel)[t.id]}
            urlSelection={{ selectedId: leaf.leafId, onSelect: leaf.onSelect }}
            renderSubLeaf={subLeafFor}
          />
        );
      }
      // The rest (Communities / Messaging / Research / Dashboards) reuse the feature's own content.
      return renderFeaturePanel(t.id);
    },
  }));

  // The create dialog is owned here (not by ResourceExplorer's promoted level) and shared by both
  // the Child Ecosystems "New Ecosystem" affordance and the first-run empty state below.
  const createDialog = newOpen && (
    <CreateResourceDialog
      ariaLabel="New ecosystem"
      heading="New ecosystem"
      blank={ecoBlank}
      validate={(d) => ecoValidate(d, (ecosystems ?? []).map((e) => e.identifier))}
      // Parent = the scoped ecosystem, so "New Ecosystem" from Child Ecosystems creates a CHILD of
      // it (owner = it) by default. The "top-level" toggle (below) opts out → a parentless ecosystem
      // owned by the caller. On first-run (no scoped ecosystem) `scopedId` is undefined → always a
      // top-level create, and the toggle is hidden (there is no parent to opt out of).
      create={(d) =>
        ecosystemsApi.create(ecoNormalize(d), createTopLevel ? undefined : scopedId)
      }
      onClose={() => setNewOpen(false)}
      onCreated={(eco) => {
        setNewOpen(false);
        // Re-scope the rail to the created ecosystem (its topics take column 3).
        router.push(`${basePath}/${eco.id}`, { scroll: false });
      }}
      renderForm={(draft, onChange, error) => (
        <>
          <EcosystemDetail draft={draft} onChange={onChange} error={error} />
          {scopedId != null && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="new-eco-toplevel"
                checked={createTopLevel}
                onCheckedChange={(v) => setCreateTopLevel(v === true)}
              />
              <label
                htmlFor="new-eco-toplevel"
                className="min-w-0 flex-1 text-sm text-apt-text-muted"
              >
                Create as a top-level ecosystem (owned by you), not a child of the current one
              </label>
            </div>
          )}
        </>
      )}
    />
  );

  // A slugged host whose ONE default-resolution request failed (retry: false): without a
  // defined surface the promoted rail holds "Loading…" forever with dead topic clicks. A
  // reload retries the lookup; deep-linked /<ecoId> paths never hit this (slug unused).
  if (workspaceSlug != null && activeEcoId == null && defaultIdQuery.isError) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <EmptyState
          title="Couldn't load this workspace"
          description="The workspace's default ecosystem didn't resolve — reload the page to retry."
        />
      </div>
    );
  }

  // A slug-less host (a feature-site mount): default resolution is disabled (§2), so a bare
  // path renders a DEFINED unscoped state — the ecosystem card landing — never
  // ResourceExplorer's promoted "Loading…" hold. Cards route to <basePath>/<id>, the
  // slug-independent deep-link path; New creates top-level (scopedId is undefined here).
  // list() hides a hidden default ecosystem, so a tenant whose only ecosystem is that
  // default sees the empty label — accepted until §2 decides site-mount scoping.
  if (workspaceSlug == null && activeEcoId == null) {
    if (error != null && ecosystems == null) {
      // The list failed before anything arrived: a bare landing would sit on "Loading…"
      // forever — the exact dead surface this unscoped state exists to prevent.
      return (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <EmptyState title="Couldn't load ecosystems" description={error} />
        </div>
      );
    }
    return (
      <>
        <ResourceLanding
          items={ecosystems}
          title="Ecosystems"
          help="Open an ecosystem to manage its settings and child ecosystems."
          emptyLabel="No ecosystems yet."
          basePath={basePath}
          getId={(e) => e.id}
          getLabel={(e) => e.name}
          getSublabel={(e) => e.identifier}
          cardHref={(e) => `${basePath}/${e.id}`}
          renderMeta={() => null}
          onNew={() => openCreateDialog(true)}
          newLabel="New Ecosystem"
        />
        {createDialog}
      </>
    );
  }

  // First run: no ecosystems at all. Offer a create instead of ResourceExplorer's perpetual "Loading…".
  if (noEcosystems) {
    return (
      <>
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <EmptyState
            title="No ecosystems yet"
            description="Create your first ecosystem to get started."
            action={
              <Button variant="outline" size="sm" onClick={() => openCreateDialog(true)}>
                <Plus size={16} aria-hidden />
                New Ecosystem
              </Button>
            }
          />
        </div>
        {createDialog}
      </>
    );
  }

  return (
    <>
      <ResourceExplorer
        promoteTopics
        defaultId={defaultId ?? undefined}
        activeId={activeEcoId}
        activeTopic={activeTopic}
        activeLeafId={activeLeafId}
        activeMemberEntityId={activeMemberEntityId}
        basePath={basePath}
        items={scopedItems}
        getId={(e) => e.id}
        getLabel={(e) => e.name}
        nameSuffix="Ecosystem"
        itemIcon={<Network size={16} aria-hidden />}
        topics={topics}
        newLabel="New Ecosystem…"
      />
      {createDialog}
    </>
  );
}
