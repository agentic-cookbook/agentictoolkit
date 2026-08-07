// Projects API client — wired to the typed backend `/api/project/*` surface.
//
// Mirrors `src/api/teams.ts` (a `toX` mapper per entity, a `BASE` const, a CRUD
// object over `authedJson`/`authedRequest`), with two deliberate differences:
//   1. mutations are PATCH (the project routes patch, they don't PUT);
//   2. participant DELETE addresses by the actor's id (`participantId`), not the
//      row id, AND requires a `?kind=` query — it's a (kind, entity-id) detach.
//
// The project sub-resources (statuses, participants) live here beside the root
// project CRUD; work items and the activity trail are large enough to warrant
// their own clients (`project-work-items.ts`, `project-activity.ts`), mirroring
// the teams.ts + team-members.ts split.

import { authedJson, authedRequest } from "../http";
import { compact, enc, sortByText, workspaceQuery } from "../client-helpers";
import type {
  StatusCategory,
  ProjectRow,
  ProjectStatusRow,
  ProjectParticipantRow,
  ProjectCreateBody,
  ProjectPatchBody,
  ProjectStatusCreateBody,
  ProjectStatusPatchBody,
  ProjectParticipantAddBody,
} from "./wire";

const BASE = "/api/project/projects";

/* ── Projects ─────────────────────────────────────────────────────────── */

