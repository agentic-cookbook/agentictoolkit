"use client";

import { useCallback, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, ListTodo, Activity, Building2, User } from "lucide-react";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import { projectsApi, type Project } from "@agentic-toolkit/data/projects";
import { useResourceList, workspacesApi } from "@agentic-toolkit/data";
import type { TopicLevel } from "@agentic-toolkit/ui/blocks";
import { ResourceExplorer, CreateResourceDialog, type ResourceTopic } from "@agentic-toolkit/resource";
import { ProjectOverviewPane } from "./ProjectOverviewPane";
import { WorkItemsSurface } from "./WorkItemsSurface";
import { ProjectActivityPane } from "./ProjectActivityPane";
import { type BadgeVariant } from "./helpers";

/**
 * The Projects feature workspace (FTD model, mirroring TeamsTab): a project rail
 * + the "All" landing, then the topics scoped to the selected project. New lives
 * in the resource rail's leading slot; Delete arrives with the full Overview pane
 * (T3). Shared selection/URL wiring lives in ResourceExplorer; this file supplies the
 * project-specific topics, landing, and create dialog. Rendered by the
 * /[slug]/projects/[[...path]] route and the /home workspace launcher.
 *
 * Overview is the full ProjectOverviewPane (settings + participants, T3); Work
 * Items hosts the five interchangeable views (List / Board / Table / Timeline /
 * Calendar) via WorkItemsSurface (4e); Activity is the audit trail.
 */

/* ── Status badge ─────────────────────────────────────────────────────────
 * `status` is a free-form varchar (DB default 'active'), so map the known
 * lifecycle values to a Badge tone and fall back to neutral for anything else. */
function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case "active":
      return "success";
    case "paused":
    case "on_hold":
      return "orange";
    case "completed":
      return "blue";
    default:
      return "neutral";
  }
}

function StatusBadge({ status }: { status: string }): ReactElement {
  return <Badge variant={statusVariant(status)}>{status}</Badge>;
}

/* ── Create-project form ──────────────────────────────────────────────────── */

interface ProjectInput {
  name: string;
  description: string;
}

function projectBlank(): ProjectInput {
  return { name: "", description: "" };
}

function projectValidate(draft: ProjectInput): string | null {
  if (!draft.name.trim()) return "Name is required.";
  return null;
}

/** Controlled create-project fields — no button bar (the dialog owns Save/Cancel). */
function ProjectForm({
  draft,
  onChange,
  error,
}: {
  draft: ProjectInput;
  onChange: (next: ProjectInput) => void;
  error?: string | null;
}): ReactElement {
  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-project-name">Name</Label>
          <Input
            id="new-project-name"
            placeholder="Website relaunch"
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-project-description">Description</Label>
          <Textarea
            id="new-project-description"
            placeholder="What is this project about? (optional)"
            value={draft.description}
            onChange={(e) => onChange({ ...draft, description: e.target.value })}
            rows={3}
          />
        </div>
        <ErrorText error={error} />
      </CardContent>
    </Card>
  );
}

/* ── Feature ──────────────────────────────────────────────────────────────── */

