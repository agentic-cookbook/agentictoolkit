// Project templates API client — the "stamp this shape out again" side of `/api/project/*`.
//
// Its own file and its own route stem for the reason `programs.ts` has one: a template belongs to
// the WORKSPACE, not to a board. That is not a filing decision, it is the whole point — a template
// pinned to one board could only ever rebuild that board, and the shapes a team repeats are
// exactly the ones they repeat ACROSS boards. So the list is pinned with `?workspace=` like the
// programs list, and everything else hangs off `/project/templates/{id}`.
//
// Two kinds live in one table because they are one verb ("make the usual thing") with two objects,
// and a picker has to show both to decide which it wants. What separates them is `body`, read
// STRICTLY against `kind` server-side: an unrecognised key is a 400, not a silent discard, because
// a discarded key in a template is a step of a checklist that quietly stopped existing.
//
// `remove` is a soft delete that cascades NOTHING. What a template made is ordinary rows that
// stopped being related to it the moment they were written — a board does not become invalid
// because the shape it was stamped from was retired.

import { authedJson, authedRequest } from "../http";
import { compact, enc, workspaceQuery } from "../client-helpers";
import { toProject, type Project } from "./projects";
import { toMilestone, type Milestone } from "./milestones";
import { toWorkItem, type WorkItem } from "./work-items";
import type {
  TemplateRow,
  TemplateKind,
  WorkItemTemplateBody,
  ProjectTemplateBody,
  TemplateCreateBody,
  TemplatePatchBody,
  TemplateInstantiateWorkItemBody,
  TemplateInstantiateWorkItemResult,
  TemplateInstantiateProjectBody,
  TemplateInstantiateProjectResult,
} from "./wire";

const BASE = "/api/project/templates";

/* ── Template ─────────────────────────────────────────────────────────── */

export interface Template {
  id: string;
  /** what it MAKES. Narrow on this before reading {@link body} — the two bodies share no keys
   *  beyond `description`, and the server validates the stored one against exactly this. */
  kind: TemplateKind;
  name: string;
  description: string;
  /** the stored shape. Typed as the union because the row is; use {@link workItemBodyOf} /
   *  {@link projectBodyOf} to narrow it without hand-writing the cast at every call site. */
  body: WorkItemTemplateBody | ProjectTemplateBody;
  /** the workspace that owns it — the same owner pair a program or an iteration carries. A
   *  template is only offered in the workspace that owns it, which is why the list is pinned. */
  ownerKind: string;
  ownerId: string;
  createdBy: string | null;
  ecosystemId: string;
  createdAt: string;
  updatedAt: string;
}

