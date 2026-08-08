"use client";

import type { ReactNode } from "react";
import { EcosystemsFeature, type RenderTopicPaneCtx } from "@agentic-toolkit/ecosystems";

import { GamificationSettingsTopicPane } from "./RealmSettingsPane";
import { CatalogTopicPane, EventTypesTopicPane, LevelsTopicPane } from "./topic-panes";
import { GAMIFICATION_TOPICS } from "./topics";
import type { GamificationPathSelection } from "./parse-path";

/**
 * The Gamification feature: the workspace's products as the root list, and each product's realm
 * config split across four topics.
 *
 * It is @agentic-toolkit/ecosystems in `listFirst` mode with a different topic set — NOT a second
 * navigator. A product IS an ecosystem: the list, its create flow, the rdid resume key, the
 * breadcrumb, the not-manageable gate and the whole rail stack already exist there and already
 * mean the right things. What is gamification-specific is exactly the four panes below, which is
 * why this file is short: the alternative was ~1600 lines of re-implemented navigation whose only
 * novelty would have been the bugs.
 *
 * `renderTopicPane` claims all four ids, including `settings` — EcosystemsFeature gives the host
 * first refusal on every topic, so "Settings" here is the realm config rather than the ecosystem
 * record. See {@link GAMIFICATION_TOPICS}.
 */
export interface GamificationFeatureProps extends GamificationPathSelection {
  basePath: string;
  /** The workspace whose products the root list shows. REQUIRED in practice: `listFirst` reads
   *  the workspace-OWNED ecosystems, so without it there is no list to be first. */
  workspaceSlug?: string;
}

function renderGamificationTopicPane(topicId: string, ctx: RenderTopicPaneCtx): ReactNode {
  switch (topicId) {
    case "catalog":
      return <CatalogTopicPane ecosystemId={ctx.ecosystemId} />;
    case "levels":
      return <LevelsTopicPane ecosystemId={ctx.ecosystemId} />;
    case "custom-events":
      return <EventTypesTopicPane ecosystemId={ctx.ecosystemId} />;
    case "settings":
      return <GamificationSettingsTopicPane ecosystemId={ctx.ecosystemId} />;
    default:
      // Nothing else is on this rail. Declining (rather than rendering a placeholder) hands the
      // id back to EcosystemsFeature, so a topic added upstream still gets its own pane.
      return null;
  }
}

export function GamificationFeature({ basePath, workspaceSlug, ...selection }: GamificationFeatureProps) {
  return (
    <EcosystemsFeature
      basePath={basePath}
      workspaceSlug={workspaceSlug}
      listFirst
      labels={{ singular: "Product", plural: "Products" }}
      topics={GAMIFICATION_TOPICS}
      renderTopicPane={renderGamificationTopicPane}
      {...selection}
    />
  );
}
