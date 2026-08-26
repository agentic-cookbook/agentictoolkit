"use client";

import { useCallback, type ReactElement, type ReactNode } from "react";
import { FolderKanban } from "lucide-react";
import { ErrorText } from "@agenticdevelopertoolkit/ui/components/error-text";
import { Card, CardContent } from "@agenticdevelopertoolkit/ui/components/card";
import { Input } from "@agenticdevelopertoolkit/ui/components/input";
import { Label } from "@agenticdevelopertoolkit/ui/components/label";
import { Select } from "@agenticdevelopertoolkit/ui/components/select";
import { Textarea } from "@agenticdevelopertoolkit/ui/components/textarea";
import {
  projectTemplatesApi,
  projectsApi,
  type Project,
  type Template,
} from "@agentic-toolkit/data/projects";
import { useResourceItemPrefetch, useResourceList } from "@agentic-toolkit/data";
import { ResourceExplorer, CreateResourceDialog, type ResourceTopic } from "@agentic-toolkit/resource";
import { projectTopics } from "./projectTopics";
import { ProjectsCommandPalette } from "./ProjectsCommandPalette";
import { itemWordsOf } from "./vocabulary";
import { useBoardLive } from "./useBoardLive";

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

/* ── Create-project form ──────────────────────────────────────────────────── */

/** The "no template — a plain board" sentinel. `""` because that is what an unset Select reads
 *  as, so the blank draft needs no special case. */
const NO_TEMPLATE = "";

interface ProjectInput {
  name: string;
  description: string;
  /** A BOARD template's id, or {@link NO_TEMPLATE}. A template chosen here decides the new
   *  board's columns, its milestones, its colour and its estimate scale — everything the plain
   *  create leaves at the defaults. */
  templateId: string;
}

function projectBlank(): ProjectInput {
  return { name: "", description: "", templateId: NO_TEMPLATE };
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
  templates,
}: {
  draft: ProjectInput;
  onChange: (next: ProjectInput) => void;
  error?: string | null;
  /** The workspace's BOARD templates. Empty (or absent) hides the control entirely — a picker
   *  whose only option is "no template" is a question with one answer. */
  templates?: Template[];
}): ReactElement {
  const boardTemplates = templates ?? [];
  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        {boardTemplates.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-project-template">Template</Label>
            <Select
              id="new-project-template"
              value={draft.templateId}
              onChange={(e) => onChange({ ...draft, templateId: e.target.value })}
            >
              <option value={NO_TEMPLATE}>Empty board</option>
              {boardTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <p className="text-sm text-apt-text-muted">
              Starts the board with a template&apos;s columns and milestones instead of the
              defaults.
            </p>
          </div>
        )}
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

  // Warm the RECORD as the pointer rests on a project row, onto the same entry the Overview, the
  // board and the triage queue read. The explorer already warms the route; without this the click
  // still waits on a round trip for the pane inside that route, so warming one half only makes the
  // click as fast as its slower half.
  const prefetchProject = useResourceItemPrefetch<Project | null>(
    "project:projects",
    projectsApi.get,
  );

  // The open board is LIVE: someone else's edit — a teammate, an agent through the MCP tools, the
  // due-date sweep — repaints the panes without a reload. Mounted once here, at the feature root,
  // because the connection is the BOARD's and not any pane's: eight panes on one board share one
  // stream, and a pane that opens later joins the one already running. `basePath` rides along so
  // the project rail follows a rename made elsewhere.
  useBoardLive(activeProjectId, basePath);

  // The workspace's TEMPLATES, for the create dialog's picker — both kinds, under the workspace
  // key the Templates pane and the card-create dialog share, so one read answers all three. The
  // board ones are selected out at the call site. No templates means no picker here, never no
  // create — but the read does NOT swallow its failure, because the Templates pane owns this entry
  // and a fabricated empty success would tell it, silently, that the workspace has no templates.
  const loadTemplates = useCallback(
    () => projectTemplatesApi.list({ workspace: workspaceSlug }),
    [workspaceSlug],
  );
  const { items: templateRows } = useResourceList<Template>(
    `workspace:${workspaceSlug ?? ""}:templates`,
    loadTemplates,
  );
  const boardTemplates = (templateRows ?? []).filter((t) => t.kind === "project");

  // Entity-first topics (FTD), adapted from the shared declaration in projectTopics.tsx —
  // which is also what SubjectProjectPane publishes, so the two doors into a project can't
  // drift apart. All this adapter adds is the explorer's own vocabulary: the breadcrumbed
  // title, the URL-backed leaf, and the fact that a topic pane is only ever rendered with a
  // project selected (`projectId` is defined here; the guard keeps the type honest).
  // The OPEN board's word for its cards, from the list that is already loaded — no second read,
  // and null while the list is outstanding or on the "All" landing, where the default is the only
  // honest answer anyway (no board is open to have renamed anything).
  const openProject = (projects ?? []).find((p) => p.id === activeProjectId) ?? null;
  const topics: ResourceTopic[] = projectTopics({
    workspaceSlug,
    words: itemWordsOf(openProject),
  }).map((topic) => ({
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
        prefetchItem={prefetchProject}
        getId={(p) => p.id}
        getLabel={(p) => p.name}
        nameSuffix="Project"
        itemIcon={<FolderKanban size={16} aria-hidden />}
        topics={topics}
        newLabel="New Project…"
        rail={{
          title: "All projects",
          help: "Pick a project to view its overview, work items, and activity.",
          emptyLabel: "No projects yet.",
          // Status is the one fact that separates a live project from an archived one at a
          // glance. The card grid carried it as a badge; the rail carries it as the row's
          // second line, so dropping the grid doesn't drop the fact.
          getSublabel: (p) => p.status,
        }}
        renderDialog={(onClose, onCreated) => (
          <CreateResourceDialog
            ariaLabel="New project"
            heading="New project"
            blank={projectBlank}
            validate={projectValidate}
            create={(d) =>
              d.templateId === NO_TEMPLATE
                ? projectsApi.create(
                    {
                      name: d.name.trim(),
                      description: d.description.trim() || undefined,
                    },
                    { workspace: workspaceSlug },
                  )
                : // The milestones the template writes come back alongside; the explorer opens the
                  // PROJECT, which is what was asked for, and its Milestones topic is where they
                  // are. The template's own description stands in when none was typed — that is
                  // the endpoint's rule, not a client default.
                  projectTemplatesApi
                    .instantiateProject(
                      d.templateId,
                      {
                        name: d.name.trim(),
                        description: d.description.trim() || undefined,
                      },
                      { workspace: workspaceSlug },
                    )
                    .then((r) => r.project)
            }
            onClose={onClose}
            onCreated={(project) => onCreated(project.id)}
            renderForm={(draft, onChange, error) => (
              <ProjectForm
                draft={draft}
                onChange={onChange}
                error={error}
                templates={boardTemplates}
              />
            )}
          />
        )}
      />
    </>
  );
}
