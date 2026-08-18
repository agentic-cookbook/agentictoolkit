"use client";

import { useId } from "react";
import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { Select } from "@agentic-toolkit/ui/components/select";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { DetailSection } from "@agentic-toolkit/resource";
import { validateLeaf } from "@agentic-toolkit/ui/lib/rdid";
import type {
  Game,
  GameCharacterNames,
  GameEventLog,
  GameInput,
  GameStatus,
} from "@agentic-toolkit/data/games";
import { IntegerInput } from "./IntegerInput";
import { wholeNumberProblem } from "./fields";

/** The URL grammar reserves these as first segments, so no game may claim one as its slug. */
const RESERVED_SLUGS = ["all", "new"];

/** `game.games.status` — a closed set with a `check` behind it, so a select rather than a
 *  text field. The help is the schema's own distinction: `hidden` is delisted but still
 *  startable, which is what a boolean could never have expressed. */
export const GAME_STATUSES: { value: GameStatus; label: string }[] = [
  { value: "active", label: "Active — listed, and anyone can start it" },
  { value: "hidden", label: "Hidden — delisted, but still startable from a link or a save" },
  { value: "retired", label: "Retired — neither listed nor startable" },
];

/** `game.games.character_names` — whether players get a per-game name and picture. */
export const GAME_CHARACTER_NAMES: { value: GameCharacterNames; label: string }[] = [
  { value: "off", label: "Off — players appear under their account name" },
  { value: "optional", label: "Optional — players may set a character name and picture" },
  { value: "required", label: "Required — players must set one before they can start" },
];

/** `game.games.event_log` — whether the log is the truth. The distinction is retention:
 *  `authoritative` is never swept, so the day count below stops applying to it. */
export const GAME_EVENT_LOGS: { value: GameEventLog; label: string }[] = [
  { value: "debug", label: "Debug — kept for the retention window below, then swept" },
  { value: "authoritative", label: "Authoritative — the log is the truth, and is kept forever" },
];

/** `game.games.event_retention_days` — the column's own default. */
export const DEFAULT_EVENT_RETENTION_DAYS = 90;

export function gameBlank(): GameInput {
  return {
    slug: "",
    name: "",
    description: "",
    engine: "",
    engineConfig: "",
    // The four schema defaults, not a UI preference: in `game.games`, `character_names`
    // defaults to 'off', `status` to 'active', `event_log` to 'debug' and
    // `event_retention_days` to 90.
    characterNames: "off",
    status: "active",
    eventLog: "debug",
    eventRetentionDays: DEFAULT_EVENT_RETENTION_DAYS,
  };
}

/** The WHOLE editable row, not one pane's half: Overview and Engine edit the same record,
 *  so a partial input would let an Engine save blank the name. */
export function gameToInput(g: Game): GameInput {
  return {
    slug: g.slug,
    name: g.name,
    description: g.description,
    engine: g.engine,
    engineConfig: g.engineConfig,
    characterNames: g.characterNames,
    status: g.status,
    eventLog: g.eventLog,
    eventRetentionDays: g.eventRetentionDays,
  };
}

export function gameNormalize(d: GameInput): GameInput {
  return {
    slug: d.slug.trim(),
    name: d.name.trim(),
    description: d.description.trim(),
    engine: d.engine.trim(),
    engineConfig: d.engineConfig.trim(),
    // The three closed sets carry no whitespace to trim — they come from a select, and
    // the retention window is already a parsed number rather than text (see `fields.ts`).
    characterNames: d.characterNames,
    status: d.status,
    eventLog: d.eventLog,
    eventRetentionDays: d.eventRetentionDays,
  };
}

export function gameDiffers(a: GameInput, b: GameInput): boolean {
  return (
    a.slug !== b.slug ||
    a.name !== b.name ||
    a.description !== b.description ||
    a.engine !== b.engine ||
    a.engineConfig !== b.engineConfig ||
    a.characterNames !== b.characterNames ||
    a.status !== b.status ||
    a.eventLog !== b.eventLog ||
    a.eventRetentionDays !== b.eventRetentionDays
  );
}

/** Returns an error message, or null when the draft is valid. */
export function gameValidate(draft: GameInput, takenSlugs: string[]): string | null {
  if (!draft.name.trim()) return "Name is required.";
  const slug = draft.slug.trim();
  if (!slug) return "Slug is required.";
  // The slug becomes the leaf of the game's rdid (`game.<ecosystem>.<slug>`), so it obeys
  // the shared segment grammar rather than a second rule invented here.
  const slugErr = validateLeaf(slug);
  if (slugErr) return slugErr;
  if (RESERVED_SLUGS.includes(slug)) return `"${slug}" is reserved — pick another slug.`;
  if (takenSlugs.includes(slug)) return `Slug "${slug}" is already in use.`;
  const config = draft.engineConfig.trim();
  if (config) {
    try {
      JSON.parse(config);
    } catch {
      return "Engine config must be valid JSON.";
    }
  }
  // The column's own `games_event_retention_days_chk` is `> 0`, and it applies whatever
  // `event_log` says — `authoritative` stops the sweep READING the window, it does not
  // make the column accept a zero. So the bound is checked unconditionally rather than
  // only on the branch that uses it, which is what the constraint actually does.
  if (!Number.isInteger(draft.eventRetentionDays)) return wholeNumberProblem("Event retention");
  if (draft.eventRetentionDays < 1) return "Event retention must be at least one day.";
  return null;
}

