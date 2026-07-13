"use client";

import { useEffect, useState, type ReactElement } from "react";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { projectsApi, type Project } from "@agentic-toolkit/data/projects";
import { ProjectOverviewPane } from "./ProjectOverviewPane";

/**
 * The "Project" topic of a product (ecosystem) or persona: resolves the subject's
 * auto-provisioned project (`projectsApi.subjectProject` — rdid or uuid, resolved at
 * the backend edge) and renders the standard ProjectOverviewPane for it. Rows that
 * predate the provisioning backfill (or that the caller can't reach) get an honest
 * empty state instead of a spinner that never settles.
 */
export function SubjectProjectPane({
  subjectKind,
  subjectId,
  title = "Project",
}: {
  subjectKind: "ecosystem" | "persona";
  subjectId: string;
  title?: string;
}): ReactElement {
  // null = confirmed absent; undefined = still loading. Same convention as the
  // sibling panes (no react-query in this package).
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

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
  return <ProjectOverviewPane projectId={project.id} title={title} />;
}
