// Project status-updates API client — the SIGNED reports a board's health is read from, wired
// to `/api/project/projects/{id}/status-updates`.
//
// This is the only writable source of `Project.health`. The backend derives that field from the
// newest live update on every read and stores no column for it, which has one consequence a
// caller must plan for: every write here MOVES the project — a post claims a new health, an
// edit can revise it, and deleting the newest one rolls it back to whatever the previous report
// said (or to null). So a pane holding a project alongside its updates refetches the project
// after any of the three, rather than patching a health it never owned.
//
// Authorship, not verbs, gates an edit — the comment rule, for the same reason. A status update
// carries the reporter's name, so rewriting someone else's over their signature is a forgery,
// and this one would additionally move a dashboard. Removal is the looser half: the author, or
// anyone holding the project's sub-item delete verb.

import { authedJson, authedRequest } from "../http";
import { compact, enc } from "../client-helpers";
import type {
  ProjectHealth,
  StatusUpdateRow,
  StatusUpdateCreateBody,
  StatusUpdatePatchBody,
} from "./wire";

const PROJECTS = "/api/project/projects";

const stem = (projectId: string) => `${PROJECTS}/${enc(projectId)}/status-updates`;

/* ── Status update ────────────────────────────────────────────────────── */

/** One dated report on how a board is going. */
export interface ProjectStatusUpdate {
  id: string;
  projectId: string;
  /** what this report CLAIMED. Never null on a row — an update with no health is not a thing the
   *  backend accepts; the nullable health lives on the project, meaning "nobody has reported". */
  health: ProjectHealth;
  body: string;
  /** who signed it, when the backend knew. This is what the edit gate reads, so a caller can
   *  show or hide an edit control without provoking a 403 to find out. */
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toProjectStatusUpdate(r: StatusUpdateRow): ProjectStatusUpdate {
  return {
    id: r.id,
    projectId: r.projectId,
    health: r.health,
    body: r.body,
    createdBy: r.createdBy ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/* ── Client ───────────────────────────────────────────────────────────── */

export const projectStatusUpdatesApi = {
  /** The board's reports, NEWEST FIRST — the first row is the one the project's health is read
   *  from, which is why the order is the server's and not a caller's choice. Up to 100. */
  async list(projectId: string): Promise<ProjectStatusUpdate[]> {
    const rows = await authedJson<StatusUpdateRow[]>(stem(projectId));
    return rows.map(toProjectStatusUpdate);
  },

  /** Post a report. Both halves are required: a health with no explanation is a colour nobody
   *  can act on, and prose with no health does not move the dashboard. This CHANGES the
   *  project's health — refetch the project. */
  async create(
    projectId: string,
    input: { health: ProjectHealth; body: string },
  ): Promise<ProjectStatusUpdate> {
    const body: StatusUpdateCreateBody = { health: input.health, body: input.body };
    return toProjectStatusUpdate(
      await authedJson<StatusUpdateRow>(stem(projectId), {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  },

  /** Revise a report — AUTHOR ONLY (403 otherwise, whatever verbs the caller holds). Both keys
   *  are optional, so fixing a typo does not force the author to restate the health. Revising
   *  the NEWEST report's health moves the project's. */
  async update(
    projectId: string,
    updateId: string,
    patch: StatusUpdatePatchBody,
  ): Promise<ProjectStatusUpdate> {
    const body: StatusUpdatePatchBody = compact(patch);
    return toProjectStatusUpdate(
      await authedJson<StatusUpdateRow>(`${stem(projectId)}/${enc(updateId)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    );
  },

  /** Retract a report (the author always; anyone else needs the project's sub-item delete verb).
   *  Retracting the newest one moves the project's health BACK — to the previous live report, or
   *  to null when there is none. That is the honest outcome of withdrawing a claim. */
  remove(projectId: string, updateId: string): Promise<void> {
    return authedRequest(`${stem(projectId)}/${enc(updateId)}`, { method: "DELETE" });
  },
};
