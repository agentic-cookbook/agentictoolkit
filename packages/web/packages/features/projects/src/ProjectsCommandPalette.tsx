"use client";

import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { FolderKanban, ListTodo } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  CommandPalette,
  filterCommandItems,
  type CommandGroup,
  type CommandItem,
} from "@agentic-toolkit/ui/blocks";
import { useShortcut, formatChord } from "@agentic-toolkit/ui/hooks/useShortcut";
import { writeSearchParams } from "@agentic-toolkit/ui/lib/search-params";
import { errorMessage } from "@agentic-toolkit/ui/lib/errors";
import { projectSearchApi, type Project, type WorkItemSearchHit } from "@agentic-toolkit/data/projects";
import { projectTopics } from "./projectTopics";
import { DEFAULT_WORK_ITEM_VIEW, WORK_ITEM_PARAM, workItemHref } from "./work-item-link";

/**
 * Projects' ⌘K: the only way into this feature that does not start by picking a board.
 *
 * Everything else here is a rail — a project, then a topic, then a row — which is exactly right
 * when the user is *looking* for work and exactly useless when they already know its name. The
 * three groups below are the three ways a name can resolve, in the order they are worth offering:
 *
 *  1. **Work items**, from the server's cross-board search. This is the group that could not exist
 *     before: the caller's whole reach, ranked, with the owning board named on each hit, so a card
 *     is findable from a project you have never opened. A query shaped like a key (`ADH-42`) is
 *     answered by the same route, first.
 *  2. **Projects**, filtered locally over the rail's already-loaded list — no request, because the
 *     list is already here and a board is picked by a name the user is looking at.
 *  3. **Go to**, the open project's own topics, so the palette also serves the person who is deep in
 *     a board and wants its Milestones without walking back up the rail.
 *
 * Only group 1 is remote, and it is DEBOUNCED and floored at two characters: a per-keystroke search
 * across every board the caller reaches is a lot of database for a question the user has not
 * finished asking. A response that arrives after a newer keystroke is dropped rather than rendered
 * (`alive`), because ranked results for a query you have moved past are worse than none.
 */

/** How long typing must pause before the cross-board search is asked. */
const SEARCH_DEBOUNCE_MS = 200;
/** Below this the query is not yet a question — one letter matches most of a board. */
const MIN_QUERY = 2;
/** A palette is read, not scrolled; the rest is what the board's own list is for. */
const SEARCH_LIMIT = 8;
const MAX_PROJECT_ROWS = 6;

