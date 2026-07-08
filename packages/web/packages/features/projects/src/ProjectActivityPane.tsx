"use client";

import { useCallback, type ReactElement } from "react";
import { projectActivityApi } from "@agentic-toolkit/data/projects";
import { FeatureTitle, useRecordAffordance } from "@agentic-toolkit/resource";
import { ActivityFeed, ACTIVITY_PAGE_SIZE } from "./ActivityFeed";

/**
 * The Activity topic for the active project (T6): the project's audit trail +
 * comments as a keyset-paginated ActivityFeed, newest-first. It owns nothing but
 * the project-scoped `load` (a stable closure keyed on projectId) and the pane
 * chrome; the feed handles paging, phrasing, and loading/empty/error states.
 * Renders inline (it publishes no stack level), mirroring the sibling project panes.
 */
export function ProjectActivityPane({
  projectId,
  title,
}: {
  projectId: string;
  title: string;
}): ReactElement {
  // The host-injected per-record affordance (the hub's api-explorer button); null on
  // a standalone feature site → the trailing slot renders nothing.
  const renderRecordAffordance = useRecordAffordance();
  const load = useCallback(
    (before?: string) =>
      projectActivityApi.projectActivity(projectId, {
        limit: ACTIVITY_PAGE_SIZE,
        before,
      }),
    [projectId],
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <FeatureTitle
        title={title}
        trailing={renderRecordAffordance?.({
          path: "/project/projects/{id}/activity",
          pathValues: { id: projectId },
          title: "Project activity API",
        })}
      />
      <section className="flex min-w-0 flex-1 flex-col overflow-y-auto px-6 py-4">
        <ActivityFeed load={load} />
      </section>
    </div>
  );
}
