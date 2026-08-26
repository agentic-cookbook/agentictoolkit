"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Pencil, Reply, Trash2 } from "lucide-react";
import { AlertModal } from "@agenticdevelopertoolkit/ui/components/alert-modal";
import { Badge } from "@agenticdevelopertoolkit/ui/components/badge";
import { Button } from "@agenticdevelopertoolkit/ui/components/button";
import { ErrorText } from "@agenticdevelopertoolkit/ui/components/error-text";
import { ReactionBar, type ReactionBarItem } from "@agenticdevelopertoolkit/ui/components/reaction-bar";
import { Textarea } from "@agenticdevelopertoolkit/ui/components/textarea";
import { readTokenSubject, useResourceList } from "@agentic-toolkit/data";
import {
  COMMENT_REACTION_KIND,
  projectCommentsApi,
  threadOf,
  type ProjectComment,
} from "@agentic-toolkit/data/projects";
import { byTarget, reactionsApi, tally, type Reaction } from "@agentic-toolkit/data/reactions";
import { authorText, relativeTime } from "./helpers";

/**
 * THE CONVERSATION ON A CARD — the comments section of the work-item detail pane.
 *
 * A sibling of Relations, and here for the same reason: a comment is not a value the card
 * holds, so no column and no field could ever show it. The difference is that a relation is a
 * fact and a comment is someone's writing — which is why this section can edit and withdraw its
 * rows where Relations only adds and unlinks.
 *
 * Threading is ONE level. The backend re-parents a reply-to-a-reply onto the root, so "Reply" is
 * offered on top-level comments only: offering it on a reply and then silently filing the answer
 * somewhere else is worse than not offering it.
 *
 * WHO MAY DO WHAT, and how this pane knows:
 *   • EDIT is the author's alone — that is knowable here (the comment carries its author, and
 *     `readTokenSubject()` is the viewer), so the control simply is not rendered for anyone else.
 *     A moderating verb lets someone REMOVE words, never rewrite them into different ones.
 *   • REMOVE is the author's OR anyone holding the project's delete verb — which this pane
 *     cannot know, because reach is computed server-side from roles the client never sees. It is
 *     therefore offered on every comment and the refusal is surfaced as an error. That is the
 *     right way round here rather than a guess: the implicit `user` role every team member gets
 *     already carries the verb, so a viewer who can read the thread can almost always act on it,
 *     and hiding the control would deny the common case to spare the rare one.
 *
 * Reactions ride the platform's polymorphic store, not a comments endpoint — see
 * COMMENT_REACTION_KIND. They are read for the WHOLE thread in one batched request, so a long
 * conversation costs one call, not one per comment.
 */

/** Composer copy — one place, because the same words are the placeholder AND the accessible name
 *  on both the new-comment box and each reply box. */
const COMPOSER_LABEL = "Add a comment";
const REPLY_LABEL = "Write a reply";

/** A comment is submitted with ⌘/Ctrl+Enter, never bare Enter: the body is prose and a plain
 *  Enter has to stay available for a new paragraph. */
function isSubmitChord(e: React.KeyboardEvent): boolean {
  return e.key === "Enter" && (e.metaKey || e.ctrlKey);
}

/** A multi-line composer with its own send button — the new-comment box, the reply box under a
 *  thread, and the edit box over an existing comment are all this, differing only in wording. */
