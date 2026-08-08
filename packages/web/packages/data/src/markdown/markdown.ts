// Research documents API client — wired to the backend's markdown-document surface
// (`/content/markdown`, mounted under the hub's `/api` forward; the hub strips
// `/api` before forwarding). These hand-written routes are the sole surface for a
// user's markdown research papers (list/search, CRUD, publish/unpublish); see
// websites/backend/src/routes/markdownDocuments.ts. Row/body shapes live in
// ./wire.ts, narrowed from the generated OpenAPI schema (@agentic-toolkit/adh-api-types) —
// a generic data client must not import that adh-specific package, so a backend contract
// change is only caught by keeping wire.ts in sync, not by the build.
import { authedJson, authedRequest, isConflict } from "../http";
import { enc, workspaceQuery } from "../client-helpers";
import type {
  MarkdownDocumentRow,
  MarkdownDocumentSummaryRow,
  MarkdownListResponse,
  MarkdownCreateBody,
  MarkdownUpdateBody,
  MarkdownPublishBody,
  StringListBody,
  MarkdownCategoryNode,
  MarkdownCategoryTreeBody,
  MarkdownCategoryCreateBody,
} from "./wire";

/** A full document, body included (GET /content/markdown/:id, and the create /
 *  update / publish responses). */
export type ResearchDocument = MarkdownDocumentRow;
/** Document metadata only — no body (the list/search rows). */
export type ResearchSummary = MarkdownDocumentSummaryRow;

export type CreateMarkdownBody = MarkdownCreateBody;
export type UpdateMarkdownBody = MarkdownUpdateBody;

/** One category as this surface exposes it — id, name, and the parent pointer that
 *  makes the set a tree. Re-exported (not aliased) because a hierarchical consumer
 *  passes these rows around, not just their names. */
export type { MarkdownCategoryNode, MarkdownCategoryCreateBody } from "./wire";

/** Caller-scoped list filters, all wired to the backend's query params: `q`
 *  (free-text across title/body/category/tags), `category` (exact), `tag` (set
 *  membership). Absent/blank filters are omitted. */
export interface ResearchFilters {
  q?: string;
  category?: string;
  tag?: string;
}

const BASE = "/api/content/markdown";
// One generous page: a user's own research set is small, and the master list
// shows everything at once (no pagination UI). 200 is the backend's page cap.
const PAGE_SIZE = 200;

/** List options: the workspace to scope to, and `noted` to narrow to the owner's NOTES
 *  (the documents in their `notes` storage bucket). `noted: false` is NOT "everything
 *  except notes" — the backend offers no such set — it is simply the unfiltered list. */
export interface MarkdownListOptions {
  workspace?: string;
  noted?: boolean;
}

function listQuery(filters: ResearchFilters, opts?: MarkdownListOptions): string {
  const params = new URLSearchParams({ pageSize: String(PAGE_SIZE) });
  const q = filters.q?.trim();
  if (q) params.set("q", q);
  const category = filters.category?.trim();
  if (category) params.set("category", category);
  const tag = filters.tag?.trim();
  if (tag) params.set("tag", tag);
  if (opts?.noted) params.set("noted", "true");
  if (opts?.workspace) params.set("workspace", opts.workspace);
  return params.toString();
}

/** Guarantee `tags` is an array. The generated types mark it required, but a
 *  backend deploy OLDER than this frontend (before the category/tags migration)
 *  omits it — and an unguarded `doc.tags` then crashes the list/detail render
 *  (`tags is not iterable` / reading `length` of undefined). Normalizing once at
 *  the API boundary keeps every consumer (model + pane) free of `?? []` guards.
 *  Exported for the unit test. */
export function withTags<T extends { tags: string[] }>(doc: T): T {
  const tags = (doc as { tags?: unknown }).tags;
  return Array.isArray(tags) ? doc : { ...doc, tags: [] };
}

