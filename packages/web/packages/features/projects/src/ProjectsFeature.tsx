"use client";

import { type ReactElement } from "react";
import { FolderKanban, ListTodo, Activity } from "lucide-react";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import { projectsApi } from "@agentic-toolkit/data/projects";
import { useResourceList } from "@agentic-toolkit/data";
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
        {error && <p className="text-sm text-apt-red">{error}</p>}
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
}: {
  /** The feature's URL base (drives the routes + the list cache key): the hub passes
   *  `/<slug>/projects`, the projects site passes `/home`. Supplied by the host route
   *  rather than derived here, so the same feature mounts under either scheme. */
  basePath: string;
  all?: boolean;
  activeProjectId?: string;
  activeTopic?: string;
  activeLeafId?: string;
}): ReactElement {
  const { items: projects } = useResourceList(basePath, projectsApi.list);

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
      basePath={basePath}
      items={projects}
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
            projectsApi.create({
              name: d.name.trim(),
              description: d.description.trim() || undefined,
            })
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