export function ProjectsFeature({
  basePath,
  all,
  activeProjectId,
  activeTopic,
  activeLeafId,
  workspaceSlug,
  showWorkspaces = false,
}: {
  /** The feature's URL base (drives the routes + the list cache key): the hub passes
   *  `/<slug>/projects`, the projects site passes `/home`. Supplied by the host route
   *  rather than derived here, so the same feature mounts under either scheme. */
  basePath: string;
  all?: boolean;
  activeProjectId?: string;
  activeTopic?: string;
  activeLeafId?: string;
  /** Pins list/create to the WORKSPACE'S owning principal (backend `?workspace=`),
   *  so an org workspace shows the ORG'S projects and creates org-owned ones.
   *  Omitted: the caller's ownership reach (owned + participating). */
  workspaceSlug?: string;
  /** Lead the stack with a WORKSPACES list (the caller's personal workspace + their orgs), which
   *  scopes the project list under it. This is how a feature SITE gets the scope the hub gets from
   *  its `/<slug>/…` route: there the workspace is a path segment and the shell already renders the
   *  rail, so the hub leaves this false and passes `workspaceSlug` straight from the URL. With it
   *  on, the workspace is the FIRST segment under `basePath` (`/home/<slug>/<project>/<topic>`). */
  showWorkspaces?: boolean;
}): ReactElement {
  const router = useRouter();

  // The workspaces list — only fetched by a host that shows it (the hub's shell already owns one,
  // and would otherwise pay for a list it never renders). The `load` identity is what drives the
  // fetch, so gating it here (rather than the hook call) keeps the hook order unconditional.
  const loadWorkspaces = useCallback(
    () => (showWorkspaces ? workspacesApi.list() : Promise.resolve([])),
    [showWorkspaces],
  );
  const { items: workspaces } = useResourceList(`${basePath}::workspaces`, loadWorkspaces);

  // An unknown workspace slug (a stale link, or the old `/home/all` grammar) falls back to NO
  // selection once the list has loaded — the same `knownId` rule the resource list uses — rather
  // than scoping the projects to a workspace the backend will 404. While the list is still loading
  // the slug is taken at face value, so a deep link doesn't flash the "select a workspace" hint.
  const knownWorkspace =
    workspaces === null || workspaces.some((w) => w.slug === workspaceSlug);
  const activeWorkspace = knownWorkspace ? workspaceSlug : undefined;

  // The principal every project read/write is pinned to. On a workspaces-led site that is the
  // SELECTED workspace (nothing is listed until one is chosen); on the hub it is the route's slug.
  const scopeSlug = showWorkspaces ? activeWorkspace : workspaceSlug;
  const scopePending = showWorkspaces && !scopeSlug;

  const loadProjects = useCallback(
    () => (scopePending ? Promise.resolve([] as Project[]) : projectsApi.list({ workspace: scopeSlug })),
    [scopeSlug, scopePending],
  );
  // The projects live UNDER the workspace, so the workspace is part of their URL base — and of the
  // list's cache key, so switching workspace can never show the previous one's projects.
  const projectsBase = showWorkspaces && scopeSlug ? `${basePath}/${scopeSlug}` : basePath;
  const { items: projects, reload } = useResourceList(projectsBase, loadProjects);

  const workspaceLevel: TopicLevel | null = showWorkspaces
    ? {
        id: "workspace",
        title: "Workspaces",
        items: (workspaces ?? []).map((w) => ({
          id: w.slug,
          label: w.name,
          icon:
            w.kind === "organization" ? (
              <Building2 size={16} aria-hidden />
            ) : (
              <User size={16} aria-hidden />
            ),
        })),
        selectedId: activeWorkspace ?? null,
        onSelect: (slug) => router.push(`${basePath}/${slug}`, { scroll: false }),
        onClear: () => router.push(basePath, { scroll: false }),
        emptyLabel: workspaces === null ? "Loading…" : "No workspaces.",
      }
    : null;

  // Entity-first topics (FTD): the project Overview, then Work Items (the view
  // switcher) and Activity — all real panes.
  const topics: ResourceTopic[] = [
    {
      id: "overview",
      label: "Overview",
      icon: <FolderKanban size={16} aria-hidden />,
      // ResourceExplorer only renders a topic pane once a project is selected, so
      // `projectId` is defined here; guard keeps the type honest.
      render: (projectId, titleFor) =>
        projectId ? (
          <ProjectOverviewPane projectId={projectId} title={titleFor("Overview")} />
        ) : null,
    },
    {
      id: "work-items",
      label: "Work Items",
      icon: <ListTodo size={16} aria-hidden />,
      // ResourceExplorer only renders a topic pane once a project is selected, so
      // `projectId` is defined here; guard keeps the type honest. `leaf` carries
      // the deep-linkable active view (list / board / table / timeline / calendar).
      render: (projectId, titleFor, leaf) =>
        projectId ? (
          <WorkItemsSurface
            projectId={projectId}
            title={titleFor("Work Items")}
            leaf={leaf}
          />
        ) : null,
    },
    {
      id: "activity",
      label: "Activity",
      icon: <Activity size={16} aria-hidden />,
      // ResourceExplorer only renders a topic pane once a project is selected, so
      // `projectId` is defined here; guard keeps the type honest.
      render: (projectId, titleFor) =>
        projectId ? (
          <ProjectActivityPane projectId={projectId} title={titleFor("Activity")} />
        ) : null,
    },
  ];

  return (
    <ResourceExplorer
      all={all}
      activeId={activeProjectId}
      activeTopic={activeTopic}
      activeLeafId={activeLeafId}
      basePath={projectsBase}
      items={projects}
      reload={reload}
      leadingLevels={workspaceLevel ? [workspaceLevel] : undefined}
      leadingPlaceholder={
        <EmptyState title="Select a workspace to see its projects." />
      }
      getId={(p) => p.id}
      getLabel={(p) => p.name}
      nameSuffix="Project"
      itemIcon={<FolderKanban size={16} aria-hidden />}
      topics={topics}
      newLabel="New Project…"
      landing={{
        title: "All projects",
        help: "Pick a project to view its overview, work items, and activity.",
        emptyLabel: "No projects yet.",
        getSublabel: (p) => p.status,
        renderMeta: (p) => <StatusBadge status={p.status} />,
      }}
      renderDialog={(onClose, onCreated) => (
        <CreateResourceDialog
          ariaLabel="New project"
          heading="New project"
          blank={projectBlank}
          validate={projectValidate}
          create={(d) =>
            projectsApi.create(
              {
                name: d.name.trim(),
                description: d.description.trim() || undefined,
              },
              { workspace: scopeSlug },
            )
          }
          onClose={onClose}
          onCreated={(project) => onCreated(project.id)}
          renderForm={(draft, onChange, error) => (
            <ProjectForm draft={draft} onChange={onChange} error={error} />
          )}
        />
      )}
    />
  );
}
