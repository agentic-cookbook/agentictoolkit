"use client";

import type { ReactNode } from "react";
import { useMasterDetailForm, RecordSettingsPane } from "@agentic-toolkit/resource";
import { gamesApi, type Game, type GameInput } from "@agentic-toolkit/data/games";
import {
  GameEngineFields,
  gameBlank,
  gameToInput,
  gameValidate,
  gameDiffers,
  gameNormalize,
} from "./GameDetail";

/**
 * How the game runs: which engine drives it, and the JSON that configures it. The other
 * half of the same `game.games` row the Overview topic edits — hence the identical form
 * config, differing only in which fields are rendered. adh hosts the backend, not the
 * engine, so this pane records the engine's name and hands its config through untouched
 * rather than knowing anything about it.
 */
export function GameEnginePane({
  gameId,
  items,
  refresh,
  loadError,
  title,
}: {
  gameId?: string;
  items: Game[] | null;
  refresh: () => void | Promise<void>;
  loadError?: string | null;
  title?: ReactNode;
}) {
  const form = useMasterDetailForm<Game, GameInput>({
    items,
    getId: (g) => g.id,
    blank: gameBlank,
    toInput: gameToInput,
    validate: (draft, others) => gameValidate(draft, others.map((g) => g.slug)),
    differs: gameDiffers,
    normalize: gameNormalize,
    update: (id, input) => gamesApi.update(id, input),
    refresh,
  });

  return (
    <RecordSettingsPane
      form={form}
      activeId={gameId}
      items={items}
      getId={(g) => g.id}
      title={title}
      loadError={loadError}
      emptyLabel="Select a game to configure its engine."
      renderDetail={(draft) => (
        <GameEngineFields
          key={form.detailKey}
          draft={draft}
          onChange={form.onChange}
          error={form.error}
        />
      )}
    />
  );
}
