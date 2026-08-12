"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { isForbidden, useResourceItemQuery, useResourceItemWriter } from "@agentic-toolkit/data";
import {
  gamificationApi,
  type RealmConfig,
  type RealmConfigInput,
} from "@agentic-toolkit/data/gamification";
import { EditActionBar, SettingsDirtyProvider, useReportSettingsDirty } from "@agentic-toolkit/resource";
import { Field } from "@agentic-toolkit/ui/blocks";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { Select } from "@agentic-toolkit/ui/components/select";
import { Switch } from "@agentic-toolkit/ui/components/switch";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";

/**
 * The product's GAMIFICATION REALM config (each product IS an ecosystem = a "realm"). A
 * single-record config pane — local edit state + the shared EditActionBar, the same shape
 * as the hub's AuthPane, NOT a list-based master/detail. Reads/writes
 * /gamification/realms/:eco/config: an `enabled` toggle, a `skin` select (rpg / plain), a
 * reference `timezone`, four per-surface toggles (badges / leaderboards / streaks / recaps),
 * and the optional seasons window. Enabling a realm (false → true) triggers a retroactive
 * replay server-side, whose result is surfaced inline ("Backfilled N members, M badges").
 *
 * `children` is what makes this serve BOTH hosts from one file. This pane owns the save bar
 * and the scroll container, so the hub's single combined pane cannot be "this plus three
 * siblings" laid out beside it — the siblings have to render INSIDE this scroller, under this
 * bar. So the hub passes them as children ({@link GamificationPane}) and the gamification
 * site, where each is its own topic, passes none. A `variant` flag would have said the same
 * thing less honestly: the difference between the two hosts genuinely is "what else is in the
 * scroller", not a mode this component switches on.
 */

const SKINS: { value: "rpg" | "plain"; label: string; help: string }[] = [
  { value: "rpg", label: "RPG", help: "Adventurer framing — levels, quests, and badges." },
  { value: "plain", label: "Plain", help: "Neutral progress framing without the RPG dressing." },
];

// A short, curated list of common IANA zones — plain-text `timezone/timezone.json` coverage
// is overkill for a Select; the realm always has SOME real zone name stored (default 'UTC').
const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Moscow",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

const ANCHOR_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A real YYYY-MM-DD date, rejecting values JS's lenient Date parsing would otherwise
 *  normalize (e.g. 2026-02-30 → 2026-03-02) — mirrors the backend's parseAnchorMs
 *  (gamification-seasons.ts), so a value that passes here also passes there. */