export const markdownApi = {
  // `workspace` on every op pins it to the WORKSPACE'S owning principal (backend
  // `?workspace=<slug>`): list returns only documents that principal OWNS, create
  // stamps it as the owner, and item ops resolve org-owned docs other members
  // created. Without it, ops fall back to the caller's own documents.
  /** List/search the workspace's documents (metadata only), most-recent first. */
  async list(
    filters: ResearchFilters = {},
    opts?: MarkdownListOptions,
  ): Promise<ResearchSummary[]> {
    const res = await authedJson<MarkdownListResponse>(
      `${BASE}?${listQuery(filters, opts)}`,
    );
    return res.items.map(withTags);
  },

  /** Fetch one document WITH its body (the master list omits the body). */
  async get(id: string, opts?: { workspace?: string }): Promise<ResearchDocument> {
    return withTags(
      await authedJson<ResearchDocument>(`${BASE}/${enc(id)}${workspaceQuery(opts)}`),
    );
  },

  async create(
    body: CreateMarkdownBody,
    opts?: { workspace?: string },
  ): Promise<ResearchDocument> {
    return withTags(
      await authedJson<ResearchDocument>(`${BASE}${workspaceQuery(opts)}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  },

  async update(
    id: string,
    body: UpdateMarkdownBody,
    opts?: { workspace?: string },
  ): Promise<ResearchDocument> {
    return withTags(
      await authedJson<ResearchDocument>(`${BASE}/${enc(id)}${workspaceQuery(opts)}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    );
  },

  async remove(id: string, opts?: { workspace?: string }): Promise<void> {
    // 204 No Content — authedRequest, not authedJson (nothing to parse).
    await authedRequest(`${BASE}/${enc(id)}${workspaceQuery(opts)}`, { method: "DELETE" });
  },

  /** Publish under an author-defined public route. The route is unique per
   *  author: a clash with another of the caller's live papers is a 409, mapped
   *  to a friendly message the form surfaces inline. */
  async publish(
    id: string,
    route: string,
    opts?: { workspace?: string },
  ): Promise<ResearchDocument> {
    try {
      return withTags(
        await authedJson<ResearchDocument>(
          `${BASE}/${enc(id)}/publish${workspaceQuery(opts)}`,
          {
            method: "POST",
            body: JSON.stringify({ route } satisfies MarkdownPublishBody),
          },
        ),
      );
    } catch (err) {
      if (isConflict(err)) {
        throw new Error(`The route “${route}” is already used by one of your papers.`);
      }
      throw err;
    }
  },

  /** Revert to a private draft and free the public route. */
  async unpublish(id: string, opts?: { workspace?: string }): Promise<ResearchDocument> {
    return withTags(
      await authedJson<ResearchDocument>(`${BASE}/${enc(id)}/unpublish${workspaceQuery(opts)}`, {
        method: "POST",
      }),
    );
  },

  /** The workspace's existing category NAMES — the autocomplete/browse source for the
   *  category field. The owner's full set (content.categories), distinct + alphabetical
   *  (GET /content/markdown/categories). `workspace` matters: the backend scopes the
   *  vocabulary to the same owner it scopes the documents to, so an org workspace's
   *  autocomplete must ask for the ORG's names, not the caller's own. */
  async categories(opts?: { workspace?: string }): Promise<string[]> {
    return (await authedJson<StringListBody>(`${BASE}/categories${workspaceQuery(opts)}`)).items;
  },

  /** The same categories WITH their structure — `parentId` makes them a tree. The flat
   *  `categories()` above is the autocomplete's view of this one set; a hierarchical
   *  browser needs the ids and parents, which names alone cannot carry. */
  async categoryTree(opts?: { workspace?: string }): Promise<MarkdownCategoryNode[]> {
    const res = await authedJson<MarkdownCategoryTreeBody>(
      `${BASE}/categories${workspaceQuery(opts)}`,
    );
    // A backend older than this client answers with `items` alone; an unguarded `.nodes`
    // would then crash the rail rather than degrade to a flat list.
    return Array.isArray(res.nodes) ? res.nodes : [];
  },

  /** Create a category, optionally under another (POST /content/markdown/categories).
   *  Re-creating an existing name under the SAME parent returns it unchanged; under a
   *  different one the backend refuses with a 409 — a name is unique per owner, and this
   *  call never moves an existing category. */
  async createCategory(
    body: MarkdownCategoryCreateBody,
    opts?: { workspace?: string },
  ): Promise<MarkdownCategoryNode> {
    try {
      return await authedJson<MarkdownCategoryNode>(`${BASE}/categories${workspaceQuery(opts)}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    } catch (err) {
      if (isConflict(err)) {
        throw new Error(`A category named “${body.name}” already exists somewhere else.`);
      }
      throw err;
    }
  },

  /** The workspace's existing tag LABELS — the autocomplete/browse source for the tag
   *  field (GET /content/markdown/tags), same shape + scoping as `categories`. */
  async tags(opts?: { workspace?: string }): Promise<string[]> {
    return (await authedJson<StringListBody>(`${BASE}/tags${workspaceQuery(opts)}`)).items;
  },
};
