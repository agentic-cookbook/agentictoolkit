"use client";

import type { ReactNode } from "react";
import { EcosystemsFeature, type RenderTopicPaneCtx } from "@agentic-toolkit/ecosystems";
import type { EcosystemsPathSelection } from "@agentic-toolkit/ecosystems/parse";

import { GameEnginePane } from "./GameEnginePane";
import { GameContentPane } from "./GameContentPane";
import { GameConnectionsPane } from "./GameConnectionsPane";
import { GameEffectsPane } from "./GameEffectsPane";
import { GameSettingsTopicPane } from "./GameSettingsPane";
import { GAME_TOPICS } from "./topics";

/**
 * The Games feature: the workspace's products as the root list, and each product's game
 * split across five topics (Engine, Content, Connections, Effects, Settings).
 *
 * It is @agentic-toolkit/ecosystems in `listFirst` mode with a different topic set — NOT a
 * second navigator, and NOT a games-owned rdid grammar any more (§1 of the
 * product-gaming-modes design: a game has no address of its own — it is reached through its
 * product's ecosystem id, one game per product, via `gamesApi.forEcosystem`). The list, its
 * create flow, the rdid resume key, the breadcrumb, the not-manageable gate and the whole
 * rail stack already exist on `EcosystemsFeature` and already mean the right things — this
 * file's entire job is the five panes below. Mirrors `GamificationFeature` exactly, down to
 * the `EcosystemsPathSelection` import: this package keeps no parse-path of its own any
 * more (the host site parses with `parseEcosystemsPath` directly — see
 * `frontend/src/sites/games/src/home-model.tsx`), since there is no games-specific grammar
 * left to wrap.
 *
 * `renderTopicPane` claims all five ids, including `settings` — `EcosystemsFeature` gives
 * the host first refusal on every topic, so "Settings" here is the game's own settings pane
 * rather than the ecosystem record. See {@link GAME_TOPICS}.
 */
export interface GamesFeatureProps extends EcosystemsPathSelection {
  basePath: string;
  /** The workspace whose products the root list shows. REQUIRED in practice: `listFirst`
   *  reads the workspace-OWNED ecosystems, so without it there is no list to be first. */
  workspaceSlug?: string;
}

function renderGameTopicPane(topicId: string, ctx: RenderTopicPaneCtx): ReactNode {
  switch (topicId) {
    case "engine":
      return <GameEnginePane ecosystemId={ctx.ecosystemId} title={ctx.title} />;
    case "content":
      return (
        <GameContentPane
          ecosystemId={ctx.ecosystemId}
          leaf={ctx.leaf}
          subLeafFor={ctx.subLeafFor}
          title={ctx.title}
        />
      );
    case "connections":
      return <GameConnectionsPane ecosystemId={ctx.ecosystemId} leaf={ctx.leaf} title={ctx.title} />;
    case "effects":
      return <GameEffectsPane ecosystemId={ctx.ecosystemId} leaf={ctx.leaf} title={ctx.title} />;
    case "settings":
      return <GameSettingsTopicPane ecosystemId={ctx.ecosystemId} />;
    default:
      // Nothing else is on this rail. Declining (rather than rendering a placeholder) hands
      // the id back to EcosystemsFeature, so a topic added upstream still gets its own pane.
      return null;
  }
}

export function GamesFeature({ basePath, workspaceSlug, ...selection }: GamesFeatureProps) {
  return (
    <EcosystemsFeature
      basePath={basePath}
      workspaceSlug={workspaceSlug}
      listFirst
      labels={{ singular: "Product", plural: "Products" }}
      topics={GAME_TOPICS}
      renderTopicPane={renderGameTopicPane}
      {...selection}
    />
  );
}