function seasonAnchorError(anchor: string): string | null {
  if (!ANCHOR_RE.test(anchor)) return "Enter a date as YYYY-MM-DD.";
  const ms = Date.parse(`${anchor}T00:00:00.000Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== anchor) {
    return "Not a real calendar date.";
  }
  return null;
}

/** A whole number of days, 1..366 (one leap year) — mirrors MAX_SEASON_LENGTH_DAYS. */
function seasonLengthError(raw: string): string | null {
  if (!/^\d+$/.test(raw.trim())) return "Enter a whole number of days.";
  const n = Number(raw);
  if (n < 1 || n > 366) return "Must be between 1 and 366 days.";
  return null;
}

// A surface is ON unless explicitly set false, so each toggle initializes from
// `surfaces[key] !== false` and the config's stored map is the source of truth.
const SURFACES: { key: SurfaceKey; label: string; help: string }[] = [
  { key: "badges", label: "Badges", help: "Award and display achievement badges." },
  { key: "leaderboards", label: "Leaderboards", help: "Rank members on public boards." },
  { key: "streaks", label: "Streaks", help: "Track and reward consecutive-day activity." },
  { key: "recaps", label: "Recaps", help: "Periodic progress recaps for members." },
];

type SurfaceKey = "badges" | "leaderboards" | "streaks" | "recaps";

interface Draft {
  enabled: boolean;
  skin: "rpg" | "plain";
  timezone: string;
  surfaces: Record<SurfaceKey, boolean>;
  // Seasons' anchor/lengthDays are held as strings (like the level ladder's rungs) so the
  // inputs can be cleared mid-edit; they're coerced + validated on save.
  seasonsOn: boolean;
  seasonsAnchor: string;
  seasonsLengthDays: string;
}

function toDraft(cfg: RealmConfig): Draft {
  return {
    enabled: cfg.enabled,
    skin: cfg.skin,
    // Defensive default: keeps the Select controlled even if a caller's config predates
    // `timezone` (unset realms still get 'UTC' server-side).
    timezone: cfg.timezone ?? "UTC",
    surfaces: {
      badges: cfg.surfaces.badges !== false,
      leaderboards: cfg.surfaces.leaderboards !== false,
      streaks: cfg.surfaces.streaks !== false,
      recaps: cfg.surfaces.recaps !== false,
    },
    seasonsOn: cfg.seasons != null,
    seasonsAnchor: cfg.seasons?.anchor ?? "",
    seasonsLengthDays: cfg.seasons ? String(cfg.seasons.lengthDays) : "",
  };
}

/**
 * Read one realm's gamification config, classifying the failure itself.
 *
 * A 403 is EXPECTED here — it is what a realm the caller cannot administer returns — so it becomes
 * a sentence about permissions and is deliberately NOT reported as an incident. That is why the
 * call site passes `reportErrors: false`: this function reports the failures worth reporting, and
 * one failure reported twice under two contexts would be worse than none.
 *
 * Module scope, so one identity serves every mount. The realm is the query key's id, not something
 * closed over.
 */
async function loadRealmConfig(ecosystemId: string): Promise<RealmConfig> {
  try {
    return await gamificationApi.getRealmConfig(ecosystemId);
  } catch (err) {
    if (isForbidden(err)) {
      throw new Error("You don't have access to this realm's gamification settings.");
    }
    reportUnexpectedAuthError(err, { feature: "gamification-realm", step: "load" });
    // A non-Error rejection would otherwise reach the user as the hook's generic wording; keep the
    // sentence this pane has always shown for it.
    throw err instanceof Error ? err : new Error("Failed to load gamification settings.");
  }
}

export function RealmSettingsPane({
  ecosystemId,
  help,
  children,
}: {
  ecosystemId?: string;
  /** Unused: the breadcrumb names the pane (kept for the ScopedPane prop shape). */
  title?: ReactNode;
  help?: ReactNode;
  /** Rendered at the END of this pane's scroller, under its save bar — see the file doc. */
  children?: ReactNode;
}) {
  // Cached per realm, so coming back to this topic paints the saved settings on the first frame
  // and revalidates behind them, instead of blanking to "Loading…" on every visit.
  const { item: config, error: loadError } = useResourceItemQuery<RealmConfig>(
    "realm-config",
    ecosystemId ?? null,
    loadRealmConfig,
    { reportErrors: false },
  );
  const writeConfig = useResourceItemWriter<RealmConfig>("realm-config");

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  // The saved baseline the draft is diffed against, so `dirty` is a real edit — not just a
  // second render with structurally-equal values.
  const baseline = useMemo(() => (config ? toDraft(config) : null), [config]);
  const dirty = useMemo(
    () => !!draft && !!baseline && JSON.stringify(draft) !== JSON.stringify(baseline),
    [draft, baseline],
  );

  // Seed the draft from the server's copy — but NEVER over an unsaved edit. Caching is what makes
  // that distinction necessary: a re-read can now land mid-edit, because it revalidates behind the
  // instant paint, where the pre-cache code read once per realm and could not. Losing typing to a
  // background refetch is the one thing this pane must not do; while the draft is dirty the save
  // bar is up and Save or Cancel is the user's own call. `baseline` follows `config` either way, so
  // a kept draft is diffed against what the server NOW has.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (config) setDraft((prev) => (prev && dirtyRef.current ? prev : toDraft(config)));
  }, [config]);

  // Validated only while seasons are ON, so a save with seasons untouched (or turned off) is
  // never blocked by a stale anchor/lengthDays left over from a prior edit.
  const seasonsAnchorError = draft?.seasonsOn ? seasonAnchorError(draft.seasonsAnchor) : null;
  const seasonsLengthError = draft?.seasonsOn ? seasonLengthError(draft.seasonsLengthDays) : null;
  const canSave = dirty && !seasonsAnchorError && !seasonsLengthError;

  // Report unsaved edits to the registry so an exit can warn before discarding them
  // — the same wiring as Auth/Account/Profile.
  useReportSettingsDirty("gamification-realm", dirty);

  const patch = useCallback((next: Partial<Draft>) => {
    setSavedNote(null);
    setDraft((prev) => (prev ? { ...prev, ...next } : prev));
  }, []);

  const setSurface = useCallback((key: SurfaceKey, on: boolean) => {
    setSavedNote(null);
    setDraft((prev) => (prev ? { ...prev, surfaces: { ...prev.surfaces, [key]: on } } : prev));
  }, []);

  const save = useCallback(async () => {
    if (!ecosystemId || !draft || !baseline || !canSave) return;
    setSaving(true);
    setSaveError(null);
    setSavedNote(null);

    // Send only the changed fields. When any surface changed, send the FULL 4-key map so the
    // persisted state matches the UI regardless of the backend's merge-vs-replace semantics
    // (a surface is ON unless explicitly false, so an explicit `true` is always harmless).
    const body: RealmConfigInput = {};
    if (draft.enabled !== baseline.enabled) body.enabled = draft.enabled;
    if (draft.skin !== baseline.skin) body.skin = draft.skin;
    if (draft.timezone !== baseline.timezone) body.timezone = draft.timezone;
    const surfacesChanged = SURFACES.some((s) => draft.surfaces[s.key] !== baseline.surfaces[s.key]);
    if (surfacesChanged) body.surfaces = { ...draft.surfaces };
    // seasons: undefined (omitted) = leave unchanged; null = clear; an object sets the window.
    // Already blocked from reaching here while invalid (`canSave` above).
    const seasonsChanged =
      draft.seasonsOn !== baseline.seasonsOn ||
      (draft.seasonsOn &&
        (draft.seasonsAnchor !== baseline.seasonsAnchor ||
          draft.seasonsLengthDays !== baseline.seasonsLengthDays));
    if (seasonsChanged) {
      body.seasons = draft.seasonsOn
        ? { anchor: draft.seasonsAnchor, lengthDays: Number(draft.seasonsLengthDays) }
        : null;
    }

    try {
      const res = await gamificationApi.updateRealmConfig(ecosystemId, body);
      // The server's own answer, written straight into the cache rather than invalidated: it is
      // already in hand, so a re-read would spend a request to arrive back at these bytes.
      writeConfig(ecosystemId, res.config);
      setDraft(toDraft(res.config));
      setSavedNote(
        res.replayed
          ? `Realm enabled — backfilled ${res.replayed.subjects} members, ${res.replayed.badges} badges.`
          : "Saved.",
      );
    } catch (err) {
      if (!isForbidden(err)) {
        reportUnexpectedAuthError(err, { feature: "gamification-realm", step: "save" });
      }
      setSaveError(
        isForbidden(err)
          ? "You don't have access to change this realm's gamification settings."
          : err instanceof Error
            ? err.message
            : "Failed to save gamification settings.",
      );
    } finally {
      setSaving(false);
    }
  }, [ecosystemId, draft, baseline, canSave, writeConfig]);

  const cancel = useCallback(() => {
    if (config) setDraft(toDraft(config));
    setSaveError(null);
    setSavedNote(null);
  }, [config]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <EditActionBar
        dirty={dirty}
        canSave={canSave}
        saving={saving}
        onCancel={cancel}
        onSave={save}
        status={
          saveError ? (
            <span className="text-apt-red">{saveError}</span>
          ) : savedNote && !dirty ? (
            <span className="text-apt-text-muted">{savedNote}</span>
          ) : null
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl space-y-7">
          {help && <p className="text-sm text-apt-text-muted">{help}</p>}
          <ErrorText error={loadError} />
          {!draft && !loadError && <p className="text-sm text-apt-text-muted">Loading…</p>}

          {draft && (
            <>
              {/* Enabled */}
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <Label htmlFor="gamification-enabled" className="text-sm font-medium text-apt-text">
                    Enable gamification
                  </Label>
                  <p className="mt-0.5 text-xs text-apt-text-muted">
                    When off, telemetry keeps flowing but awards and gamification UI are
                    suppressed. Enabling backfills existing members.
                  </p>
                </div>
                <Switch
                  id="gamification-enabled"
                  checked={draft.enabled}
                  onCheckedChange={(enabled) => patch({ enabled })}
                />
              </div>

              {/* Skin */}
              <div className="flex flex-col gap-2 border-t border-apt-border pt-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                <div className="min-w-0">
                  <Label htmlFor="gamification-skin" className="text-sm font-medium text-apt-text">
                    Skin
                  </Label>
                  <p className="mt-0.5 text-xs text-apt-text-muted">
                    {SKINS.find((s) => s.value === draft.skin)?.help}
                  </p>
                </div>
                <Select
                  id="gamification-skin"
                  value={draft.skin}
                  onChange={(e) => patch({ skin: e.target.value as "rpg" | "plain" })}
                >
                  {SKINS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Timezone */}
              <div className="flex flex-col gap-2 border-t border-apt-border pt-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                <div className="min-w-0">
                  <Label htmlFor="gamification-timezone" className="text-sm font-medium text-apt-text">
                    Timezone
                  </Label>
                  <p className="mt-0.5 text-xs text-apt-text-muted">
                    Reference zone for the realm&apos;s late-night (Night Owl) window. Day and
                    streak rollups stay UTC.
                  </p>
                </div>
                <Select
                  id="gamification-timezone"
                  value={draft.timezone}
                  onChange={(e) => patch({ timezone: e.target.value })}
                >
                  {/* A realm's stored zone can be any IANA name (set via the API), not just one of
                      the curated 16 — surface it as its own option so the Select never silently
                      misrepresents (or, on save, overwrites) a zone outside the shortlist. */}
                  {((TIMEZONES as readonly string[]).includes(draft.timezone)
                    ? TIMEZONES
                    : [draft.timezone, ...TIMEZONES]
                  ).map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Surfaces */}
              <div className="border-t border-apt-border pt-6">
                <p className="text-sm font-medium text-apt-text">Surfaces</p>
                <p className="mt-0.5 text-xs text-apt-text-muted">
                  Which gamification surfaces are shown to members. Each is on unless turned off.
                </p>
                <div className="mt-4 flex flex-col gap-5">
                  {SURFACES.map((s) => (
                    <div key={s.key} className="flex items-start justify-between gap-6">
                      <div className="min-w-0">
                        <Label
                          htmlFor={`gamification-surface-${s.key}`}
                          className="text-sm font-medium text-apt-text"
                        >
                          {s.label}
                        </Label>
                        <p className="mt-0.5 text-xs text-apt-text-muted">{s.help}</p>
                      </div>
                      <Switch
                        id={`gamification-surface-${s.key}`}
                        checked={draft.surfaces[s.key]}
                        onCheckedChange={(on) => setSurface(s.key, on)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Seasons — a read-model window over existing stats; off (null) leaves the
                  season board absent. Wired into THIS pane's draft/save bar, not a second one. */}
              <div className="border-t border-apt-border pt-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <Label htmlFor="gamification-seasons-on" className="text-sm font-medium text-apt-text">
                      Seasons
                    </Label>
                    <p className="mt-0.5 text-xs text-apt-text-muted">
                      Opt into a recurring season board, resetting every N days from an anchor
                      date.
                    </p>
                  </div>
                  <Switch
                    id="gamification-seasons-on"
                    checked={draft.seasonsOn}
                    onCheckedChange={(on) => patch({ seasonsOn: on })}
                  />
                </div>
                {draft.seasonsOn && (
                  <div className="mt-4 flex flex-col gap-4 sm:flex-row">
                    <Field label="Season 0 anchor" error={seasonsAnchorError ?? undefined} className="flex-1">
                      <Input
                        type="date"
                        value={draft.seasonsAnchor}
                        aria-invalid={!!seasonsAnchorError}
                        onChange={(e) => patch({ seasonsAnchor: e.target.value })}
                      />
                    </Field>
                    <Field label="Length (days)" error={seasonsLengthError ?? undefined} className="w-36">
                      <Input
                        type="number"
                        min={1}
                        max={366}
                        value={draft.seasonsLengthDays}
                        aria-invalid={!!seasonsLengthError}
                        onChange={(e) => patch({ seasonsLengthDays: e.target.value })}
                      />
                    </Field>
                  </div>
                )}
              </div>

              {children}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** The Settings TOPIC (the gamification site's fourth topic): the realm config alone, in its
 *  own guard registry. The provider goes here rather than around the whole feature because it
 *  has to sit INSIDE the rail host ResourceExplorer mounts — outside it, `useRailExitGuard`
 *  finds no host and the rail's own level-switch guard never learns the pane is dirty. Nested
 *  inside a host that already has one (the hub), the provider defers, so this is safe to
 *  compose anywhere. */
export function GamificationSettingsTopicPane(props: { ecosystemId?: string; help?: ReactNode }) {
  return (
    <SettingsDirtyProvider>
      <RealmSettingsPane {...props} />
    </SettingsDirtyProvider>
  );
}
