"use client";

import { useEffect, useState, type ReactElement } from "react";
import { Activity, FolderKanban, KeyRound, ListTodo } from "lucide-react";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { projectsApi, type Project } from "@agentic-toolkit/data/projects";
import { StackGroupDetail, type GroupTopicItem, type TopicLeaf } from "@agentic-toolkit/resource";
import { ItemAccessPanel, workspaceSubjectsDirectory } from "@agentic-toolkit/teams";
import { ProjectOverviewPane } from "./ProjectOverviewPane";
import { WorkItemsSurface } from "./WorkItemsSurface";
import { ProjectActivityPane } from "./ProjectActivityPane";

/**
 * The "Project" topic of a product (ecosystem) or persona: resolves the subject's
 * auto-provisioned project (`projectsApi.subjectProject` — rdid or uuid, resolved at
 * the backend edge) and renders the project's FULL topic set — Overview / Work Items /
 * Activity (/ Access when the host passes the workspace) — as a group rail in the one
 * stack, exactly like the standalone Projects feature. Rows that predate the
 * provisioning backfill (or that the caller can't reach) get an honest empty state.
 */
export function SubjectProjectPane({
  subjectKind,
  subjectId,
  workspaceSlug,
  memberSelection,
}: {
  subjectKind: "ecosystem" | "persona";
  subjectId: string;
  /** The owning workspace's slug — enables the Access member (item-scoped roles need
   *  the workspace to resolve subjects in). Omit to hide Access. */
  workspaceSlug?: string;
  /** Deep-linkable member selection (the host's next URL segment — the hub's product
   *  route cedes it via `ctx.leaf`). Omit for local selection (the persona editor). */
  memberSelection?: { selectedId: string | null; onSelect: (id: string | null) => void };
}): ReactElement {
  // null = confirmed absent; undefined = still loading. Same convention as the
  // sibling panes (no react-query in this package).
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  // Work Items' inner view switcher (list / board / …) — a real local leaf, so the
  // switcher works in the embedded context even though the host's URL grammar ends at
  // the member segment (the view choice is content state here, not navigation).
  const [viewLeaf, setViewLeaf] = useState<string | null>(null);
  const localViewLeaf: TopicLeaf = { leafId: viewLeaf, onSelect: setViewLeaf };

  useEffect(() => {
    let alive = true;
    setProject(undefined);
    setError(null);
    projectsApi
      .subjectProject(subjectKind, subjectId)
      .then((p) => {
        if (alive) setProject(p);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "Failed to load the project.");
      });
    return () => {
      alive = false;
    };
  }, [subjectKind, subjectId]);

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <EmptyState title="Couldn't load the project" description={error} />
      </div>
    );
  }
  if (project === undefined) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <EmptyState title="Loading…" />
      </div>
    );
  }
  if (project === null) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <EmptyState
          title="No project yet"
          description={`This ${subjectKind === "persona" ? "persona" : "product"} has no provisioned project — it will appear after the next deploy backfill.`}
        />
      </div>
    );
  }

  // The project's topic set — the same panes the standalone Projects feature renders,
  // published as a group rail in the one stack (never a detached sub-rail).
  const members: GroupTopicItem[] = [
    {
      id: "overview",
      label: "Overview",
      icon: <FolderKanban size={16} aria-hidden />,
      description: "The project's own record — name, status, color, and participants.",
      render: () => <ProjectOverviewPane projectId={project.id} title="Overview" />,
    },
    {
      id: "work-items",
      label: "Work Items",
      icon: <ListTodo size={16} aria-hidden />,
      description: "The work — list, board, table, timeline, and calendar views.",
      render: () => (
        <WorkItemsSurface projectId={project.id} title="Work Items" leaf={localViewLeaf} />
      ),
    },
    {
      id: "activity",
      label: "Activity",
      icon: <Activity size={16} aria-hidden />,
      description: "The audit trail — everything that happened in this project.",
      render: () => <ProjectActivityPane projectId={project.id} title="Activity" />,
    },
    ...(workspaceSlug
      ? [
          {
            id: "access",
            label: "Access",
            icon: <KeyRound size={16} aria-hidden />,
            description: "Who can see and change this project.",
            render: () => (
              <ItemAccessPanel
                workspaceSlug={workspaceSlug}
                feature="projects"
                itemId={project.id}
                itemLabel={project.name}
                title="Access"
                subjectsDirectory={workspaceSubjectsDirectory}
              />
            ),
          } satisfies GroupTopicItem,
        ]
      : []),
  ];

  return (
    <StackGroupDetail
      levelId={`subject-project-${project.id}`}
      title={project.name}
      items={members}
      urlSelection={memberSelection}
    />
  );
}
