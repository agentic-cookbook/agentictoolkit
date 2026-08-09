"use client";

// The board's live wake. One SSE connection per project, shared by every pane that asks
// for it, telling subscribers only THAT something on the board changed — never what.
//
// Payload-less on purpose. The stream is opened outside the tenant transaction (an SSE
// connection is held for minutes; a transaction cannot be), so the sending side has no
// caller to authorize a row against and could not honestly put one on the wire. Sending
// the changed rows would mean re-deriving each subscriber's reach per event, and getting
// that wrong leaks another workspace's card. A wake carries no data, so it cannot leak
// any: every subscriber re-reads through the ordinary REST route it already uses, under
// the RLS it already passes. The cost is a refetch that is sometimes unnecessary; the
// alternative's cost is a card on a screen that should not see it.
//
// It also carries no KIND ("work items changed", "comments changed") for the same reason
// one level down: a classification is a promise the publisher has to keep, and a mutation
// whose kind is mislabelled leaves a pane stale forever with nothing to show for it. Too
// many refetches is visible and cheap; a pane that never updates is neither.
//
// Refcounted at module scope, like the notification stream: the first subscriber opens the
// connection and the last one closes it, so eight panes on one board cost one EventSource.

import { useEffect, useRef } from "react";
import { connectSse, type SseHandle } from "../stream";

/** Where the backend serves a board's wake stream. */
const streamUrl = (projectId: string) =>
  `/api/project/projects/${encodeURIComponent(projectId)}/stream`;

/** The event name the backend writes; see `routes/projects.ts`. */
const EVENT = "project";

/** Poll cadence while SSE is unavailable. Longer than the messaging default (20s) because
 *  a board is not a conversation — and window focus, which `connectSse` also listens for,
 *  is what actually matters for someone coming back to a tab. */
const POLL_INTERVAL_MS = 60_000;

/** Coalescing window. One gesture writes several rows (a bulk edit, a template
 *  instantiation, an iteration rollover), each with its own wake; without this every pane
 *  would refetch once per row. Trailing, so a burst settles into a single read. */
const COALESCE_MS = 150;

interface Live {
  handle: SseHandle;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setTimeout> | null;
}

const live = new Map<string, Live>();

function wake(projectId: string): void {
  const entry = live.get(projectId);
  if (!entry || entry.timer) return;
  entry.timer = setTimeout(() => {
    entry.timer = null;
    // Snapshot: a listener may unsubscribe (unmount) while the set is being walked.
    for (const listener of [...entry.listeners]) listener();
  }, COALESCE_MS);
}

/**
 * Subscribe to a board's changes. `onWake` is called when anything on the project
 * changed — refetch whatever the caller is showing. Returns the unsubscribe function.
 *
 * `onWake` is read from the set at fire time, so a caller that re-subscribes on every
 * render churns the connection; hold it in a `useCallback` or a ref (see `useProjectLive`).
 */
export function subscribeToProject(projectId: string, onWake: () => void): () => void {
  let entry = live.get(projectId);
  if (!entry) {
    const created: Live = {
      // Assigned below — `connectSse` can fire synchronously on a server-less render path,
      // and `wake()` looks the entry up by id rather than closing over it for that reason.
      handle: { close() {} },
      listeners: new Set(),
      timer: null,
    };
    live.set(projectId, created);
    created.handle = connectSse({
      url: streamUrl(projectId),
      event: EVENT,
      // The wake is payload-less; there is nothing to parse.
      onEvent: () => wake(projectId),
      onPoll: () => wake(projectId),
      pollIntervalMs: POLL_INTERVAL_MS,
    });
    entry = created;
  }
  entry.listeners.add(onWake);

  return () => {
    const current = live.get(projectId);
    if (!current) return;
    current.listeners.delete(onWake);
    if (current.listeners.size > 0) return;
    if (current.timer) clearTimeout(current.timer);
    current.handle.close();
    live.delete(projectId);
  };
}

/**
 * Refetch when the board changes. Pass a pane's `reload` — typically
 * `useResourceList(...).reload`, which always hits the network.
 *
 * The callback is held in a ref rather than named as a dependency: a pane's `reload`
 * changes identity whenever its fetcher does (a filter edit, a topic switch), and a
 * subscription keyed on it would tear the shared connection down and open a new one on
 * every keystroke. A null/undefined `projectId` subscribes to nothing, so a pane can call
 * this before its board has resolved.
 */
export function useProjectLive(
  projectId: string | null | undefined,
  onWake: () => void,
): void {
  const latest = useRef(onWake);
  useEffect(() => {
    latest.current = onWake;
  }, [onWake]);

  useEffect(() => {
    if (!projectId) return;
    return subscribeToProject(projectId, () => latest.current());
  }, [projectId]);
}
