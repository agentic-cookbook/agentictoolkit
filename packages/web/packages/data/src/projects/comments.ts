// Work-item comments API client — the CONVERSATION on a card, wired to
// `/api/project/work-items/{id}/comments` (read + write) and `/api/project/comments/{id}`
// (edit + remove).
//
// Separate from `./activity` on purpose. The activity trail is an append-only record of what
// happened to a card and is read newest-first in keyset pages; a conversation is read
// oldest-first in full, because a reply only makes sense after the thing it replies to. Every
// write here still LANDS in that trail (comment.added / .edited / .deleted) — the backend does
// it in the same transaction — so the two surfaces stay one story told two ways, and this
// client never has to append anything itself.
//
// Threading is ONE level deep by construction: replying to a reply re-parents onto the root, so
// a caller can group by `parentId` without recursing (see `threadOf`).

import { authedJson, authedRequest } from "../http";
import { enc, narrow } from "../client-helpers";
import type { CommentCreateBody, CommentUpdateBody, ProjectCommentRow } from "./wire";

const ITEMS = "/api/project/work-items";
const COMMENTS = "/api/project/comments";

/**
 * How a comment names itself to the polymorphic reaction store (`@agentic-toolkit/data/reactions`):
 * its TABLE, `project.comments`.
 *
 * Reactions are deliberately not a comment endpoint — a `(targetKind, targetId)` store already
 * exists and takes any subject, so a second reaction surface under `/project` would be the same
 * fact written twice. The one thing that arrangement needs is for both sides to spell the kind
 * identically forever, which is why the string is a constant HERE, next to the rows it names,
 * rather than a literal at each call site.
 */
export const COMMENT_REACTION_KIND = "project.comments";

/**
 * Who wrote a comment. A closed set the backend enforces, named here because a consumer must be
 * able to say it in a signature: a persona's words are attributed differently from a person's,
 * and "the team" differently again. An author kind this client does not recognize maps to
 * `customer` — the reading that claims the least (a plain author with a label), never a
 * synthetic one that would let an unknown value pose as an agent.
 */
export type CommentAuthorKind = "customer" | "persona" | "team";

const AUTHOR_KINDS: readonly CommentAuthorKind[] = ["customer", "persona", "team"];

/** One comment on a work item. */
export interface ProjectComment {
  id: string;
  projectId: string;
  workItemId: string;
  /** the comment this one replies to; null for a top-level comment. */
  parentId: string | null;
  authorKind: CommentAuthorKind;
  /** the author's principal id — a user id, a persona id, or a team id per `authorKind`. */
  authorId: string | null;
  /** how the author was named at the time of writing (an email, a persona handle). */
  authorLabel: string | null;
  body: string;
  /** set the first time the body changed; null while the text is as first written. */
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toProjectComment(r: ProjectCommentRow): ProjectComment {
  return {
    id: r.id,
    projectId: r.projectId,
    workItemId: r.workItemId,
    parentId: r.parentId ?? null,
    authorKind: narrow(r.authorKind ?? "", AUTHOR_KINDS, "customer"),
    authorId: r.authorId ?? null,
    authorLabel: r.authorLabel ?? null,
    body: r.body,
    editedAt: r.editedAt ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** A top-level comment together with the replies filed against it, oldest-first. */
export interface CommentThread {
  comment: ProjectComment;
  replies: ProjectComment[];
}

/**
 * Group a flat, oldest-first comment list into its threads.
 *
 * The backend flattens a reply-to-a-reply onto the root, so this needs no recursion — and that
 * invariant is exactly why the grouping lives HERE rather than in each surface that renders a
 * conversation: it is a fact about the model, not about any one pane.
 *
 * A reply whose parent is not in the list is promoted to a root rather than dropped. That happens
 * for real (the parent was removed while this reply stands), and silently swallowing the reply
 * would lose someone's words to a rendering detail.
 */
export function threadOf(comments: ProjectComment[]): CommentThread[] {
  const threads = new Map<string, CommentThread>();
  const orphans: ProjectComment[] = [];
  for (const c of comments) {
    if (c.parentId === null) threads.set(c.id, { comment: c, replies: [] });
  }
  for (const c of comments) {
    if (c.parentId === null) continue;
    const parent = threads.get(c.parentId);
    if (parent) parent.replies.push(c);
    else orphans.push(c);
  }
  // Roots keep the server's arrival order; a promoted orphan joins the end, where its own
  // `createdAt` still reads correctly against the ones above it.
  return [...threads.values(), ...orphans.map((c) => ({ comment: c, replies: [] }))];
}

export const projectCommentsApi = {
  /** Every live comment on the card, OLDEST-first (the server's order — a conversation reads
   *  forward). Soft-deleted comments are already gone from this. */
  async list(workItemId: string): Promise<ProjectComment[]> {
    const rows = await authedJson<ProjectCommentRow[]>(
      `${ITEMS}/${enc(workItemId)}/comments`,
    );
    return rows.map(toProjectComment);
  },

  /** Post a comment, optionally as a reply. The card may be addressed by id OR by its item key
   *  (`ADH-42`) — the backend resolves either. */
  async add(workItemId: string, body: string, parentId?: string): Promise<ProjectComment> {
    const payload: CommentCreateBody = parentId ? { body, parentId } : { body };
    return toProjectComment(
      await authedJson<ProjectCommentRow>(`${ITEMS}/${enc(workItemId)}/comments`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
  },

  /** Rewrite one's OWN comment. The backend refuses anyone else — an editing verb on the project
   *  does not let a moderator put words in someone's mouth; it lets them remove them. */
  async edit(commentId: string, body: string): Promise<ProjectComment> {
    const payload: CommentUpdateBody = { body };
    return toProjectComment(
      await authedJson<ProjectCommentRow>(`${COMMENTS}/${enc(commentId)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    );
  },

  /** Withdraw a comment (the author always; anyone else needs the project's delete verb). Replies
   *  to it are left standing, so a thread does not lose its answers along with its question. */
  remove(commentId: string): Promise<void> {
    return authedRequest(`${COMMENTS}/${enc(commentId)}`, { method: "DELETE" });
  },
};
