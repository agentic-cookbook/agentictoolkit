"use client";

import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { ErrorText } from "@agenticdevelopertoolkit/ui/components/error-text";
import { EmptyState } from "@agenticdevelopertoolkit/ui/components/empty-state";
import { List, ListItem } from "@agenticdevelopertoolkit/ui/components/list";
import { Button } from "@agenticdevelopertoolkit/ui/components/button";
import type { ActivityPage, ProjectActivity } from "@agentic-toolkit/data/projects";
import { actorText, actionPhrase, commentBody, relativeTime } from "./helpers";
import { DEFAULT_ITEM_WORDS, type ItemWords } from "./vocabulary";

/**
 * A reusable keyset-paginated activity feed — the hub's first cursor-paginated UI.
 * Given a `load(before?)` that returns a newest-first `{ rows, nextBefore }` page,
 * it renders the first page on mount and appends older pages on demand via a
 * "Load older" control (hidden once `nextBefore` is null — no more history).
 *
 * The feed loads once per mount: it captures `load` on first render, so an inline
 * `load` closure never re-triggers a fetch. To force a refresh (e.g. after posting
 * a comment) the caller re-mounts it with a changing `key` — the documented idiom
 * both project- and work-item-scoped callers use. "Load older" always calls the
 * live `load` prop with the current `nextBefore` cursor.
 *
 * Each row phrases the raw `action` into human text (comments show their body) with
 * the actor and a relative timestamp. Loading / empty / error states are handled;
 * colors are `apt-*` tokens only.
 */

/** Page size for a keyset request — one authoritative value both callers pass. */
export const ACTIVITY_PAGE_SIZE = 20;

/* ── Row phrasing ─────────────────────────────────────────────────────────────
 * The phrasing itself lives in ./helpers, shared with Overview's recent-activity
 * summary; this file owns the row's LAYOUT. */

function ActivityRow({ row, words }: { row: ProjectActivity; words: ItemWords }): ReactElement {
  const body = commentBody(row);
  return (
    <ListItem className="flex-col items-start gap-1 py-2">
      <div className="flex w-full items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-sm text-apt-text">
          <span className="font-medium">{actorText(row)}</span>{" "}
          <span className="text-apt-text-muted">{actionPhrase(row.action, row.detail, words)}</span>
        </span>
        <time
          dateTime={row.createdAt}
          className="shrink-0 text-xs text-apt-text-dim"
        >
          {relativeTime(row.createdAt)}
        </time>
      </div>
      {body && (
        <p className="whitespace-pre-wrap text-sm text-apt-text-muted">{body}</p>
      )}
    </ListItem>
  );
}

/* ── Feed ───────────────────────────────────────────────────────────────────── */

export function ActivityFeed({
  load,
  words = DEFAULT_ITEM_WORDS,
}: {
  load: (before?: string) => Promise<ActivityPage>;
  /** What the board these rows come from calls its cards. Every feed is scoped to ONE board —
   *  a project's trail or one card's — so a single word is always the right one here. */
  words?: ItemWords;
}): ReactElement {
  const [rows, setRows] = useState<ProjectActivity[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Initial page — captured on first render so an inline `load` closure never
  // re-triggers a fetch; callers refresh by re-mounting with a changing `key`.
  // Uses the same `mounted` ref as loadOlder to drop a post-unmount response.
  const firstLoad = useRef(load);
  useEffect(() => {
    firstLoad
      .current()
      .then((page) => {
        if (!mounted.current) return;
        setRows(page.rows);
        setNextBefore(page.nextBefore);
        setLoading(false);
      })
      .catch((e) => {
        if (!mounted.current) return;
        setError(e instanceof Error ? e.message : "Failed to load activity.");
        setLoading(false);
      });
  }, []);

  const loadOlder = useCallback(async () => {
    if (nextBefore === null || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await load(nextBefore);
      if (!mounted.current) return;
      setRows((prev) => [...prev, ...page.rows]);
      setNextBefore(page.nextBefore);
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : "Failed to load older activity.");
      }
    } finally {
      if (mounted.current) setLoadingMore(false);
    }
  }, [load, nextBefore, loadingMore]);

  return (
    <div className="flex flex-col gap-3">
      <ErrorText error={error} />

      {loading ? (
        <p className="text-sm text-apt-text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        error ? null : <EmptyState title="No activity yet." />
      ) : (
        <>
          <List>
            {rows.map((row) => (
              <ActivityRow key={row.id} row={row} words={words} />
            ))}
          </List>
          {nextBefore !== null && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void loadOlder()}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load older"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
