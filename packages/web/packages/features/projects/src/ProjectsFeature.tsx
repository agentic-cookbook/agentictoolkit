"use client";

import { useCallback, type ReactElement, type ReactNode } from "react";
import { FolderKanban } from "lucide-react";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import { projectsApi } from "@agentic-toolkit/data/projects";
import { useResourceList } from "@agentic-toolkit/data";
import { ResourceExplorer, CreateResourceDialog, type ResourceTopic } from "@agentic-toolkit/resource";
import { projectTopics } from "./projectTopics";
import { ProjectsCommandPalette } from "./ProjectsCommandPalette";
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

  // Entity-first topics (FTD), adapted from the shared declaration in projectTopics.tsx —
  // which is also what SubjectProjectPane publishes, so the two doors into a project can't
  // drift apart. All this adapter adds is the explorer's own vocabulary: the breadcrumbed
  // title, the URL-backed leaf, and the fact that a topic pane is only ever rendered with a
  // project selected (`projectId` is defined here; the guard keeps the type honest).
  const topics: ResourceTopic[] = projectTopics({ workspaceSlug }).map((topic) => ({
    ...topic,
    render: (projectId, titleFor, leaf) =>
      projectId
        ? topic.render({
            projectId,
            title: titleFor(topic.label),
            leaf,
            workspaceSlug,
            projectName: (projects ?? []).find((p) => p.id === projectId)?.name,
            renderTransferOwnership,
          })
        : null,
  }));

  return (
    <>
      {/* ⌘K. It sits beside the explorer rather than inside it because it is not part of the
          hierarchy the explorer renders — it is a transient overlay that names a thing anywhere in
          the workspace, including boards this rail is not showing. Mounted here, once per feature,
          so the shortcut works from any topic without every pane knowing about it. */}
      <ProjectsCommandPalette
        basePath={basePath}
        projects={projects}
        workspaceSlug={workspaceSlug}
        activeProjectId={activeProjectId}
        activeTopic={activeTopic}
      />
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
    </>
  );
}
