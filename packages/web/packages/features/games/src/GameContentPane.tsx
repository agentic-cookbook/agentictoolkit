"use client";

import type { ReactNode } from "react";
import { Boxes } from "lucide-react";
import {
  gameDefinitionsApi,
  type GameDefinition,
  type GameDefinitionInput,
} from "@agentic-toolkit/data/games";
import type { TopicLeaf } from "@agentic-toolkit/resource";
import { GameChildPane, type GameChildPaneConfig } from "./GameChildPane";
import { GameNotEnabledPane } from "./GameNotEnabledPane";
import { useGameForEcosystem } from "./useGameForEcosystem";
import {
  DefinitionFields,
  definitionBlank,
  definitionDiffers,
  definitionLabel,
  definitionNormalize,
  definitionToInput,
  definitionValidate,
} from "./DefinitionDetail";
import { DefinitionChildren } from "./DefinitionChildren";

/**
 * Content: the nouns a game declares — rooms, spells, items, whatever its engine names.
 * One table (`game.definitions`) with a `kind` discriminator, which is what the schema
 * collapsed a per-game `forms` and `terms` pair into. The kind is free text because the
 * vocabulary belongs to the game, not to adh.
 *
 * An open definition also shows the two things that hang off it — its effects and its
 * outgoing connections — because that is where an author needs them. They are the same rows
 * the Effects and Connections topics edit.
 *
 * Built as a factory rather than a module constant so the config can close over `subLeafFor`,
 * which is per-render.
 */
function makeConfig(
  subLeafFor?: (memberId: string) => TopicLeaf,
): GameChildPaneConfig<GameDefinition, GameDefinitionInput> {
  return {
    collection: "definitions",
    listTitle: "Content",
    itemNoun: "definition",
    icon: <Boxes size={16} aria-hidden />,
    getId: (d) => d.id,
    getLabel: definitionLabel,
    getGroup: (d) => d.kind,
    getSort: (d) => d.sortOrder,
    list: (gameId) => gameDefinitionsApi.list(gameId),
    create: (gameId, input) => gameDefinitionsApi.create(gameId, input),
    update: (id, input) => gameDefinitionsApi.update(id, input),
    remove: (id) => gameDefinitionsApi.delete(id),
    // No claim about what happens to this definition's effects and connections: the routes
    // that decide it do not exist yet, so saying either way would be inventing the answer.
    confirmDelete: (d) => `Delete the definition “${definitionLabel(d)}”? This cannot be undone.`,
    blank: definitionBlank,
    toInput: definitionToInput,
    normalize: definitionNormalize,
    differs: definitionDiffers,
    validate: definitionValidate,
    hint: "A definition is one of the things this game is made of — a room, a spell, an item. Its kind groups it.",
    renderFields: (draft, onChange, error) => (
      <DefinitionFields draft={draft} onChange={onChange} error={error} />
    ),
    // The SAVED definition, so its children have an id to point at. `subLeafFor` turns the
    // fifth URL segment into a leaf scoped to this definition, which is what makes
    // `…/content/<defId>/<childId>` open a child and selecting one push the route.
    renderExtra: (definition) => (
      <DefinitionChildren definition={definition} leaf={subLeafFor?.(definition.id)} />
    ),
  };
}

export function GameContentPane({
  ecosystemId,
  leaf,
  subLeafFor,
  title,
}: {
  ecosystemId?: string;
  leaf?: TopicLeaf;
  subLeafFor?: (memberId: string) => TopicLeaf;
  title?: ReactNode;
}) {
  const { game, isSettled } = useGameForEcosystem(ecosystemId);
  if (!game) return <GameNotEnabledPane isSettled={isSettled} />;
  return (
    <GameChildPane gameId={game.id} leaf={leaf} title={title} config={makeConfig(subLeafFor)} />
  );
}
