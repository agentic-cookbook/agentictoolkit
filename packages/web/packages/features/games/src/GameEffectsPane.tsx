"use client";

import type { ReactNode } from "react";
import { Zap } from "lucide-react";
import { gameEffectsApi, type GameEffect, type GameEffectInput } from "@agentic-toolkit/data/games";
import type { TopicLeaf } from "@agentic-toolkit/resource";
import { GameChildPane, type GameChildPaneConfig } from "./GameChildPane";
import { GameNotEnabledPane } from "./GameNotEnabledPane";
import { useGameForEcosystem } from "./useGameForEcosystem";
import {
  EffectFields,
  effectBlank,
  effectDiffers,
  effectLabel,
  effectNormalize,
  effectToInput,
  effectValidate,
} from "./EffectDetail";

/**
 * Effects: what happens, and what fires it. Grouped by `trigger` rather than by kind — the
 * question a reader has about an effect is when it runs, so that is what the list sorts on.
 * Within a trigger the order is `sort_order`, because the order effects apply in changes the
 * outcome and an alphabetical list would show one the engine does not run.
 *
 * This is the WHOLE game's effects, for balancing. The same rows also appear inside the
 * definition each one belongs to (see DefinitionChildren), which is where an author usually
 * meets them; the fields are shared between the two so neither can drift.
 *
 * adh hosts the backend, not the engine: an effect is stored and handed over, never
 * interpreted here. There is no rules engine on this site by design.
 */
const config: GameChildPaneConfig<GameEffect, GameEffectInput> = {
  collection: "effects",
  listTitle: "Effects",
  itemNoun: "effect",
  icon: <Zap size={16} aria-hidden />,
  getId: (e) => e.id,
  getLabel: effectLabel,
  getGroup: (e) => e.trigger,
  getSort: (e) => e.sortOrder,
  list: (gameId) => gameEffectsApi.list(gameId),
  create: (gameId, input) => gameEffectsApi.create(gameId, input),
  update: (id, input) => gameEffectsApi.update(id, input),
  remove: (id) => gameEffectsApi.delete(id),
  confirmDelete: (e) => `Delete the effect “${effectLabel(e)}”? This cannot be undone.`,
  // No parent to inherit here — the top-level list spans every definition, so the author names
  // one. Inside a definition the same blank arrives pre-pointed.
  blank: () => effectBlank(),
  toInput: effectToInput,
  normalize: effectNormalize,
  differs: effectDiffers,
  validate: effectValidate,
  hint: "An effect is something that happens, the trigger that fires it, and what it does to which stat. adh stores it and hands it to your engine — it never runs it.",
  renderFields: (draft, onChange, error) => (
    <EffectFields draft={draft} onChange={onChange} error={error} />
  ),
};

export function GameEffectsPane({
  ecosystemId,
  leaf,
  title,
}: {
  ecosystemId?: string;
  leaf?: TopicLeaf;
  title?: ReactNode;
}) {
  const { game, isSettled } = useGameForEcosystem(ecosystemId);
  if (!game) return <GameNotEnabledPane isSettled={isSettled} />;
  return <GameChildPane gameId={game.id} leaf={leaf} title={title} config={config} />;
}