export function ProjectsCommandPalette({
  basePath,
  projects,
  workspaceSlug,
  activeProjectId,
  activeTopic,
}: {
  /** The feature's base, workspace included — the same value {@link ProjectsFeature} routes with. */
  basePath: string;
  /** The rail's projects. `null` while they load: the Projects group is simply absent until then,
   *  which is honest — an empty group would read as "no such board". */
  projects: Project[] | null;
  /** Narrows the search to one workspace's boards, matching the list the rail is showing. Omitted,
   *  the search answers from the caller's whole reach — which would find cards the rail cannot. */
  workspaceSlug?: string;
  activeProjectId?: string;
  activeTopic?: string;
}): ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<WorkItemSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Opening always starts from a blank field. The alternative — resuming the last search — offers a
  // stale answer to a question nobody asked twice, and the one keystroke it saves is the one the
  // user was about to type anyway.
  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) return;
    setQuery("");
    setHits([]);
    setSearchError(null);
  }, []);

  // The chord toggles THROUGH `onOpenChange` rather than setting the state itself, so ⌘K-then-⌘K
  // resets the field exactly the way Escape-then-⌘K does. Two doors into one surface that clear
  // different amounts of it is the kind of difference nobody notices until they rely on it.
  useShortcut({ keys: "mod+k", label: "Find a work item or project", group: "Projects" }, () =>
    onOpenChange(!open),
  );

  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < MIN_QUERY) {
      setHits([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    let alive = true;
    setSearching(true);
    const timer = setTimeout(() => {
      projectSearchApi
        .workItems(q, { workspace: workspaceSlug, limit: SEARCH_LIMIT })
        .then((page) => {
          if (!alive) return;
          setHits(page.results);
          setSearchError(null);
        })
        .catch((e: unknown) => {
          if (!alive) return;
          setHits([]);
          setSearchError(errorMessage(e));
        })
        .finally(() => {
          if (alive) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, open, workspaceSlug]);

  /**
   * Open a card. When the Work Items surface for that board is ALREADY mounted, the address is the
   * only thing that has to change — writing the param is what tells it, and a route push to the
   * page you are on would remount the whole pane and re-read every list on it. Otherwise it is a
   * navigation like any other.
   */
  const openWorkItem = useCallback(
    (hit: WorkItemSearchHit) => {
      if (hit.projectId === activeProjectId && activeTopic === "work-items") {
        writeSearchParams({ [WORK_ITEM_PARAM]: hit.id });
        return;
      }
      router.push(workItemHref(basePath, hit.projectId, hit.id, DEFAULT_WORK_ITEM_VIEW));
    },
    [router, basePath, activeProjectId, activeTopic],
  );

  const groups = useMemo<CommandGroup[]>(() => {
    const workItems: CommandItem[] = hits.map((hit) => ({
      id: `work-item:${hit.id}`,
      label: hit.title,
      badge: hit.itemKey,
      // The snippet is a headline over the DESCRIPTION, so it is empty for a title-only or key hit
      // — where the title above already is the answer and a second dim line would repeat it.
      description: hit.snippet || undefined,
      // The board, on every row: results that span boards are unreadable without it, and this is
      // the one group whose rows can come from a project the rail never listed.
      hint: hit.projectName,
      icon: <ListTodo size={16} aria-hidden />,
      keywords: `${hit.itemKey} ${hit.projectName}`,
      onSelect: () => openWorkItem(hit),
    }));

    const projectRows = filterCommandItems(
      (projects ?? []).map((project) => ({
        id: `project:${project.id}`,
        label: project.name,
        hint: project.status,
        icon: <FolderKanban size={16} aria-hidden />,
        onSelect: () => router.push(`${basePath}/${project.id}/overview`),
      })),
      query,
    ).slice(0, MAX_PROJECT_ROWS);

    // The open project's topics. Absent when no project is open — "Go to Milestones" has no
    // referent then, and a row that needs a selection the user has not made is a dead row.
    const goTo: CommandItem[] = activeProjectId
      ? filterCommandItems(
          projectTopics({ workspaceSlug }).map((topic) => ({
            id: `topic:${topic.id}`,
            label: topic.label,
            description: topic.description,
            icon: topic.icon,
            onSelect: () => router.push(`${basePath}/${activeProjectId}/${topic.id}`),
          })),
          query,
        )
      : [];

    return [
      { id: "work-items", label: "Work items", items: workItems },
      { id: "projects", label: "Projects", items: projectRows },
      { id: "go-to", label: "Go to", items: goTo },
    ];
  }, [hits, projects, query, activeProjectId, workspaceSlug, basePath, router, openWorkItem]);

  const typedEnough = query.trim().length >= MIN_QUERY;

  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      query={query}
      onQueryChange={setQuery}
      groups={groups}
      ariaLabel="Find a work item or project"
      placeholder="Search work items, or jump to a project…"
      loading={searching}
      error={searchError}
      emptyLabel={
        typedEnough ? "No matches" : "Type to search work items across every board you can see."
      }
      footer={
        <>
          <span>↑↓ to move · ↵ to open · Esc to close</span>
          {/* Only rendered inside an opened dialog, so the platform-dependent chord never reaches
              server HTML — see formatChord. */}
          <span>{formatChord("mod+k")}</span>
        </>
      }
    />
  );
}
