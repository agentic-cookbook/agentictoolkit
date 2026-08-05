"use client";

import { useCallback, type ReactElement, type ReactNode } from "react";
import { FolderKanban, ListTodo, Activity, KeyRound } from "lucide-react";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import { projectsApi } from "@agentic-toolkit/data/projects";
import { useResourceList } from "@agentic-toolkit/data";
import { ResourceExplorer, CreateResourceDialog, type ResourceTopic } from "@agentic-toolkit/resource";
import { ItemAccessPanel, workspaceSubjectsDirectory } from "@agentic-toolkit/teams";
import { ProjectOverviewPane } from "./ProjectOverviewPane";
import { WorkItemsSurface } from "./WorkItemsSurface";
import { ProjectActivityPane } from "./ProjectActivityPane";
import { type BadgeVariant } from "./helpers";

/**
 * The Projects feature workspace (FTD model, mirroring TeamsTab): a project rail
 * + the "All" landing, then the topics scoped to the selected project. New lives
 * in the resource rail's leading slot; Delete arrives with the full Overview pane
 * (T3). Shared selection/URL wiring lives in ResourceExplorer; this file supplies the
 * project-specific topics, landing, and create dialog. Rendered by the hub's
 * /[slug]/projects/[[...path]] route and by the projects site's workspace route
 * (app/[workspace]/[[...path]]), where @agentic-toolkit/adh/home's SiteHomeShell picks
 * the workspace and mounts this at /<slug> — the site's SiteHomeModel declares
 * `basePath: ""`, so the workspace IS its first path segment. (A site whose model names a
 * prefix mounts its own feature under that prefix instead; the base is the model's to
 * choose, not this file's to assume.) Either way the workspace arrives as a prop — this
 * feature does not know that a workspace can live in a URL.
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
  renderTransferOwnership,
}: {
  /** The feature's URL base (drives the routes + the list cache key), WORKSPACE INCLUDED: the
   *  hub passes `/<slug>/projects`; a feature site passes whatever SiteHomeShell built from its
   *  model's `basePath` — `/<slug>` on the projects site, whose base is empty. Supplied by the host
   *  route rather than derived here, so the same feature mounts under either scheme — and so
   *  switching workspace can never show the previous one's projects, since the workspace is
   *  part of the cache key. */
  basePath: string;
  all?: boolean;
  activeProjectId?: string;
  activeTopic?: string;
  activeLeafId?: string;
  /** Pins list/create to the WORKSPACE'S owning principal (backend `?workspace=`), so an org
   *  workspace shows the ORG'S projects and creates org-owned ones. Omitted: the caller's
   *  ownership reach (owned + participating). Choosing the workspace is the HOST's job —
   *  the hub's route segment, or @agentic-toolkit/adh/home's SiteHomeShell. */
  workspaceSlug?: string;
  /** Host-injected Transfer Ownership section for the OPEN project, forwarded to the Overview
   *  topic's pane (see {@link ProjectOverviewPane}'s own prop for what it is handed). Omit it and
   *  the pane renders no section — the host, not this feature, owns the workspace list and the
   *  mutation. */
  renderTransferOwnership?: (project: { id: string; name: string }) => ReactNode;
}): ReactElement {
  const loadProjects = useCallback(
    () => projectsApi.list({ workspace: workspaceSlug }),
    [workspaceSlug],
  );
  const { items: projects, reload } = useResourceList(basePath, loadProjects);

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
          <ProjectOverviewPane
            projectId={projectId}
            title={titleFor("Overview")}
            renderTransferOwnership={renderTransferOwnership}
          />
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
    {
      id: "access",
      label: "Access",
      icon: <KeyRound size={16} aria-hidden />,
      // The per-item share panel (docs/workspace-roles-permissions.md): restriction
      // mode + item-scoped role assignments + the effective-permission explainer.
      // Needs the owning workspace — the host always supplies it under /home and
      // under the hub's /<slug>/projects, so both are defined here.
      render: (projectId, titleFor) =>
        projectId && workspaceSlug ? (
          <ItemAccessPanel
            workspaceSlug={workspaceSlug}
            feature="projects"
            itemId={projectId}
            itemLabel={(projects ?? []).find((p) => p.id === projectId)?.name}
            title={titleFor("Access")}
            subjectsDirectory={workspaceSubjectsDirectory}
          />
        ) : null,
    },
  ];

  return (
    <ResourceExplorer
      all={all}
      activeId={activeProjectId}
      activeTopic={activeTopic}
      activeLeafId={activeLeafId}
      basePath={basePath}
      items={projects}
      reload={reload}
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
              { workspace: workspaceSlug },
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