function set<K extends keyof GameInput>(
  draft: GameInput,
  onChange: (next: GameInput) => void,
  key: K,
  value: GameInput[K],
) {
  onChange({ ...draft, [key]: value } as GameInput);
}

/**
 * The game's identity — what it is called, what it is about, and the four operator
 * switches adh itself READS AND ACTS ON: `status` and `character_names` (the profile route
 * rejects a blank name when names are required), then `event_log` and
 * `event_retention_days`, which the retention sweep deletes rows on the strength of.
 *
 * That is the line these fields sit on, and it is the schema's own: `engine` and
 * `engine_config` are OPAQUE to adh and belong to the Engine topic; everything here is a
 * switch adh reads. Controlled; Save/Cancel live in the pane's button bar or the create
 * dialog's footer. With `title` the fields sit in a titled DetailSection (the pane);
 * without it they render bare (the dialog).
 */
export function GameIdentityFields({
  title,
  draft,
  onChange,
  error,
}: {
  title?: string;
  draft: GameInput;
  onChange: (next: GameInput) => void;
  error?: string | null;
}) {
  const uid = useId();
  const nameId = `${uid}-name`;
  const slugId = `${uid}-slug`;
  const descriptionId = `${uid}-description`;
  const statusId = `${uid}-status`;
  const charactersId = `${uid}-character-names`;
  const eventLogId = `${uid}-event-log`;
  const retentionId = `${uid}-event-retention-days`;

  const body = (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor={nameId}>Name</Label>
          <Input
            id={nameId}
            placeholder="The Cavern"
            value={draft.name}
            onChange={(e) => set(draft, onChange, "name", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={slugId}>Slug</Label>
          <Input
            id={slugId}
            placeholder="cavern"
            value={draft.slug}
            onChange={(e) => set(draft, onChange, "slug", e.target.value.toLowerCase())}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <p className="text-xs text-apt-text-muted">
            Lowercase letters, digits, and interior hyphens. It becomes the last part of the
            game&rsquo;s identifier and cannot be <code>all</code> or <code>new</code>.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={descriptionId}>Description</Label>
          <Textarea
            id={descriptionId}
            rows={3}
            placeholder="One or two sentences about what this game is."
            value={draft.description}
            onChange={(e) => set(draft, onChange, "description", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={statusId}>Status</Label>
          <Select
            id={statusId}
            value={draft.status}
            onChange={(e) => set(draft, onChange, "status", e.target.value as GameStatus)}
          >
            {GAME_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={charactersId}>Character names</Label>
          <Select
            id={charactersId}
            value={draft.characterNames}
            onChange={(e) =>
              set(draft, onChange, "characterNames", e.target.value as GameCharacterNames)
            }
          >
            {GAME_CHARACTER_NAMES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-apt-text-muted">
            Whether a player gets a display name and picture that belong to THIS game, instead
            of playing under their account&rsquo;s.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={eventLogId}>Event log</Label>
          <Select
            id={eventLogId}
            value={draft.eventLog}
            onChange={(e) => set(draft, onChange, "eventLog", e.target.value as GameEventLog)}
          >
            {GAME_EVENT_LOGS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={retentionId}>Event retention (days)</Label>
          <IntegerInput
            id={retentionId}
            value={draft.eventRetentionDays}
            fallback={DEFAULT_EVENT_RETENTION_DAYS}
            placeholder={String(DEFAULT_EVENT_RETENTION_DAYS)}
            onChange={(eventRetentionDays) =>
              set(draft, onChange, "eventRetentionDays", eventRetentionDays)
            }
          />
          <p className="text-xs text-apt-text-muted">
            {draft.eventLog === "authoritative"
              ? "Not applied while the log is authoritative — those events are never swept — but still stored, and used again if you switch back to Debug."
              : "How long a debug game's events are kept before they are swept. Empty means the default, 90."}
          </p>
        </div>
        <ErrorText error={error} />
      </CardContent>
    </Card>
  );

  return title ? <DetailSection title={title}>{body}</DetailSection> : body;
}

/** How the game RUNS — which engine drives it and how that engine is configured. */
export function GameEngineFields({
  title,
  draft,
  onChange,
  error,
}: {
  title?: string;
  draft: GameInput;
  onChange: (next: GameInput) => void;
  error?: string | null;
}) {
  const uid = useId();
  const engineId = `${uid}-engine`;
  const configId = `${uid}-engine-config`;

  const body = (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor={engineId}>Engine</Label>
          <Input
            id={engineId}
            placeholder="ink"
            value={draft.engine}
            onChange={(e) => set(draft, onChange, "engine", e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <p className="text-xs text-apt-text-muted">
            The runtime this game is built for. adh hosts the backend, not the engine.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={configId}>Engine config</Label>
          <Textarea
            id={configId}
            rows={10}
            placeholder="{}"
            value={draft.engineConfig}
            onChange={(e) => set(draft, onChange, "engineConfig", e.target.value)}
            className="font-mono text-xs"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <p className="text-xs text-apt-text-muted">
            JSON handed to the engine as-is. Leave it empty for the engine&rsquo;s defaults.
          </p>
        </div>
        <ErrorText error={error} />
      </CardContent>
    </Card>
  );

  return title ? <DetailSection title={title}>{body}</DetailSection> : body;
}
