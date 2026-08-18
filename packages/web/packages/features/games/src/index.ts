"use client";

// The client barrel. Every component here is a Client Component by construction —
// preserve-directives puts this file's directive on the whole chunk. The path parser
// is NOT re-exported: it lives behind `@agentic-toolkit/games/parse` precisely so a
// server route can call it without dragging this bundle along.

export type { GamesPathSelection } from "./parse-path";

export { GameOverviewPane } from "./GameOverviewPane";
export { GameEnginePane } from "./GameEnginePane";
export {
  GameIdentityFields,
  GameEngineFields,
  GAME_STATUSES,
  GAME_CHARACTER_NAMES,
  gameBlank,
  gameToInput,
  gameValidate,
  gameDiffers,
  gameNormalize,
} from "./GameDetail";
export { GameContentPane } from "./GameContentPane";
export { GameConnectionsPane } from "./GameConnectionsPane";
export { GameEffectsPane } from "./GameEffectsPane";
export { GameChildPane, type GameChildPaneConfig } from "./GameChildPane";
export { InlineChildList, type InlineChildListConfig } from "./InlineChildList";
export { DefinitionChildren } from "./DefinitionChildren";
export {
  DefinitionFields,
  DEFINITION_STATUSES,
  definitionBlank,
  definitionToInput,
  definitionNormalize,
  definitionDiffers,
  definitionValidate,
  definitionLabel,
} from "./DefinitionDetail";
export {
  EffectFields,
  EFFECT_TRIGGERS,
  EFFECT_OPERATIONS,
  effectBlank,
  effectToInput,
  effectNormalize,
  effectDiffers,
  effectValidate,
  effectLabel,
} from "./EffectDetail";
export {
  MappingFields,
  mappingBlank,
  mappingToInput,
  mappingNormalize,
  mappingDiffers,
  mappingValidate,
  mappingLabel,
} from "./MappingDetail";
export { SlotsEditor } from "./SlotsEditor";
export {
  readSlots,
  writeSlots,
  validateSlots,
  type FormSlot,
  type SlotInputMode,
  type SlotsDoc,
  type SlotsRead,
} from "./slots";
export {
  INT4_MAX,
  INT4_MIN,
  intFieldOr,
  intText,
  optionalIntField,
  optionalIntText,
  optionalWholeNumberProblem,
  wholeNumberProblem,
} from "./fields";
export { IntegerInput, OptionalIntegerInput } from "./IntegerInput";
export { inlineUrlSelection } from "./inlineSelection";
export { sortByGroup } from "./group";
export { GamesFeature } from "./GamesFeature";
export { CreateGameAction } from "./CreateGameAction";
