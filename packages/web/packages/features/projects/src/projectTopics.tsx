"use client";

import { type ReactNode } from "react";
import { Activity, FolderKanban, KeyRound, ListTodo } from "lucide-react";
import { ItemAccessPanel, workspaceSubjectsDirectory } from "@agentic-toolkit/teams";
import type { TopicLeaf } from "@agentic-toolkit/resource";
import { ProjectOverviewPane } from "./ProjectOverviewPane";
import { WorkItemsSurface } from "./WorkItemsSurface";
import { ProjectActivityPane } from "./ProjectActivityPane";

/**
 * WHAT A PROJECT IS MADE OF — the one declaration of its topic set.
 *
 * Two surfaces publish a project's topics: {@link ProjectsFeature}, where a project is the
 * selected entity in its own explorer, and {@link SubjectProjectPane}, where a product's or
 * persona's auto-provisioned project is one member of a bigger stack. They render the SAME
 * panes in the same order, but through two different rail shapes — `ResourceTopic`, whose
 * render is handed `(projectId, titleFor, leaf)`, and `GroupTopicItem`, whose render is handed
 * only a sub-leaf. That shape difference is why the list was written twice, and it is a bad
 * reason: the duplicated knowledge is not the rail shape, it is WHICH TOPICS A PROJECT HAS.
 * Split across two files, adding one means editing both, and forgetting the second is invisible
 * — the surface that missed it just quietly lacks a topic nobody notices until someone
 * navigates to a project through the other door and sees a tab that isn't there.
 *
 * So the topics are declared once, shape-free: each takes one context object carrying
 * everything either surface can supply, and each surface adapts the list to its own rail. A
 * new topic is one entry here and appears in both.
 */

/** Everything a project topic's pane can need, whoever is hosting it. A field is optional
 *  exactly when one of the two surfaces genuinely cannot supply it (the embedded pane has no
 *  URL to cede, and no ownership-transfer UI of its own) — never as a convenience. */
export interface ProjectTopicContext {
  projectId: string;
  /** The pane's heading. The explorer builds a breadcrumbed one via `titleFor`; the embedded
   *  stack uses the plain label, because the stack already shows the project's name above. */
  title: string;
  /** The topic's deep-linkable inner selection (Work Items' view switcher). The explorer cedes
   *  a URL segment; the embedded pane passes a local state pair, so the switcher still works
   *  where the host's URL grammar has already run out. */
  leaf: TopicLeaf;
  /** The owning workspace. Its ABSENCE removes the Access topic (see {@link projectTopics}) —
   *  a pane that resolves subjects in a workspace cannot render without one. */
  workspaceSlug?: string;
  /** The project's own name, for panes that label the item they act on. */
  projectName?: string;
  /** Host-injected Transfer Ownership section, forwarded to Overview. The embedded surface
   *  supplies none: transferring a product's provisioned project is not that pane's business. */
  renderTransferOwnership?: (project: { id: string; name: string }) => ReactNode;
}

/** A topic, independent of the rail that will show it. The fields are the intersection of what
 *  `ResourceTopic` and `GroupTopicItem` each need, so both adapters are a spread plus a render
 *  wrapper rather than a translation. */
export interface ProjectTopicDef {
  id: string;
  label: string;
  icon: ReactNode;
  /** What this topic is for. Both rails turn descriptions into the standard no-selection
   *  overview cards, so writing one here is what gives BOTH surfaces that landing. */
  description: string;
  /** Forwarded verbatim to either rail: `"list"` for a topic whose pane publishes a deeper
   *  rail, so choosing it is an intermediate select rather than the final one. */
  leadsTo?: "list" | "detail";
  render: (ctx: ProjectTopicContext) => ReactNode;
}

const OVERVIEW: ProjectTopicDef = {
  id: "overview",
  label: "Overview",
  icon: <FolderKanban size={16} aria-hidden />,
  description: "The project's own record — name, status, color, and participants.",
  render: (ctx) => (
    <ProjectOverviewPane
      projectId={ctx.projectId}
      title={ctx.title}
      renderTransferOwnership={ctx.renderTransferOwnership}
    />
  ),
};

const WORK_ITEMS: ProjectTopicDef = {
  id: "work-items",
  label: "Work Items",
  icon: <ListTodo size={16} aria-hidden />,
  description: "The work — list, board, table, timeline, and calendar views.",
  render: (ctx) => (
    <WorkItemsSurface projectId={ctx.projectId} title={ctx.title} leaf={ctx.leaf} />
  ),
};

const ACTIVITY: ProjectTopicDef = {
  id: "activity",
  label: "Activity",
  icon: <Activity size={16} aria-hidden />,
  description: "The audit trail — everything that happened in this project.",
  render: (ctx) => <ProjectActivityPane projectId={ctx.projectId} title={ctx.title} />,
};

const ACCESS: ProjectTopicDef = {
  id: "access",
  label: "Access",
  icon: <KeyRound size={16} aria-hidden />,
  description: "Who can see and change this project.",
  // The per-item share panel (docs/workspace-roles-permissions.md): restriction mode +
  // item-scoped role assignments + the effective-permission explainer. `projectTopics` only
  // includes this topic when a workspace is known, so the guard is belt-and-braces rather than
  // a real branch — but it keeps the context ONE shape for every topic.
  render: (ctx) =>
    ctx.workspaceSlug ? (
      <ItemAccessPanel
        workspaceSlug={ctx.workspaceSlug}
        feature="projects"
        itemId={ctx.projectId}
        itemLabel={ctx.projectName}
        title={ctx.title}
        subjectsDirectory={workspaceSubjectsDirectory}
      />
    ) : null,
};

/**
 * The topics a project publishes, in rail order.
 *
 * Access is present only when the host knows the owning workspace. Omitting the topic — rather
 * than listing it and rendering an empty pane — is the honest reading of "this surface cannot
 * show item-scoped roles": a rail row that opens onto nothing is a bug report waiting to be
 * filed. In practice every current host supplies one, so this is about what the next host sees.
 */
export function projectTopics(opts: { workspaceSlug?: string }): ProjectTopicDef[] {
  return [OVERVIEW, WORK_ITEMS, ACTIVITY, ...(opts.workspaceSlug ? [ACCESS] : [])];
}
