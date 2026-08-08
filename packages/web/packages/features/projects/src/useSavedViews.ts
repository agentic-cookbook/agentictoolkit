"use client";

import { useCallback, useMemo, useState } from "react";
import { useResourceList } from "@agentic-toolkit/data";
import { projectsApi, type SavedView } from "@agentic-toolkit/data/projects";
import { errorMessage } from "@agentic-toolkit/ui/lib/errors";
import { EMPTY_FILTER } from "./filters";
import {
  decodeViewConfig,
  encodeViewConfig,
  sameViewConfig,
  type WorkItemViewConfig,
} from "./saved-views";

/**
 * A project's saved views as a controller: the list, which one is applied, whether the board has
 * since drifted from it, and the four things you can do about that.
 *
 * The hook owns the WRITES and the loading; it owns none of the board. Applying a view is a call
 * back out (`onApply`) rather than a filter this hook holds, because applying is not one act — it
 * narrows the list, it seeds the Table's sort, and it can NAVIGATE (a view saved on the Board
 * opens the Board). Only the surface can do those, and giving this hook a filter of its own would
 * be a second answer to "what is the board showing".
 *
 * Every mutation answers whether it LANDED, so a caller that must react to success (the rename
 * dialog closing) can, without also having to guess from a cleared error. Nothing here throws:
 * the failure is put on `error` for the bar to show, because none of these four are worth
 * unmounting a board over.
 */
export interface SavedViewsController {
  /** The project's views, or null while the first read is in flight. */
  views: SavedView[] | null;
  /** The applied view, resolved against the loaded list — so a view deleted from another tab
   *  stops being "applied" rather than leaving an id the chooser would render raw. */
  applied: SavedView | null;
  /** The board no longer matches the applied view's stored config. */
  modified: boolean;
  busy: boolean;
  error: string | null;
  /** Apply a saved view, or `null` for the all-pass: no name, no narrowing. */
  apply: (id: string | null) => void;
  /** Save what the board is showing under a new name. */
  create: (name: string) => Promise<boolean>;
  /** Re-point the applied view at what the board is showing now. */
  save: () => Promise<boolean>;
  rename: (name: string) => Promise<boolean>;
  /** Delete the applied view. The board keeps showing what it was showing — deleting a name is
   *  not an instruction to change the subject. */
  remove: () => Promise<boolean>;
}

export function useSavedViews({
  projectId,
  config,
  appliedId,
  onApply,
}: {
  projectId: string;
  /** What the board is showing right now. */
  config: WorkItemViewConfig;
  /** The saved view the board's configuration came from, as the surface remembers it. */
  appliedId: string | null;
  /** Show `config`, and record `savedViewId` as where it came from. Called with the CURRENT
   *  config (and a new id) when a save only changes the bookkeeping — the board must not blink. */
  onApply: (config: WorkItemViewConfig, savedViewId: string | null) => void;
}): SavedViewsController {
  const load = useCallback(() => projectsApi.savedViews.list(projectId), [projectId]);
  const { items: views, reload, error: loadError } = useResourceList<SavedView>(
    `project:${projectId}:saved-views`,
    load,
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applied = useMemo(
    () => (appliedId === null ? null : (views ?? []).find((v) => v.id === appliedId) ?? null),
    [views, appliedId],
  );

  const modified = useMemo(
    () => applied !== null && !sameViewConfig(decodeViewConfig(applied.config), config),
    [applied, config],
  );

  const run = useCallback(async (op: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await op();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const apply = useCallback(
    (id: string | null) => {
      setError(null);
      if (id === null) {
        // The all-pass. It widens rather than merely forgetting the name: an entry in a list of
        // views that visibly does nothing when picked is the more astonishing of the two, and
        // "show me everything" is the thing people actually want from it. The view itself is left
        // alone — you asked to stop narrowing, not to be moved to another tab.
        onApply({ view: config.view, filter: EMPTY_FILTER, sort: null }, null);
        return;
      }
      const target = (views ?? []).find((v) => v.id === id);
      if (!target) return;
      onApply(decodeViewConfig(target.config), target.id);
    },
    [views, config.view, onApply],
  );

  const create = useCallback(
    (name: string) =>
      run(async () => {
        const created = await projectsApi.savedViews.create(projectId, {
          name,
          config: encodeViewConfig(config),
        });
        // Record the id BEFORE the re-read: the board is already showing this config, and a
        // failed refresh must not leave the view the user just saved looking unsaved.
        onApply(config, created.id);
        await reload();
      }),
    [run, projectId, config, onApply, reload],
  );

  const save = useCallback(
    () =>
      run(async () => {
        if (!applied) return;
        await projectsApi.savedViews.update(projectId, applied.id, {
          config: encodeViewConfig(config),
        });
        await reload();
      }),
    [run, projectId, applied, config, reload],
  );

  const rename = useCallback(
    (name: string) =>
      run(async () => {
        if (!applied) return;
        await projectsApi.savedViews.update(projectId, applied.id, { name });
        await reload();
      }),
    [run, projectId, applied, reload],
  );

  const remove = useCallback(
    () =>
      run(async () => {
        if (!applied) return;
        await projectsApi.savedViews.remove(projectId, applied.id);
        onApply(config, null);
        await reload();
      }),
    [run, projectId, applied, config, onApply, reload],
  );

  return {
    views,
    applied,
    modified,
    busy,
    // A failed WRITE is the newer news, so it wins the one line the bar has for an error; a
    // failed read still gets told, because a chooser silently missing half its views is worse.
    error: error ?? loadError,
    apply,
    create,
    save,
    rename,
    remove,
  };
}
