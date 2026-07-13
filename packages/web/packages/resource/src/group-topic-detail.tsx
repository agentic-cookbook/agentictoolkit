"use client";

import { Fragment, type ReactNode } from "react";
import { TopicOverview, type TopicLevel } from "@agentic-toolkit/ui/blocks";
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
  /** What this member is for. When ANY member carries one, the no-selection leaf becomes the
   *  standard TopicOverview (one card per member) instead of the `emptyHint` placeholder — an
   *  opt-in through the data, so entity rosters without descriptions keep the plain hint. */
  description?: string;
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
 * There is NEVER auto-selection: choosing this group (or the entity that owns it) shows its members
 * UNSELECTED — picking a member is an explicit act, never a cascade into the child rail (until then
 * the leaf shows `emptyHint`). This holds for editors exactly like navigation groups (spec:
 * selecting an item in a hierarchical topic/detail view never automatically selects a topic).
 * Selection is local; key the instance by group id at the call site.
 */
export function StackGroupDetail({
  items,
  levelId,
  title,
  leafHeader,
  emptyHint = "Select a topic.",
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
  /** Opt-in URL-driven selection (a deep-linkable sub-tab / section). When provided, the active
   *  member lives in the URL instead of internal state — reads come from `selectedId` and every
   *  select/clear routes through `onSelect` so the caller can push the segment (mirrors
   *  {@link useMasterDetailForm}'s `urlSelection`). Omit for the legacy internal-selection
   *  behavior. */
  urlSelection?: { selectedId: string | null; onSelect: (id: string | null) => void };
  /** Builds the deep-linkable sub-leaf for the ACTIVE member (the URL segment after it), so the
   *  member's inner entity is itself deep-linkable (…/<group>/<member>/<entity>). Omit for the
   *  legacy behavior — the member's inner selection stays local ({@link LOCAL_SUBLEAF}). */
  renderSubLeaf?: (memberId: string) => TopicLeaf;
}) {
  // Every group starts unselected and onClear returns to that state — never a cascade into the
  // child rail. Selection lives in the URL when `urlSelection` is given (deep-linkable), else in
  // internal state — the shared dual-mode toggle.
  const { selectedId: selected, select: setSelected } = useDualModeSelection(urlSelection);
  // Selected item if present; else (nothing selected, or a stale id no longer in `items`) nothing.
  const active = selected != null ? items.find((i) => i.id === selected) ?? null : null;
  const memberItems = items.map((i) => ({
    id: i.id,
    label: i.label,
    icon: i.icon,
    description: i.description,
  }));
  const level: TopicLevel = {
    id: levelId,
    title,
    items: memberItems,
    selectedId: active?.id ?? null,
    onSelect: setSelected,
    onClear: () => setSelected(null),
  };
  return (
    <StackLevels levels={[level]}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {leafHeader}
        {active ? (
          <Fragment key={active.id}>
            {active.render(renderSubLeaf ? renderSubLeaf(active.id) : LOCAL_SUBLEAF)}
          </Fragment>
        ) : items.some((i) => i.description) ? (
          <TopicOverview title={title} items={memberItems} onSelect={setSelected} />
        ) : (
          <p className="p-6 font-mono text-sm text-apt-text-dim" role="status">
            {emptyHint}
          </p>
        )}
      </div>
    </StackLevels>
  );
}
