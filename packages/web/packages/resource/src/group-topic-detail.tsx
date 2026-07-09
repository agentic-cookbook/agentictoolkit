"use client";

import { Fragment, type ReactNode } from "react";
import type { TopicLevel } from "@agentic-toolkit/ui/blocks";
import { useDualModeSelection } from "@agentic-toolkit/ui/hooks/useDualModeSelection";
import type { TopicLeaf } from "./resource-explorer";
import { StackLevels } from "./rail-host";

/** A TopicLeaf that selects nothing and routes nowhere — the sub-leaf handed to a member when the
 *  caller doesn't cede a deeper URL segment (so a member's inner selection stays local). */
const LOCAL_SUBLEAF: TopicLeaf = { leafId: null, onSelect: () => {} };

export interface GroupTopicItem {
  id: string;
  label: string;
  icon: ReactNode;
  /** The member's detail pane (it may itself publish deeper rails). `subLeaf` carries the
   *  deep-linkable inner entity (the segment AFTER this member) for members that URL-drive their
   *  own selection — a persona list, a master/detail config pane; members without one ignore it. */
  render: (subLeaf: TopicLeaf) => ReactNode;
}

/**
 * A grouping level whose members live in the ONE merged stack. It publishes a rail of the group's
 * members (via {@link StackLevels}, which also advances the depth) and renders the active member as
 * the deeper content — so the member's own deeper rails (a persona list, a master/detail list) land
 * AFTER this group rail in the SAME stack, never as a separate nested rail. `leafHeader` renders
 * once above the active member's content, in the leaf (e.g. an editor's Save/Cancel bar).
 *
 * By default there is NO auto-selection: choosing this group shows its members UNSELECTED — picking
 * a member is an explicit act, never a cascade into the child rail (until then the leaf shows
 * `emptyHint`). This is the rule for NAVIGATION groups. An editor whose "members" are its own tabs
 * (the persona editor) may opt into `autoSelectFirst` to open on its first tab. Selection is local;
 * key the instance by group id at the call site.
 */
export function StackGroupDetail({
  items,
  levelId,
  title,
  leafHeader,
  emptyHint = "Select an item to view it.",
  autoSelectFirst = false,
  urlSelection,
  renderSubLeaf,
}: {
  items: GroupTopicItem[];
  /** Stable id for this group's rail level (e.g. "persona-topics", "ecosystem-ai"). */
  levelId: string;
  /** The rail's heading (like every other stack rail): the group's name — "AI", the persona's
   *  name, etc. */
  title: string;
  /** Rendered once above the active member's content, in the leaf (e.g. a Save/Cancel bar). */
  leafHeader?: ReactNode;
  /** Shown in the leaf until a member is chosen (no auto-selection into the child rail). */
  emptyHint?: ReactNode;
  /** Open with the first member selected — for an editor showing its first tab (persona editor),
   *  NOT for navigation groups. Default false: a group choice cascades into nothing. */
  autoSelectFirst?: boolean;
  /** Opt-in URL-driven selection (a deep-linkable sub-tab / section). When provided, the active
   *  member lives in the URL instead of internal state — reads come from `selectedId` and every
   *  select/clear routes through `onSelect` so the caller can push the segment (mirrors
   *  {@link useMasterDetailForm}'s `urlSelection`). Omit for the legacy internal-selection
   *  behavior. With `autoSelectFirst` and `selectedId` null (no sub-tab in the URL), the first
   *  member still SHOWS but no redirect is pushed to it — the first tab renders at the bare URL. */
  urlSelection?: { selectedId: string | null; onSelect: (id: string | null) => void };
  /** Builds the deep-linkable sub-leaf for the ACTIVE member (the URL segment after it), so the
   *  member's inner entity is itself deep-linkable (…/<group>/<member>/<entity>). Omit for the
   *  legacy behavior — the member's inner selection stays local ({@link LOCAL_SUBLEAF}). */
  renderSubLeaf?: (memberId: string) => TopicLeaf;
}) {
  // Navigation groups start unselected and onClear returns to that state; an editor (autoSelectFirst)
  // opens on — and clears back to — its first tab. Never a navigation cascade into the child rail.
  const defaultId = autoSelectFirst ? items[0]?.id ?? null : null;
  // Selection lives in the URL when `urlSelection` is given (deep-linkable), else in internal state
  // (seeded with `defaultId` so an editor opens on its first tab) — the shared dual-mode toggle.
  // `url` is kept for the one mode-specific spot: onClear routes to null (URL) vs. defaultId (local).
  const url = urlSelection;
  const { selectedId: selected, select: setSelected } = useDualModeSelection(url, {
    defaultSelectedId: defaultId,
  });
  // Selected item if present; else (nothing selected, or a stale id no longer in `items`) fall back
  // to the first item for an editor (autoSelectFirst) or to nothing for a navigation group.
  const found = selected != null ? items.find((i) => i.id === selected) ?? null : null;
  const active = found ?? (autoSelectFirst ? items[0] ?? null : null);
  const level: TopicLevel = {
    id: levelId,
    title,
    items: items.map((i) => ({ id: i.id, label: i.label, icon: i.icon })),
    selectedId: active?.id ?? null,
    onSelect: setSelected,
    // Internal: clear back to the default (first tab for an editor, nothing for a nav group). URL:
    // clear the segment (route to null) — `active` still shows the first tab with NO redirect.
    onClear: () => setSelected(url ? null : defaultId),
  };
  return (
    <StackLevels levels={[level]}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {leafHeader}
        {active ? (
          <Fragment key={active.id}>
            {active.render(renderSubLeaf ? renderSubLeaf(active.id) : LOCAL_SUBLEAF)}
          </Fragment>
        ) : (
          <p className="p-6 font-mono text-sm text-apt-text-dim" role="status">
            {emptyHint}
          </p>
        )}
      </div>
    </StackLevels>
  );
}
