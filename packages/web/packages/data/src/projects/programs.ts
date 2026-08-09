// Project programs API client — the roll-up side of the `/api/project/*` surface.
//
// Its own file and its own route stem, for the reason `iterations.ts` has one: a program does
// not belong to a project. It sits ABOVE several boards and belongs to the WORKSPACE, which is
// what makes rolling them up meaningful — so there is no `/projects/{id}/programs` to call, the
// list is pinned with `?workspace=` exactly as the projects list is, and everything else hangs
// off `/project/programs/{id}`.
//
// `remove` answers with a COUNT rather than the boards it touched, the same disclosure rule the
// iteration sweeps follow: it un-assigns every member board under a workspace-level verb, and
// returning them would report projects the caller may not be allowed to read. `projects()` is
// the opposite — it READS content, so it is reach-filtered.

import { authedJson } from "../http";
import { compact, enc, workspaceQuery } from "../client-helpers";
import { toProject, type Project } from "./projects";
import type {
  ProgramRow,
  ProgramCreateBody,
  ProgramPatchBody,
  ProjectRow,
} from "./wire";

const BASE = "/api/project/programs";

/* ── Program ──────────────────────────────────────────────────────────── */

export interface Program {
  id: string;
  name: string;
  description: string;
  /** hex accent, same convention as a project's. */
  color: string;
  /** the workspace that owns it. A board may only join a program whose owner matches its own,
   *  which is what keeps a program from spanning two workspaces. */
  ownerKind: string;
  ownerId: string;
  /** the two ends (YYYY-MM-DD), each null when unset and independent of the other: a standing
   *  program ("Platform") has neither, and a delivery program usually knows its target first. */
  startDate: string | null;
  targetDate: string | null;
  ecosystemId: string;
  createdAt: string;
  updatedAt: string;
}

export function toProgram(r: ProgramRow): Program {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    ownerKind: r.ownerKind,
    ownerId: r.ownerId,
    startDate: r.startDate ?? null,
    targetDate: r.targetDate ?? null,
    ecosystemId: r.ecosystemId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/* ── Client ───────────────────────────────────────────────────────────── */

export const projectProgramsApi = {
  /** The workspace's programs, in the server's order (by case-folded name). `workspace` pins the
   *  list to that workspace's owning principal, exactly as `projectsApi.list` does; without it
   *  the caller sees every program their reach admits. */
  async list(opts?: { workspace?: string }): Promise<Program[]> {
    const rows = await authedJson<ProgramRow[]>(`${BASE}${workspaceQuery(opts)}`);
    return rows.map(toProgram);
  },

  async get(id: string): Promise<Program | null> {
    try {
      return toProgram(await authedJson<ProgramRow>(`${BASE}/${enc(id)}`));
    } catch {
      // Backend 404s with a thrown error; the UI contract is null-for-missing.
      return null;
    }
  },

  /** Create a program in a workspace. Both dates are optional and independent; a `targetDate`
   *  before a `startDate` is a 400, and a name already used by a live program in the same
   *  workspace is a 409. */
  async create(
    input: {
      name: string;
      description?: string;
      color?: string;
      startDate?: string | null;
      targetDate?: string | null;
    },
    opts?: { workspace?: string },
  ): Promise<Program> {
    const body: ProgramCreateBody = {
      name: input.name,
      ...compact({
        description: input.description,
        color: input.color,
        startDate: input.startDate,
        targetDate: input.targetDate,
      }),
    };
    return toProgram(
      await authedJson<ProgramRow>(`${BASE}${workspaceQuery(opts)}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  },

  /** Rename a program, re-colour it, or move either end. Sending ONE date is the ordinary edit:
   *  the server validates the pair the program will END UP as, not the pair that was sent.
   *  `compact` keeps an explicit null, which is how an end is CLEARED. */
  async update(id: string, patch: ProgramPatchBody): Promise<Program> {
    const body: ProgramPatchBody = compact(patch);
    return toProgram(
      await authedJson<ProgramRow>(`${BASE}/${enc(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    );
  },

  /**
   * Delete a program, UN-ASSIGNING every board in it — the count of those boards is what comes
   * back. It never refuses, for the same reason deleting an iteration doesn't: "in no program"
   * is an ordinary state a project is allowed to be in, so the sweep always has a defined
   * outcome. Refetch the affected boards to see the result.
   */
  async remove(id: string): Promise<{ unassigned: number }> {
    return authedJson<{ unassigned: number }>(`${BASE}/${enc(id)}`, {
      method: "DELETE",
    });
  },

  /**
   * The boards rolled up into this program — each with its OWN health, deliberately not folded
   * into one verdict. Three at-risk boards and one off-track board have no honest single
   * colour, so the API reports the list and leaves any summarising to whoever knows what the
   * summary is for.
   *
   * Unlike {@link remove}, this reads content and is therefore reach-filtered: a board the
   * caller cannot open does not appear here just because they can see the program.
   */
  async projects(id: string): Promise<Project[]> {
    const rows = await authedJson<ProjectRow[]>(`${BASE}/${enc(id)}/projects`);
    return rows.map(toProject);
  },
};
