"use client";

import { useCallback, useState, type ReactElement } from "react";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { useResourceItemQuery } from "@agentic-toolkit/data";
import { projectsApi, type Project } from "@agentic-toolkit/data/projects";
import { StackGroupDetail, type GroupTopicItem, type TopicLeaf } from "@agentic-toolkit/resource";
import { projectTopics } from "./projectTopics";
import { itemWordsOf } from "./vocabulary";
import { useBoardLive } from "./useBoardLive";

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
  // Work Items' inner view switcher (list / board / …) — a real local leaf, so the
  // switcher works in the embedded context even though the host's URL grammar ends at
  // the member segment (the view choice is content state here, not navigation).
  const [viewLeaf, setViewLeaf] = useState<string | null>(null);
  const localViewLeaf: TopicLeaf = { leafId: viewLeaf, onSelect: setViewLeaf };

  // Wrapped in an object, which is not ceremony: `null` is a real ANSWER here (no project is
  // provisioned for this subject), so it cannot also stand for "nothing read yet" the way the
  // cache's own null does. The wrapper keeps the two apart, which is what restores the tri-state
  // this pane's three render branches are written against.
  const loadSubjectProject = useCallback(
    async () => ({ project: await projectsApi.subjectProject(subjectKind, subjectId) }),
    [subjectKind, subjectId],
  );

  // Keyed on the PAIR: a persona and a product can carry the same identifier, and they resolve to
  // two different projects. Reading through the cache is what makes re-entering a subject's
  // Project topic paint the rail instead of blanking to "Loading…" — the read settles behind it.
  const { item, error, isFetching } = useResourceItemQuery<{ project: Project | null }>(
    "subject-project",
    `${subjectKind}:${subjectId}`,
    loadSubjectProject,
  );
  // null = confirmed absent; undefined = still loading. Same convention as the sibling panes.
  const project: Project | null | undefined = item?.project;

  // The second door into a board gets the same live wake as the first — a subject's project is a
  // project, and a card added to it from the standalone feature must repaint here too. Called
  // BEFORE the early returns below (hook order), and a no-op until the subject's project resolves.
  // No rail key: this pane is not the one showing the workspace's project list.
  useBoardLive(project?.id);

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

  // The project's topic set — literally the same declaration the standalone Projects feature
  // adapts (projectTopics.tsx), published here as a group rail in the one stack (never a
  // detached sub-rail). This adapter supplies what the embedded context has instead of a URL:
  // the plain label as the title (the stack already shows the project's name above it) and a
  // LOCAL leaf, so Work Items' view switcher still works where the host's URL grammar has
  // already ended at the member segment.
  const members: GroupTopicItem[] = projectTopics({
    workspaceSlug,
    // The record is already resolved by here — the pane returns early while it is outstanding —
    // so this rail is never labelled with the default and then relabelled.
    words: itemWordsOf(project),
  }).map((topic) => ({
    ...topic,
    render: () =>
      topic.render({
        projectId: project.id,
        title: topic.label,
        leaf: localViewLeaf,
        workspaceSlug,
        projectName: project.name,
      }),
  }));

  return (
    <StackGroupDetail
      levelId={`subject-project-${project.id}`}
      title={project.name}
      items={members}
      // The spinner in front of the project's name, and the ONLY signal in the cached case: a
      // re-entry paints the copy it already has — the early "Loading…" above never shows — while
      // the re-read runs behind it. Without this the second visit is silent about the fact that
      // what is on screen has not been confirmed yet.
      busy={isFetching}
      urlSelection={memberSelection}
    />
  );
}