function Composer({
  label,
  value,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  busy,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  /** Present on the reply/edit boxes, which are dismissable; absent on the always-open composer. */
  onCancel?: () => void;
  submitLabel: string;
  busy: boolean;
  autoFocus?: boolean;
}): ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Textarea
        value={value}
        rows={3}
        aria-label={label}
        placeholder={`${label}…`}
        disabled={busy}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (isSubmitChord(e)) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={busy || !value.trim()}
          onClick={onSubmit}
        >
          {busy ? "Saving…" : submitLabel}
        </Button>
        {onCancel ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** One comment: who wrote it, when, the words, its reactions, and what may be done to it. */
function CommentRow({
  comment,
  reactions,
  viewerId,
  isReply,
  busy,
  editing,
  editDraft,
  onEditDraftChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onReply,
  onRemove,
  onToggleReaction,
}: {
  comment: ProjectComment;
  reactions: ReactionBarItem[];
  viewerId: string | null;
  /** Replies are inset so a thread reads as a thread rather than a flat run of comments. */
  isReply: boolean;
  busy: boolean;
  editing: boolean;
  editDraft: string;
  onEditDraftChange: (next: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  /** Absent on a reply — the backend flattens, so there is nothing below this level to reply to. */
  onReply?: () => void;
  onRemove: () => void;
  onToggleReaction: (emoji: string) => void;
}): ReactElement {
  const author = authorText(comment);
  const mine = viewerId !== null && comment.authorId === viewerId;

  return (
    <li className={isReply ? "flex min-w-0 flex-col gap-1.5 pl-6" : "flex min-w-0 flex-col gap-1.5"}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-medium text-apt-text">{author}</span>
        {/* Only a NON-human author is badged. Badging "customer" on every ordinary comment
            would be noise; the thing worth knowing at a glance is when an agent is talking. */}
        {comment.authorKind === "persona" ? <Badge variant="blue">Persona</Badge> : null}
        {comment.authorKind === "team" ? <Badge variant="neutral">Team</Badge> : null}
        <time dateTime={comment.createdAt} className="text-xs text-apt-text-dim">
          {relativeTime(comment.createdAt)}
        </time>
        {/* The fact of an edit, not its history — the trail holds the previous text, and this
            line's job is only to stop a changed comment from reading as the original. */}
        {comment.editedAt ? (
          <time dateTime={comment.editedAt} className="text-xs text-apt-text-dim">
            (edited)
          </time>
        ) : null}
      </div>

      {editing ? (
        <Composer
          label={`Edit ${author}'s comment`}
          value={editDraft}
          onChange={onEditDraftChange}
          onSubmit={onSaveEdit}
          onCancel={onCancelEdit}
          submitLabel="Save"
          busy={busy}
          autoFocus
        />
      ) : (
        <p className="whitespace-pre-wrap break-words text-sm text-apt-text">{comment.body}</p>
      )}

      <div className="flex flex-wrap items-center gap-1">
        <ReactionBar
          reactions={reactions}
          onToggle={onToggleReaction}
          busy={busy}
          subjectLabel={`${author}'s comment`}
        />
        {editing ? null : (
          <>
            {onReply ? (
              <Button
                variant="ghost"
                size="xs"
                aria-label={`Reply to ${author}'s comment`}
                disabled={busy}
                onClick={onReply}
              >
                <Reply />
                Reply
              </Button>
            ) : null}
            {mine ? (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Edit ${author}'s comment`}
                disabled={busy}
                onClick={onStartEdit}
              >
                <Pencil />
              </Button>
            ) : null}
            <Button
              variant="destructive-ghost"
              size="icon-xs"
              aria-label={`Remove ${author}'s comment`}
              disabled={busy}
              onClick={onRemove}
            >
              <Trash2 />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

export function WorkItemComments({ workItemId }: { workItemId: string }): ReactElement {
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [removing, setRemoving] = useState<ProjectComment | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  // Guards the write BUSY flags only; the lists' own out-of-order and after-unmount handling
  // belongs to useResourceList.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Read at render, the same way `useTenantId` does — off-browser it is null, which is exactly
  // what an SSR pass should conclude, and the reactions it feeds have not loaded then anyway.
  const viewerId = readTokenSubject();

  const loadComments = useCallback(
    () => projectCommentsApi.list(workItemId),
    [workItemId],
  );
  const {
    items: comments,
    reload: reloadComments,
    error: loadError,
  } = useResourceList<ProjectComment>(`work-item:${workItemId}:comments`, loadComments);

  // The reaction read is keyed off the comment ids as a STRING, so the fetcher's identity — and
  // therefore the refetch — changes exactly when the set of subjects does, not on every render
  // that produces a new array. That is also what makes an add or a remove refresh the bar without
  // a second call here: reloading the comments changes the fingerprint, which re-issues the batch.
  //
  // The cache key stays per-card, NOT per-fingerprint: a remount seeds `comments` from cache on
  // its very first render, so the fingerprint is already correct by then and the reactions seed
  // alongside it. A fingerprinted key would instead mint a fresh cache entry per comment ever
  // added, for a repaint that already happens.
  const idKey = (comments ?? []).map((c) => c.id).join(",");
  const loadReactions = useCallback(
    () => reactionsApi.list(COMMENT_REACTION_KIND, idKey ? idKey.split(",") : []),
    [idKey],
  );
  const {
    items: reactions,
    reload: reloadReactions,
    error: reactionsError,
  } = useResourceList<Reaction>(`work-item:${workItemId}:comment-reactions`, loadReactions);

  const threads = useMemo(() => threadOf(comments ?? []), [comments]);
  const reactionsByComment = useMemo(() => byTarget(reactions ?? []), [reactions]);

  const barFor = useCallback(
    (commentId: string): ReactionBarItem[] =>
      tally(reactionsByComment.get(commentId) ?? [], viewerId).map((t) => ({
        emoji: t.emoji,
        count: t.count,
        mine: t.mine !== null,
      })),
    [reactionsByComment, viewerId],
  );

  /** Every write here is the same shape: clear the last error, run it, refresh, and report a
   *  failure in words the section can show. Written once so five call sites cannot drift. */
  async function write(
    id: string | null,
    fallback: string,
    op: () => Promise<void>,
  ): Promise<boolean> {
    setWriteError(null);
    setBusyId(id);
    if (id === null) setPosting(true);
    try {
      await op();
      // The reload's own promise rejects on failure; the hook has already surfaced it as
      // `loadError`, so there is nothing left for this caller to do with it.
      await reloadComments().catch(() => {});
      return true;
    } catch (e) {
      if (mounted.current) setWriteError(e instanceof Error ? e.message : fallback);
      return false;
    } finally {
      if (mounted.current) {
        setBusyId(null);
        setPosting(false);
      }
    }
  }

  async function post(): Promise<void> {
    const body = draft.trim();
    if (!body || posting) return;
    const ok = await write(null, "Failed to post the comment.", async () => {
      await projectCommentsApi.add(workItemId, body);
    });
    if (ok && mounted.current) setDraft("");
  }

  async function postReply(parentId: string): Promise<void> {
    const body = replyDraft.trim();
    if (!body) return;
    const ok = await write(parentId, "Failed to post the reply.", async () => {
      await projectCommentsApi.add(workItemId, body, parentId);
    });
    if (ok && mounted.current) {
      setReplyTo(null);
      setReplyDraft("");
    }
  }

  async function saveEdit(comment: ProjectComment): Promise<void> {
    const body = editDraft.trim();
    if (!body) return;
    const ok = await write(comment.id, "Failed to save the comment.", async () => {
      await projectCommentsApi.edit(comment.id, body);
    });
    if (ok && mounted.current) {
      setEditingId(null);
      setEditDraft("");
    }
  }

  async function remove(comment: ProjectComment): Promise<void> {
    await write(comment.id, "Failed to remove the comment.", async () => {
      await projectCommentsApi.remove(comment.id);
    });
    // No reaction reload: the withdrawn comment drops out of the fingerprint below, which
    // re-issues the batch by itself — and the reactions it leaves in the store are keyed to an id
    // this pane no longer asks about, so there is nothing to clean up either.
    if (mounted.current) setRemoving(null);
  }

  /** Toggle the viewer's own reaction. `mine` carries the reaction's id, which is what removing
   *  addresses — an emoji alone would not say WHOSE reaction to take back. */
  async function toggleReaction(commentId: string, emoji: string): Promise<void> {
    const own = tally(reactionsByComment.get(commentId) ?? [], viewerId).find(
      (t) => t.emoji === emoji,
    );
    setWriteError(null);
    setBusyId(commentId);
    try {
      if (own?.mine) await reactionsApi.remove(own.mine);
      else await reactionsApi.add(COMMENT_REACTION_KIND, commentId, emoji);
      await reloadReactions().catch(() => {});
    } catch (e) {
      if (mounted.current) {
        setWriteError(e instanceof Error ? e.message : "Failed to change the reaction.");
      }
    } finally {
      if (mounted.current) setBusyId(null);
    }
  }

  function startEdit(comment: ProjectComment): void {
    setWriteError(null);
    setReplyTo(null);
    setEditingId(comment.id);
    setEditDraft(comment.body);
  }

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="Comments">
      <h3 className="font-mono text-xs tracking-[0.02em] text-apt-text-dim">Comments</h3>
      <ErrorText error={loadError} />
      <ErrorText error={reactionsError} />
      <ErrorText error={writeError} />

      {comments === null ? (
        // Only while the read is genuinely outstanding: with the error above, "Loading…" is a
        // promise the section is not keeping, and "No comments yet" would assert a fact it does
        // not have.
        loadError ? null : (
          <p className="text-sm text-apt-text-muted">Loading…</p>
        )
      ) : threads.length > 0 ? (
        <ul className="flex min-w-0 flex-col gap-4">
          {threads.map((thread) => (
            <li key={thread.comment.id} className="flex min-w-0 flex-col gap-3">
              <ul className="flex min-w-0 flex-col gap-3">
                <CommentRow
                  comment={thread.comment}
                  reactions={barFor(thread.comment.id)}
                  viewerId={viewerId}
                  isReply={false}
                  busy={busyId === thread.comment.id}
                  editing={editingId === thread.comment.id}
                  editDraft={editDraft}
                  onEditDraftChange={setEditDraft}
                  onStartEdit={() => startEdit(thread.comment)}
                  onCancelEdit={() => setEditingId(null)}
                  onSaveEdit={() => void saveEdit(thread.comment)}
                  onReply={() => {
                    setWriteError(null);
                    setEditingId(null);
                    setReplyTo(thread.comment.id);
                    setReplyDraft("");
                  }}
                  onRemove={() => setRemoving(thread.comment)}
                  onToggleReaction={(emoji) => void toggleReaction(thread.comment.id, emoji)}
                />
                {thread.replies.map((reply) => (
                  <CommentRow
                    key={reply.id}
                    comment={reply}
                    reactions={barFor(reply.id)}
                    viewerId={viewerId}
                    isReply
                    busy={busyId === reply.id}
                    editing={editingId === reply.id}
                    editDraft={editDraft}
                    onEditDraftChange={setEditDraft}
                    onStartEdit={() => startEdit(reply)}
                    onCancelEdit={() => setEditingId(null)}
                    onSaveEdit={() => void saveEdit(reply)}
                    onRemove={() => setRemoving(reply)}
                    onToggleReaction={(emoji) => void toggleReaction(reply.id, emoji)}
                  />
                ))}
              </ul>
              {replyTo === thread.comment.id ? (
                <div className="pl-6">
                  <Composer
                    label={REPLY_LABEL}
                    value={replyDraft}
                    onChange={setReplyDraft}
                    onSubmit={() => void postReply(thread.comment.id)}
                    onCancel={() => {
                      setReplyTo(null);
                      setReplyDraft("");
                    }}
                    submitLabel="Reply"
                    busy={busyId === thread.comment.id}
                    autoFocus
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        // A plain line rather than an EmptyState block, matching the sibling Relations section:
        // this sits inside a details pane that is already a dense run of rows, and a bordered
        // empty panel would read as the loudest thing on it.
        <p className="text-sm text-apt-text-muted">No comments yet.</p>
      )}

      <Composer
        label={COMPOSER_LABEL}
        value={draft}
        onChange={(next) => {
          setWriteError(null);
          setDraft(next);
        }}
        onSubmit={() => void post()}
        submitLabel="Comment"
        busy={posting}
      />

      {/* Removing a comment takes away someone's words — unlike unlinking a relation next door,
          which takes away a claim about two cards and needs no confirm. Replies are left
          standing, and the modal says so rather than letting someone discover it after.
          `destructive` alone carries the whole policy (error tone, red action, cancel-first
          focus, no Enter-to-confirm), so nothing below restates a piece of it. */}
      <AlertModal
        open={removing !== null}
        title="Remove this comment?"
        description={
          removing
            ? `${authorText(removing)}'s comment will no longer be shown. Any replies to it stay. The activity trail keeps a record that it was removed.`
            : undefined
        }
        destructive
        confirmLabel="Remove"
        cancelLabel="Keep"
        busy={removing !== null && busyId === removing.id}
        onConfirm={() => {
          if (removing) void remove(removing);
        }}
        onCancel={() => setRemoving(null)}
      />
    </section>
  );
}
