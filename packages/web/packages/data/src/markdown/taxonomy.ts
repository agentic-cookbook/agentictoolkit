// Writes to the shared taxonomy — renaming, filing, unfiling and retiring the CATEGORIES and
// TAGS that `markdownApi.categoryTree()` / `.tagSet()` read.
//
// These go to a DIFFERENT surface than everything else in this folder: the generic CRUD
// door (`/content/categories`, `/content/category-edges`, `/content/keywords`), not
// `/content/markdown/*`. That is not
// an inconsistency to tidy away — it is where those operations live. The markdown surface
// owns exactly one taxonomy write, `POST /content/markdown/categories`, and only because a
// nested create needs the workspace's owner principal resolved for it. Rename, file, unfile and
// delete address a row BY ID, which is already unambiguous, so re-publishing them here would
// be a second representation of the generic layer's own behaviour.
//
// Two consequences of that door worth knowing before calling any of this:
//
//   1. **No `?workspace=`.** These tables are scoped by `customer_id` + `ecosystem_id`, and
//      the generic layer treats `customer_id` as an OWNERSHIP stamp rather than a read
//      filter — a platform principal addresses any row in their own ecosystem. So an
//      org-owned category is reachable without naming the workspace, and passing one would
//      not narrow anything (the workspace pin only applies to tables with owner_kind /
//      owner_id columns, which these do not have).
//   2. **DELETE is a tombstone, and on a CATEGORY it cascades.** Both tables are
//      sync-registered, so the row is stamped `deleted_at` and every read on the markdown
//      surface stops seeing it: the browse lists, a document's own `category`/`tags`, and
//      the `?category=`/`?tag=` filters. Documents under a deleted category come back
//      UNCATEGORIZED rather than keeping a name nothing lists — the delete removes the
//      FILING, never the filed thing. Child CATEGORIES are the one exception: a child left
//      with no live parent has nowhere to be, so the backend retires it too, transitively,
//      inside the delete's own transaction. A child still filed under another live parent
//      is untouched. See `deleteCategory` below.
//
// PUT is partial (PATCH semantics on the generic layer), so each call sends only the field
// it changes and cannot clobber a colour, description or sort order it never asked about.
import { authedJson, authedRequest } from "../http";
import { enc } from "../client-helpers";
import type { MarkdownCategoryEdge, MarkdownCategoryNode, MarkdownKeywordNode } from "./wire";

const CATEGORIES = "/api/content/categories";
const CATEGORY_EDGES = "/api/content/category-edges";
const KEYWORDS = "/api/content/keywords";

export const taxonomyApi = {
  /** Rename a category. Every doc classified under it follows, because the link points at
   *  the id — the name is not copied onto anything. */
  async renameCategory(id: string, name: string): Promise<MarkdownCategoryNode> {
    return authedJson<MarkdownCategoryNode>(`${CATEGORIES}/${enc(id)}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
  },

  /** The LIVE parent links of one category — the rows behind its `parentIds`.
   *
   *  A node carries the parent ids but not the EDGE ids, and an edge is what a removal
   *  addresses. Rather than widen the read shape for every consumer (the rail only ever
   *  draws parents), the writers that need edge ids fetch them here, at the moment they
   *  write — which also means they act on the CURRENT links rather than on whatever the
   *  screen was rendered from. */
  async categoryParents(childId: string): Promise<MarkdownCategoryEdge[]> {
    return authedJson<MarkdownCategoryEdge[]>(`${CATEGORY_EDGES}?childId=${enc(childId)}`);
  },

  /** File a category under one more parent.
   *
   *  This is the ONE operation `POST /content/markdown/categories` deliberately refuses: a
   *  create that silently re-filed an existing name would be a mutation wearing a create's
   *  clothes, so it answers 409 and the link belongs here, addressed by id.
   *
   *  The backend refuses a link that would close a CYCLE (409) and a self-link (400) — the
   *  one rule the schema cannot state, since Postgres has no reachability constraint. A UI
   *  that has already filtered its own menu still has to handle both: the graph it filtered
   *  against is a snapshot, and someone else may have moved a branch since. */
  async addCategoryParent(childId: string, parentId: string): Promise<MarkdownCategoryEdge> {
    return authedJson<MarkdownCategoryEdge>(CATEGORY_EDGES, {
      method: "POST",
      body: JSON.stringify({ childId, parentId }),
    });
  },

  /** Unfile a category from one parent. Does nothing when the link is already gone, so a
   *  double-click and a retry cost the same as one call. */
  async removeCategoryParent(childId: string, parentId: string): Promise<void> {
    const edges = await this.categoryParents(childId);
    for (const edge of edges.filter((e) => e.parentId === parentId)) {
      await authedRequest(`${CATEGORY_EDGES}/${enc(edge.id)}`, { method: "DELETE" });
    }
  },

  /** Retire a category (tombstone). Its documents become uncategorized.
   *
   *  Its CHILDREN follow it only when they are filed NOWHERE ELSE. A child with another
   *  live parent is still filed there and still browsable — that is the difference a DAG
   *  makes. The cascade is the backend's (see `crud/category-edges.ts`), so every door into
   *  the endpoint obeys it and a concurrent re-filing cannot race a caller's own walk. */
  async deleteCategory(id: string): Promise<void> {
    await authedRequest(`${CATEGORIES}/${enc(id)}`, { method: "DELETE" });
  },

  /** Rename a tag. Same id-not-text reasoning as a category: every card and document
   *  wearing it follows. */
  async renameTag(id: string, label: string): Promise<MarkdownKeywordNode> {
    return authedJson<MarkdownKeywordNode>(`${KEYWORDS}/${enc(id)}`, {
      method: "PUT",
      body: JSON.stringify({ label }),
    });
  },

  /** Retire a tag (tombstone). Unlike a category, re-typing the same label later REVIVES
   *  this exact row — labels are unique per owner, so there is a row to revive into — and
   *  its old links come back with it. */
  async deleteTag(id: string): Promise<void> {
    await authedRequest(`${KEYWORDS}/${enc(id)}`, { method: "DELETE" });
  },
};
