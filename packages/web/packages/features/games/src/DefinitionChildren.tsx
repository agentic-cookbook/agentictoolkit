"use client";

import {
  gameEffectsApi,
  gameMappingsApi,
  type GameDefinition,
  type GameEffect,
  type GameEffectInput,
  type GameMapping,
  type GameMappingInput,
} from "@agentic-toolkit/data/games";
import type { TopicLeaf } from "@agentic-toolkit/resource";
import { InlineChildList, type InlineChildListConfig } from "./InlineChildList";
import {
  EffectFields,
  effectBlank,
  effectDiffers,
  effectLabel,
  effectNormalize,
  effectToInput,
  effectValidate,
} from "./EffectDetail";
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
 * What hangs off an open definition: the effects it fires and the connections that lead out of
 * it. Both are the same rows the Effects and Connections topics edit — this is a second view,
 * not a second store.
 *
 * The two lists share the ONE fifth URL segment (`/<workspace>/<gameId>/content/<defId>/<childId>`),
 * which is why an id is enough: whichever list holds that row opens it, and the other resolves to
 * no selection. Sharing a segment is only safe because neither list acts on an id it does not
 * have — see `inlineSelection.ts`, which is the whole of that rule.
 */
export function DefinitionChildren({
  definition,
  leaf,
}: {
  definition: GameDefinition;
  /** `subLeafFor(definition.id)` from the Content topic's `render`. */
  leaf?: TopicLeaf;
}) {
  const definitionId = definition.id;

  const effects: InlineChildListConfig<GameEffect, GameEffectInput> = {
    collection: "effects",
    title: "Effects",
    blurb: "What this fires, and when. adh stores an effect and hands it to your engine — it never runs it.",
    itemNoun: "effect",
    emptyLabel: "Nothing happens because of this yet.",
    keep: (e) => e.definitionId === definitionId,
    getId: (e) => e.id,
    getLabel: effectLabel,
    getGroup: (e) => e.trigger,
    getSort: (e) => e.sortOrder,
    list: (gameId) => gameEffectsApi.list(gameId),
    create: (gameId, input) => gameEffectsApi.create(gameId, input),
    update: (id, input) => gameEffectsApi.update(id, input),
    remove: (id) => gameEffectsApi.delete(id),
    confirmDelete: (e) => `Delete the effect “${e.key}”? This cannot be undone.`,
    // The parent is fixed by where you are standing, so the draft opens already pointed at it.
    blank: () => effectBlank(definitionId),
    toInput: effectToInput,
    normalize: effectNormalize,
    differs: effectDiffers,
    validate: effectValidate,
    renderFields: (draft, onChange, error) => (
      <EffectFields draft={draft} onChange={onChange} error={error} definitionLocked />
    ),
  };

  const connections: InlineChildListConfig<GameMapping, GameMappingInput> = {
    collection: "mappings",
    title: "Connections",
    blurb: "Where this leads. Only the connections OUT of this definition — the ones into it belong to their own origins.",
    itemNoun: "connection",
    emptyLabel: "Nothing leads out of this yet.",
    keep: (m) => m.fromId === definitionId,
    getId: (m) => m.id,
    getLabel: mappingLabel,
    getGroup: (m) => m.kind,
    getSort: (m) => m.sortOrder,
    list: (gameId) => gameMappingsApi.list(gameId),
    create: (gameId, input) => gameMappingsApi.create(gameId, input),
    update: (id, input) => gameMappingsApi.update(id, input),
    remove: (id) => gameMappingsApi.delete(id),
    confirmDelete: (m) => `Delete the connection to ${m.toId}? This cannot be undone.`,
    blank: () => mappingBlank(definitionId),
    toInput: mappingToInput,
    normalize: mappingNormalize,
    differs: mappingDiffers,
    validate: mappingValidate,
    renderFields: (draft, onChange, error) => (
      <MappingFields draft={draft} onChange={onChange} error={error} fromLocked />
    ),
  };

  return (
    <>
      <InlineChildList gameId={definition.gameId} leaf={leaf} config={effects} />
      <InlineChildList gameId={definition.gameId} leaf={leaf} config={connections} />
    </>
  );
}