export interface Project {
  id: string;
  name: string;
  description: string;
  /** lifecycle status (DB default 'active'). */
  status: string;
  /** hex board accent (DB default #007AFF). */
  color: string;
  /** the owning ecosystem (tenant scope). */
  ecosystemId: string;
  /** ISO timestamp when archived; null when not archived. */
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toProject(r: ProjectRow): Project {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    status: r.status,
    color: r.color,
    ecosystemId: r.ecosystemId,
    archivedAt: r.archivedAt ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/* ── Statuses (board columns) ─────────────────────────────────────────── */

export interface ProjectStatus {
  id: string;
  projectId: string;
  /** stable identifier, unique within the project. */
  key: string;
  label: string;
  category: StatusCategory;
  /** column order (ascending). */
  position: number;
  createdAt: string;
}

export function toProjectStatus(r: ProjectStatusRow): ProjectStatus {
  return {
    id: r.id,
    projectId: r.projectId,
    key: r.key,
    label: r.label,
    category: r.category,
    position: r.position,
    createdAt: r.createdAt,
  };
}

/* ── Participants ─────────────────────────────────────────────────────── */

export interface ProjectParticipant {
  id: string;
  projectId: string;
  participantKind: "customer" | "persona" | "team";
  /** the attached actor id (opaque) — how a detach addresses the row. */
  participantId: string;
  /** the participant's project role (DB default 'member'). */
  role: string;
  addedBy: string | null;
  addedAt: string;
}

export function toProjectParticipant(r: ProjectParticipantRow): ProjectParticipant {
  return {
    id: r.id,
    projectId: r.projectId,
    participantKind: r.participantKind,
    participantId: r.participantId,
    role: r.role,
    addedBy: r.addedBy ?? null,
    addedAt: r.addedAt,
  };
}

/* ── Client ───────────────────────────────────────────────────────────── */

export const projectsApi = {
  // `workspace` pins list/create to the WORKSPACE'S owning principal (backend
  // `?workspace=<slug>`): list returns only projects that principal OWNS, and
  // create stamps that principal as the owner (so an org workspace's new project
  // is org-owned). Without it, list falls back to ownership REACH (owned +
  // participating) and create stamps the caller.
  async list(opts?: { workspace?: string }): Promise<Project[]> {
    const rows = await authedJson<ProjectRow[]>(`${BASE}${workspaceQuery(opts)}`);
    return sortByText(rows.map(toProject), (p) => p.name);
  },

  async get(id: string): Promise<Project | null> {
    try {
      return toProject(await authedJson<ProjectRow>(`${BASE}/${enc(id)}`));
    } catch {
      // Backend 404s with a thrown error; the UI contract is null-for-missing.
      return null;
    }
  },

  /** The auto-provisioned SUBJECT project of one product (ecosystem) or persona — the
   *  "Project" topic's lookup (backend `?subjectKind=&subjectId=`; `subjectId` may be
   *  the subject's rdid or uuid, resolved at the edge). Null when none is provisioned
   *  yet or the caller has no reach. */
  async subjectProject(
    subjectKind: "ecosystem" | "persona",
    subjectId: string,
  ): Promise<Project | null> {
    const rows = await authedJson<ProjectRow[]>(
      `${BASE}?subjectKind=${enc(subjectKind)}&subjectId=${enc(subjectId)}`,
    );
    return rows[0] ? toProject(rows[0]) : null;
  },

  async create(
    input: {
      name: string;
      description?: string;
      color?: string;
    },
    opts?: { workspace?: string },
  ): Promise<Project> {
    const body: ProjectCreateBody = {
      name: input.name,
      ...compact({ description: input.description, color: input.color }),
    };
    return toProject(
      await authedJson<ProjectRow>(`${BASE}${workspaceQuery(opts)}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  },

  async update(
    id: string,
    patch: {
      name?: string;
      description?: string;
      status?: string;
      color?: string;
      /** an ISO timestamp archives; explicit null un-archives. */
      archivedAt?: string | null;
    },
  ): Promise<Project> {
    // `compact` keeps explicit null (it drops only undefined), so an
    // `archivedAt: null` un-archive is sent, not stripped.
    const body: ProjectPatchBody = compact(patch);
    return toProject(
      await authedJson<ProjectRow>(`${BASE}/${enc(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    );
  },

  delete(id: string): Promise<void> {
    return authedRequest(`${BASE}/${enc(id)}`, { method: "DELETE" });
  },

  statuses: {
    async list(projectId: string): Promise<ProjectStatus[]> {
      const rows = await authedJson<ProjectStatusRow[]>(
        `${BASE}/${enc(projectId)}/statuses`,
      );
      return rows.map(toProjectStatus); // server orders by position
    },

    async create(
      projectId: string,
      input: {
        key: string;
        label: string;
        category: StatusCategory;
        position?: number;
      },
    ): Promise<ProjectStatus> {
      const body: ProjectStatusCreateBody = {
        key: input.key,
        label: input.label,
        category: input.category,
        ...compact({ position: input.position }),
      };
      return toProjectStatus(
        await authedJson<ProjectStatusRow>(
          `${BASE}/${enc(projectId)}/statuses`,
          { method: "POST", body: JSON.stringify(body) },
        ),
      );
    },

    async update(
      projectId: string,
      statusId: string,
      patch: {
        label?: string;
        category?: StatusCategory;
        position?: number;
      },
    ): Promise<ProjectStatus> {
      const body: ProjectStatusPatchBody = compact(patch);
      return toProjectStatus(
        await authedJson<ProjectStatusRow>(
          `${BASE}/${enc(projectId)}/statuses/${enc(statusId)}`,
          { method: "PATCH", body: JSON.stringify(body) },
        ),
      );
    },

    remove(projectId: string, statusId: string): Promise<void> {
      return authedRequest(
        `${BASE}/${enc(projectId)}/statuses/${enc(statusId)}`,
        { method: "DELETE" },
      );
    },
  },

  participants: {
    async list(projectId: string): Promise<ProjectParticipant[]> {
      const rows = await authedJson<ProjectParticipantRow[]>(
        `${BASE}/${enc(projectId)}/participants`,
      );
      return rows.map(toProjectParticipant); // server orders by addedAt
    },

    async add(
      projectId: string,
      input: {
        participantKind: "customer" | "persona" | "team";
        participantId: string;
      },
    ): Promise<ProjectParticipant> {
      const body: ProjectParticipantAddBody = {
        participantKind: input.participantKind,
        participantId: input.participantId,
      };
      return toProjectParticipant(
        await authedJson<ProjectParticipantRow>(
          `${BASE}/${enc(projectId)}/participants`,
          { method: "POST", body: JSON.stringify(body) },
        ),
      );
    },

    /** Detach a participant by (kind, actor-id). The path segment is the actor's
     *  `participantId` (NOT the row id) and the `kind` query is required. */
    remove(
      projectId: string,
      participantId: string,
      kind: "customer" | "persona" | "team",
    ): Promise<void> {
      return authedRequest(
        `${BASE}/${enc(projectId)}/participants/${enc(participantId)}?kind=${enc(kind)}`,
        { method: "DELETE" },
      );
    },
  },
};
