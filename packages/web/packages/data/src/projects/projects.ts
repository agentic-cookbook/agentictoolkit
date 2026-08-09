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
  EstimateScale,
  PriorityScale,
  ProjectHealth,
  StatusCategory,
  ProjectRow,
  ProjectStatusRow,
  ProjectParticipantRow,
  ProjectCreateBody,
  ProjectPatchBody,
  ProjectStatusCreateBody,
  ProjectStatusPatchBody,
  ProjectParticipantAddBody,
  ProjectLabelsRow,
  SavedViewRow,
  SavedViewCreateBody,
  SavedViewPatchBody,
} from "./wire";

const BASE = "/api/project/projects";

/* ── Work-item key prefixes ───────────────────────────────────────────── */

/**
 * The shape of a project's work-item key prefix (`ADH` in `ADH-42`): 2-8 characters, a letter
 * then letters or digits, upper case.
 *
 * A client-side MIRROR of the backend's one spelling (`src/project/keys.ts::KEY_PREFIX_RE`) —
 * the same arrangement `validateSlug` has with the backend's slug rules, and for the same
 * reason: the server stays the authority (it 400s a bad prefix regardless), but a form that can
 * only learn a rule by breaking against it is a bad form. If the two ever disagree, the backend
 * wins and this is the copy to fix.
 */
export const KEY_PREFIX_REGEX = /^[A-Z][A-Z0-9]{1,7}$/;

/** A human-readable reason the prefix is unusable, or `null` when it is fine. An EMPTY prefix
 *  is refused rather than treated as "clear it": there is no way to un-name a project's cards
 *  once they are named, and a blank field is far more likely to be a mistake than an intent. */
export function validateKeyPrefix(prefix: string): string | null {
  const value = prefix.trim().toUpperCase();
  if (!value) return "A key prefix is required.";
  if (!KEY_PREFIX_REGEX.test(value)) {
    return "Use 2-8 characters: a letter, then letters or digits.";
  }
  return null;
}

/* ── What a board calls its items ─────────────────────────────────────── */

/**
 * The words a board uses when it has not chosen its own — the same pair the backend's column
 * defaults spell, restated here so a response from a server that predates the columns renders
 * identically to one that has them, and so a surface with no project in hand (a cross-board
 * queue, a template that names no noun) has something to say.
 */
export const DEFAULT_ITEM_NOUN = "work item";
export const DEFAULT_ITEM_NOUN_PLURAL = "work items";

/* ── Projects ─────────────────────────────────────────────────────────── */