export function toTemplate(r: TemplateRow): Template {
  return {
    id: r.id,
    kind: r.kind,
    name: r.name,
    description: r.description,
    body: r.body,
    ownerKind: r.ownerKind,
    ownerId: r.ownerId,
    createdBy: r.createdBy ?? null,
    ecosystemId: r.ecosystemId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** Narrow a card template's body. Returns null for a project template rather than throwing, so a
 *  renderer handed a mixed list can skip what it cannot draw instead of guarding every access. */
export function workItemBodyOf(t: Template): WorkItemTemplateBody | null {
  return t.kind === "work_item" ? (t.body as WorkItemTemplateBody) : null;
}

/** The mirror of {@link workItemBodyOf}, for board templates. */
export function projectBodyOf(t: Template): ProjectTemplateBody | null {
  return t.kind === "project" ? (t.body as ProjectTemplateBody) : null;
}

/**
 * How many cards instantiating this template will write — 1 for the card itself plus its
 * children, 0 for a board template. A preview number, not a promise: it is what the STORED body
 * says, which is exactly what a picker needs to say "creates 4 cards" before anyone commits.
 */
export function cardCountOf(t: Template): number {
  const body = workItemBodyOf(t);
  return body ? 1 + (body.children?.length ?? 0) : 0;
}

/* ── Client ───────────────────────────────────────────────────────────── */

export const projectTemplatesApi = {
  /**
   * The workspace's templates, by case-folded name — the order a picker wants. `workspace` pins
   * the list to that workspace exactly as `projectsApi.list` does; without it the caller sees
   * every template their reach admits.
   *
   * `kind` filters to one kind, and a value outside the vocabulary is a 400 rather than a silent
   * "all of them": answering a request for board templates with card templates hands the picker
   * rows that will 400 the moment one is chosen.
   */
  async list(opts?: { workspace?: string; kind?: TemplateKind }): Promise<Template[]> {
    const ws = workspaceQuery(opts);
    const kind = opts?.kind ? `${ws ? "&" : "?"}kind=${enc(opts.kind)}` : "";
    const rows = await authedJson<TemplateRow[]>(`${BASE}${ws}${kind}`);
    return rows.map(toTemplate);
  },

  async get(id: string): Promise<Template | null> {
    try {
      return toTemplate(await authedJson<TemplateRow>(`${BASE}/${enc(id)}`));
    } catch {
      // Backend 404s with a thrown error; the UI contract is null-for-missing.
      return null;
    }
  },

  /**
   * Save a shape in a workspace. The body is validated against `kind` — strictly — so a body
   * built for the other kind is a 400 here rather than a template that fails the first time
   * someone uses it. A name already taken by a live template of the same kind in the same
   * workspace is a 409; the two KINDS may share a name, since they can never be offered in the
   * same picker.
   */
  async create(
    input: {
      kind: TemplateKind;
      name: string;
      description?: string;
      body: WorkItemTemplateBody | ProjectTemplateBody;
    },
    opts?: { workspace?: string },
  ): Promise<Template> {
    const body: TemplateCreateBody = {
      kind: input.kind,
      name: input.name,
      body: input.body,
      ...compact({ description: input.description }),
    };
    return toTemplate(
      await authedJson<TemplateRow>(`${BASE}${workspaceQuery(opts)}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  },

  /**
   * Rename, re-describe, or rewrite the shape. No `kind`: what a template makes is its identity,
   * and re-kinding one would re-read a stored body against a schema it was never written for —
   * so a `body` here is checked against the STORED kind.
   *
   * A `body` patch REPLACES the shape rather than merging into it, which is the only honest
   * reading: merging would leave no way to delete a checklist step or drop a column.
   */
  async update(id: string, patch: TemplatePatchBody): Promise<Template> {
    const body: TemplatePatchBody = compact(patch);
    return toTemplate(
      await authedJson<TemplateRow>(`${BASE}/${enc(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    );
  },

  /** Retire a template. Nothing it made is touched — see the file header. The name frees up for
   *  re-use immediately. */
  remove(id: string): Promise<void> {
    return authedRequest(`${BASE}/${enc(id)}`, { method: "DELETE" });
  },

  /**
   * Build a card — and its checklist — on a board. `projectId` is the only thing the template
   * cannot carry (a board id means nothing to a workspace-level shape); the column, plan point
   * and cycle are optional
   * and fall back to the board's own defaults, and naming any of them applies it to the CHILDREN
   * too, because a checklist that lands in a different column than its parent is not a checklist.
   *
   * `title` re-titles the parent only. Everything that comes back is an ORDINARY card — numbered,
   * ranked, labelled and accepted — so a board can splice them into the list it already holds.
   */
  async instantiateWorkItem(
    id: string,
    input: TemplateInstantiateWorkItemBody,
  ): Promise<{ item: WorkItem; children: WorkItem[] }> {
    const body: TemplateInstantiateWorkItemBody = {
      projectId: input.projectId,
      ...compact({
        title: input.title,
        statusId: input.statusId,
        milestoneId: input.milestoneId,
        iterationId: input.iterationId,
      }),
    };
    const res = await authedJson<TemplateInstantiateWorkItemResult>(
      `${BASE}/${enc(id)}/work-items`,
      { method: "POST", body: JSON.stringify(body) },
    );
    return { item: toWorkItem(res.item), children: res.children.map(toWorkItem) };
  },

  /**
   * Build a whole board from a shape: its columns, its estimate scale, and its plan points.
   *
   * `name` is the one thing a board template does not supply, because the key prefix is allocated
   * from it. `workspace` names where the board LANDS, which need not be where the template lives —
   * so a shared shape can be stamped into any workspace the caller may create in.
   *
   * The milestones come back UNDATED, in the body's order: a plan point's date is a fact about
   * one delivery, so seeding the template's would hand you a plan already overdue.
   */
  async instantiateProject(
    id: string,
    input: { name: string; description?: string },
    opts?: { workspace?: string },
  ): Promise<{ project: Project; milestones: Milestone[] }> {
    const body: TemplateInstantiateProjectBody = {
      name: input.name,
      ...compact({ description: input.description }),
    };
    const res = await authedJson<TemplateInstantiateProjectResult>(
      `${BASE}/${enc(id)}/projects${workspaceQuery(opts)}`,
      { method: "POST", body: JSON.stringify(body) },
    );
    return {
      project: toProject(res.project),
      milestones: res.milestones.map(toMilestone),
    };
  },
};
