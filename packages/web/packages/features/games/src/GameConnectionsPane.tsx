"use client";

import type { ReactNode } from "react";
import { Waypoints } from "lucide-react";
import {
  gameMappingsApi,
  type GameMapping,
  type GameMappingInput,
} from "@agentic-toolkit/data/games";
import type { TopicLeaf } from "@agentic-toolkit/resource";
import { GameChildPane, type GameChildPaneConfig } from "./GameChildPane";
import { GameNotEnabledPane } from "./GameNotEnabledPane";
import { useGameForEcosystem } from "./useGameForEcosystem";
import {
  MappingFields,
  mappingBlank,
  mappingDiffers,
  mappingLabel,
  mappingNormalize,
  mappingToInput,
  mappingValidate,
} from "./MappingDetail";

/**
 * Connections: how this game's definitions relate — an exit from one room to another, a
 * spell that belongs to a class, three iron into one sword. One row of `game.mappings` names
 * its two ends by definition id, what the connection IS via `kind`, and how many via `amount`.
 *
 * This is the whole map at once. The edges leading OUT of one definition also appear inside
 * that definition (see DefinitionChildren), sharing these field editors.
 *
 * The two ends are plain ids rather than pickers: the definitions list resolves empty until
 * the routes land, so a picker would offer nothing to pick. When the backend arrives these
 * become selects over the Content list.
 */
const config: GameChildPaneConfig<GameMapping, GameMappingInput> = {
  collection: "mappings",
  listTitle: "Connections",
  itemNoun: "connection",
  icon: <Waypoints size={16} aria-hidden />,
  getId: (m) => m.id,
  getLabel: mappingLabel,
  getGroup: (m) => m.kind,
  getSort: (m) => m.sortOrder,
  list: (gameId) => gameMappingsApi.list(gameId),
  create: (gameId, input) => gameMappingsApi.create(gameId, input),
  update: (id, input) => gameMappingsApi.update(id, input),
  remove: (id) => gameMappingsApi.delete(id),
  confirmDelete: (m) => `Delete the connection “${mappingLabel(m)}”? This cannot be undone.`,
  blank: () => mappingBlank(),
  toInput: mappingToInput,
  normalize: mappingNormalize,
  differs: mappingDiffers,
  validate: mappingValidate,
  hint: "A connection ties two definitions together — an exit between rooms, a spell on a class, an ingredient in a recipe. Its kind groups it.",
  renderFields: (draft, onChange, error) => (
    <MappingFields draft={draft} onChange={onChange} error={error} />
  ),
};

export function GameConnectionsPane({
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
