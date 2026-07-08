"use client";

import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { List, ListItem } from "@agentic-toolkit/ui/components/list";
import { Button } from "@agentic-toolkit/ui/components/button";
import type { ActivityPage, ProjectActivity } from "@agentic-toolkit/data/projects";

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

/* ── Row phrasing ───────────────────────────────────────────────────────────── */

/** The actor's display name: the label if present, else a phrasing of kind/id. */
function actorText(a: ProjectActivity): string {
  if (a.actorLabel) return a.actorLabel;
  if (a.actorKind && a.actorId) return `${a.actorKind} · ${a.actorId}`;
  return a.actorKind ?? a.actorId ?? "Someone";
}

/** Human phrasing of an `action` string; the raw value is the fallback. */
function actionPhrase(action: string): string {
  switch (action) {
    case "project.created":
      return "created the project";
    case "project.updated":
      return "updated the project";
    case "project.archived":
      return "archived the project";
    case "work_item.created":
      return "created a work item";
    case "work_item.updated":
      return "updated a work item";
    case "work_item.status_changed":
      return "changed status";
    case "work_item.assigned":
      return "assigned";
    case "work_item.unassigned":
      return "unassigned";
    case "work_item.reparented":
      return "moved";
    case "work_item.deleted":
      return "deleted a work item";
    case "comment.added":
      return "commented";
    case "field.created":
      return "added a field";
    case "field.updated":
      return "updated a field";
    case "field.deleted":
      return "removed a field";
    case "participant.added":
      return "added a participant";
    case "participant.removed":
      return "removed a participant";
    default:
      return action;
  }
}

/** A comment row's body from its detail payload, when present. */
function commentBody(a: ProjectActivity): string | null {
  const body = a.detail?.body;
  return typeof body === "string" && body.trim() ? body : null;
}

/** A relative "3 minutes ago" phrasing via the platform's Intl formatter. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const sec = Math.round((Date.now() - then) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(sec) < 60) return rtf.format(-sec, "second");
  const min = Math.round(sec / 60);
  if (Math.abs(min) < 60) return rtf.format(-min, "minute");
  const hr = Math.round(min / 60);
  if (Math.abs(hr) < 24) return rtf.format(-hr, "hour");
  const day = Math.round(hr / 24);
  if (Math.abs(day) < 30) return rtf.format(-day, "day");
  const month = Math.round(day / 30);
  if (Math.abs(month) < 12) return rtf.format(-month, "month");
  return rtf.format(-Math.round(month / 12), "year");
}

function ActivityRow({ row }: { row: ProjectActivity }): ReactElement {
  const body = commentBody(row);
  return (
    <ListItem className="flex-col items-start gap-1 py-2">
      <div className="flex w-full items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-sm text-apt-text">
          <span className="font-medium">{actorText(row)}</span>{" "}
          <span className="text-apt-text-muted">{actionPhrase(row.action)}</span>
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
}: {
  load: (before?: string) => Promise<ActivityPage>;
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
      {error && <p className="text-sm text-apt-red">{error}</p>}

      {loading ? (
        <p className="text-sm text-apt-text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        error ? null : <EmptyState title="No activity yet." />
      ) : (
        <>
          <List>
            {rows.map((row) => (
              <ActivityRow key={row.id} row={row} />
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