export interface Project {
  id: string;
  name: string;
  description: string;
  /** lifecycle status (DB default 'active'). */
  status: string;
  /** hex board accent (DB default #007AFF). */
  color: string;
  /** the prefix this project's work-item keys are rendered from (`ADH` in `ADH-42`).
   *  '' means no prefix is assigned yet, and the project's cards therefore have no keys. */
  keyPrefix: string;
  /** the owning ecosystem (tenant scope). */
  ecosystemId: string;
  /** ISO timestamp when archived; null when not archived. */
  archivedAt: string | null;
  /** which numbers this project's estimate picker offers. `'none'` — the DB default — means
   *  this project does not estimate, and is why the field is never optional here: "no scale"
   *  is an answer a renderer can act on, whereas `undefined` is one it has to guess about. */
  estimateScale: EstimateScale;
  /** whether this board ranks its work. `'none'` hides every ranking control without touching
   *  the ranks already stored, so it is never optional here for the same reason the scale above
   *  is not: "this board does not rank" is an answer a renderer acts on. */
  priorityScale: PriorityScale;
  /** what this board calls its items, singular and plural — "work item"/"work items" unless the
   *  board says otherwise. Always both, never derived one from the other: no client can turn
   *  "story" into "stories" reliably, so the plural is stored beside the singular. */
  itemNoun: string;
  itemNounPlural: string;
  /** the plan's two ends (YYYY-MM-DD), each null when unset. Independent: a board may know its
   *  target long before its start, and a standing board has neither. */
  startDate: string | null;
  targetDate: string | null;
  /** the ONE principal answerable for the board, or null. The two halves are always both set or
   *  both null — the backend refuses half a lead — so a renderer may test either one. */
  leadKind: "customer" | "persona" | "team" | null;
  leadId: string | null;
  /** the program this board rolls up into, or null. */
  programId: string | null;
  /** the newest REPORTED health, or null for "nobody has reported yet" — which is not the same
   *  as on-track and must not be rendered as it. Derived by the backend from the newest live
   *  status update; nothing here computes or caches it. */
  health: ProjectHealth | null;
  /** when that report was posted, or null alongside a null health. Show it with the health: a
   *  colour with no date is a claim of unknown age. */
  healthUpdatedAt: string | null;
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
    keyPrefix: r.keyPrefix ?? "",
    ecosystemId: r.ecosystemId,
    archivedAt: r.archivedAt ?? null,
    estimateScale: r.estimateScale ?? "none",
    // The defaults a backend that predates these columns implies — and the same ones its DB
    // defaults spell, so a project read from an old server renders exactly as a new one does.
    priorityScale: r.priorityScale ?? "standard",
    itemNoun: r.itemNoun || DEFAULT_ITEM_NOUN,
    itemNounPlural: r.itemNounPlural || DEFAULT_ITEM_NOUN_PLURAL,
    startDate: r.startDate ?? null,
    targetDate: r.targetDate ?? null,
    // A lead is only a lead when BOTH halves arrived. A row carrying one and not the other is
    // not a partial lead to render — the backend cannot write one, so it is a response from a
    // backend that predates the field, and "unset" is the honest reading.
    leadKind: r.leadKind && r.leadId ? r.leadKind : null,
    leadId: r.leadKind && r.leadId ? r.leadId : null,
    programId: r.programId ?? null,
    health: r.health ?? null,
    healthUpdatedAt: r.healthUpdatedAt ?? null,
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

/* ── Saved views ──────────────────────────────────────────────────────── */

export interface SavedView {
  id: string;
  projectId: string;
  name: string;
  /** The view's stored shape, OPAQUE on the wire and here: which view to open in, which filter
   *  to apply, which column sort. The backend stores it as one jsonb blob and never reads
   *  inside it, and this client doesn't either — the feature package that owns the filter
   *  vocabulary decodes it (`decodeViewConfig`). That is what keeps a new filter axis from
   *  being a schema change. */
  config: unknown;
  /** The customer who saved it, when the backend knew one. Recorded, not enforced. */
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toSavedView(r: SavedViewRow): SavedView {
  return {
    id: r.id,
    projectId: r.projectId,
    name: r.name,
    config: r.config,
    createdBy: r.createdBy ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
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

  // The wire body IS the parameter type. Restating the columns here let `keyPrefix` reach the
  // wire type and the endpoint while staying unsayable at the only call site a UI has — a
  // divergence nothing catches until someone tries the rename. One name, one place.
  async update(id: string, patch: ProjectPatchBody): Promise<Project> {
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

  /** The label VOCABULARY to offer when tagging this project's cards — every label the
   *  project's owner has already used, ordered alphabetically by the server.
   *
   *  Read through the PROJECT even though the vocabulary is not the project's: a client holds a
   *  project id, and the project is what decides whose vocabulary applies (an org project's
   *  owner, not the caller). It spans content types by design — a label put on a research
   *  document is offered on a card — so this is a suggestion list, never a closed set: a card
   *  may carry a label that is not in it yet, which is exactly what typing a new one does.
   *  Read-only: a label comes into existence by being used, not by being declared. */
  async labels(projectId: string): Promise<string[]> {
    const body = await authedJson<ProjectLabelsRow>(`${BASE}/${enc(projectId)}/labels`);
    return body.items;
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

  /** A project's saved views — a named filter + view + sort, shared by everyone who can read
   *  the project (there are no private views: a board is a shared artefact, and a view nobody
   *  else can open is a bookmark, which the address bar already is). */
  savedViews: {
    async list(projectId: string): Promise<SavedView[]> {
      const rows = await authedJson<SavedViewRow[]>(
        `${BASE}/${enc(projectId)}/saved-views`,
      );
      return rows.map(toSavedView); // server orders by name
    },

    async create(
      projectId: string,
      input: { name: string; config: unknown },
    ): Promise<SavedView> {
      const body: SavedViewCreateBody = { name: input.name, config: input.config };
      return toSavedView(
        await authedJson<SavedViewRow>(`${BASE}/${enc(projectId)}/saved-views`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      );
    },

    async update(
      projectId: string,
      viewId: string,
      patch: { name?: string; config?: unknown },
    ): Promise<SavedView> {
      const body: SavedViewPatchBody = compact(patch);
      return toSavedView(
        await authedJson<SavedViewRow>(
          `${BASE}/${enc(projectId)}/saved-views/${enc(viewId)}`,
          { method: "PATCH", body: JSON.stringify(body) },
        ),
      );
    },

    remove(projectId: string, viewId: string): Promise<void> {
      return authedRequest(
        `${BASE}/${enc(projectId)}/saved-views/${enc(viewId)}`,
        { method: "DELETE" },
      );
    },
  },
};
