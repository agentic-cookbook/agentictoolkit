// Reactions API client — emoji reactions on ANY subject, wired to `/api/content/reactions`.
//
// The backend store is polymorphic: a reaction names its subject as a free `(targetKind,
// targetId)` pair, so there is exactly ONE reaction surface for the whole product and a new
// thing to react to needs no new table, route, or client — only a kind string. That is why this
// is its own data domain rather than a corner of the domain that happens to be first to use it:
// a comment, a discussion post and a research document all reach it the same way.
//
// Three things the surface does that a caller must not re-derive:
//   • ADDING is idempotent on (actor, target, emoji) — a repeat POST returns the existing row
//     rather than a 409, so a double-click is not an error to handle.
//   • REMOVING is by the REACTION's id, not by the emoji — which is why `tally` hands back the
//     caller's own reaction id rather than a bare boolean.
//   • The list is PUBLIC within the ecosystem (everyone sees who reacted); only writes are
//     scoped to the actor, so nobody can forge or clear someone else's.

import { authedJson, authedRequest } from "../http";
import { enc } from "../client-helpers";
import type { ReactionCreateBody, ReactionRow } from "./wire";

const BASE = "/api/content/reactions";

/** The backend's cap on one batched read. Chunking against it lives in `list` so no caller has
 *  to know the number — a thread long enough to exceed it would otherwise 400 the whole pane. */
const MAX_TARGET_IDS = 200;

/** One actor's one emoji on one subject. */
export interface Reaction {
  id: string;
  /** the user who reacted. */
  customerId: string;
  targetKind: string;
  targetId: string;
  emoji: string;
  createdAt: string;
}

export function toReaction(r: ReactionRow): Reaction {
  return {
    id: r.id,
    customerId: r.customerId,
    targetKind: r.targetKind,
    targetId: r.targetId,
    emoji: r.emoji,
    createdAt: r.createdAt,
  };
}

/** How one emoji stands on one subject: how many chose it, and — when the viewer is among them —
 *  the id of THEIR reaction, which is what un-reacting has to address. */
export interface ReactionTally {
  emoji: string;
  count: number;
  /** the viewer's own reaction id, or null when they have not reacted with this emoji. */
  mine: string | null;
}

/**
 * Fold a subject's reactions into one tally per emoji, most-chosen first (ties keep the order
 * the emoji first appeared, so a bar does not reshuffle as counts even up).
 *
 * `viewerId` is the reader's user id (`readTokenSubject()`); pass null when unknown and every
 * tally reads as not-mine — a bar that shows counts but cannot claim one, which is the honest
 * rendering rather than a wrong one.
 */
export function tally(reactions: Reaction[], viewerId: string | null): ReactionTally[] {
  const byEmoji = new Map<string, ReactionTally>();
  for (const r of reactions) {
    const t = byEmoji.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: null };
    t.count += 1;
    if (viewerId && r.customerId === viewerId) t.mine = r.id;
    byEmoji.set(r.emoji, t);
  }
  return [...byEmoji.values()].sort((a, b) => b.count - a.count);
}

/** Group reactions by the subject they are on — how a batched read is unpacked for rendering. */
export function byTarget(reactions: Reaction[]): Map<string, Reaction[]> {
  const groups = new Map<string, Reaction[]>();
  for (const r of reactions) {
    const bucket = groups.get(r.targetId);
    if (bucket) bucket.push(r);
    else groups.set(r.targetId, [r]);
  }
  return groups;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const reactionsApi = {
  /**
   * Every live reaction on the given subjects, in ONE request per {@link MAX_TARGET_IDS}
   * subjects — the point of the batch: a pane rendering N comments reads their reactions once
   * instead of N times. Each row carries its own `targetId`, so {@link byTarget} unpacks it.
   *
   * An empty `targetIds` resolves to an empty list without a request: the backend requires at
   * least one, and a pane whose list has not arrived yet should not send a call it knows is a 400.
   */
  async list(targetKind: string, targetIds: string[]): Promise<Reaction[]> {
    const ids = [...new Set(targetIds.filter(Boolean))];
    if (ids.length === 0) return [];
    const pages = await Promise.all(
      chunk(ids, MAX_TARGET_IDS).map((batch) =>
        authedJson<{ items: ReactionRow[] }>(
          `${BASE}?targetKind=${enc(targetKind)}&targetIds=${enc(batch.join(","))}`,
        ),
      ),
    );
    return pages.flatMap((p) => p.items.map(toReaction));
  },

  /** React. Idempotent: reacting again with the same emoji returns the reaction already there. */
  async add(targetKind: string, targetId: string, emoji: string): Promise<Reaction> {
    const payload: ReactionCreateBody = { targetKind, targetId, emoji };
    return toReaction(
      await authedJson<ReactionRow>(BASE, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
  },

  /** Take back one of your OWN reactions, addressed by its id ({@link ReactionTally.mine}). */
  remove(reactionId: string): Promise<void> {
    return authedRequest(`${BASE}/${enc(reactionId)}`, { method: "DELETE" });
  },
};
