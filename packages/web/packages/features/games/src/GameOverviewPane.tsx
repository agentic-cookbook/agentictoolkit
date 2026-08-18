"use client";

import type { ReactNode } from "react";
import { useMasterDetailForm, RecordSettingsPane } from "@agentic-toolkit/resource";
import { gamesApi, type Game, type GameInput } from "@agentic-toolkit/data/games";
import {
  GameIdentityFields,
  gameBlank,
  gameToInput,
  gameValidate,
  gameDiffers,
  gameNormalize,
} from "./GameDetail";

/**
 * The game's own record: what it is called and what it is about. A single-record pane —
 * creation is the workspace bar's Create Game button, and delete lives on this pane's
 * owner, so the hook gets neither `create` nor `remove` and RecordSettingsPane hides both
 * buttons.
 *
 * The form's `toInput` carries the WHOLE row even though only seven of its nine writable
 * fields are rendered here: the Engine topic edits the same record, so a partial input would
 * let a save on either side blank the other's fields.
 */
export function GameOverviewPane({
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
      emptyLabel="Select a game to edit it."
      renderDetail={(draft) => (
        <GameIdentityFields
          key={form.detailKey}
          draft={draft}
          onChange={form.onChange}
          error={form.error}
        />
      )}
    />
  );
}
