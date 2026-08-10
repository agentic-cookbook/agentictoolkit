// Writes to the shared taxonomy — renaming, re-parenting and retiring the CATEGORIES and
// TAGS that `markdownApi.categoryTree()` / `.tagSet()` read.
//
// These go to a DIFFERENT surface than everything else in this folder: the generic CRUD
// door (`/content/categories`, `/content/keywords`), not `/content/markdown/*`. That is not
// an inconsistency to tidy away — it is where those operations live. The markdown surface
// owns exactly one taxonomy write, `POST /content/markdown/categories`, and only because a
// nested create needs the workspace's owner principal resolved for it. Rename, reparent and
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
//   2. **DELETE is a tombstone.** Both tables are sync-registered, so the row is stamped
//      `deleted_at` and every read on the markdown surface stops seeing it: the browse
//      lists, a document's own `category`/`tags`, and the `?category=`/`?tag=` filters.
//      Documents under a deleted category come back UNCATEGORIZED rather than keeping a
//      name nothing lists.
//
// PUT is partial (PATCH semantics on the generic layer), so each call sends only the field
// it changes and cannot clobber a colour, description or sort order it never asked about.
import { authedJson, authedRequest } from "../http";
import { enc } from "../client-helpers";
import type { MarkdownCategoryNode, MarkdownKeywordNode } from "./wire";

const CATEGORIES = "/api/content/categories";
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

  /** Move a category under another one, or to the root (`null`).
   *
   *  This is the ONE operation `POST /content/markdown/categories` deliberately refuses: a
   *  create that silently re-parented an existing name would be a mutation wearing a
   *  create's clothes, so it answers 409 and the move belongs here, addressed by id. */
  async reparentCategory(id: string, parentId: string | null): Promise<MarkdownCategoryNode> {
    return authedJson<MarkdownCategoryNode>(`${CATEGORIES}/${enc(id)}`, {
      method: "PUT",
      body: JSON.stringify({ parentId }),
    });
  },

  /** Retire a category (tombstone). Its documents become uncategorized; its CHILDREN do
   *  not move — `parentId` is an app-level pointer with no FK, so a caller retiring a
   *  subtree must walk it. */
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
