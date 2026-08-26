"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { isForbidden } from "@agentic-toolkit/data";
import { gamificationApi, type LevelRung } from "@agentic-toolkit/data/gamification";
import { useReportSettingsDirty } from "@agentic-toolkit/resource";
import { Button } from "@agenticdevelopertoolkit/ui/components/button";
import { Field } from "@agenticdevelopertoolkit/ui/blocks";
import { Input } from "@agenticdevelopertoolkit/ui/components/input";
import { ErrorText } from "@agenticdevelopertoolkit/ui/components/error-text";

import { useRealmCatalog } from "./realm-catalog";
import { forbiddenAware } from "./err-text";

/**
 * The realm's LEVEL LADDER: the ordered rungs members climb as points accrue. Rungs must start at
 * 0 and strictly increase; PUT …/levels replaces the ladder wholesale and the server enforces the
 * ordering rule, surfaced here on 400.
 *
 * The ladder arrives in the same GET …/catalog response as the badges, so it reads through
 * {@link useRealmCatalog} rather than fetching — see that file for why the two sections share one
 * owner. A save re-reads through the same `refresh`, because replacing the ladder re-tags the
 * badge rows' `source` and the catalog view beside it would otherwise be stale.
 */

interface RungDraft {
  name: string;
  minPoints: string;
}

/** The ladder body the rungs would be SAVED as. One function, two callers: `saveLadder` sends it
 *  and `ladderDirty` diffs it — the first rung's minPoints is forced to 0 and every name is
 *  trimmed, so diffing the raw drafts lit "Save ladder" up for edits the write throws away. */
function ladderPayload(rungs: RungDraft[]): LevelRung[] {
  // First rung always anchors at 0; the rest coerce from their inputs and the
  // server enforces the strictly-increasing rule (surfaced on 400).
  return rungs.map((r, i) => ({
    name: r.name.trim(),
    minPoints: i === 0 ? 0 : Number(r.minPoints),
  }));
}

const errText = forbiddenAware("You don't have access to change this realm's catalog.");

export function LevelsSection({ ecosystemId }: { ecosystemId?: string }) {
  const { catalog, loadError, refresh } = useRealmCatalog();

  const [rungs, setRungs] = useState<RungDraft[]>([]);
  const [ladderBaseline, setLadderBaseline] = useState<string>("[]");
  const [ladderError, setLadderError] = useState<string | null>(null);
  const [ladderNote, setLadderNote] = useState<string | null>(null);
  const [savingLadder, setSavingLadder] = useState(false);

  // Re-seed from whatever the shared catalog currently says. Any refresh re-seeds — including one
  // a SIBLING section triggers (a badge save) — which is the pre-split behaviour exactly:
  // `applyCatalog` set the rungs on every read, so an unsaved ladder edit has always lost to a
  // catalog re-read. Preserved deliberately rather than "fixed" here: the write is a wholesale
  // replace, so silently keeping a draft over fresher server rungs is the more dangerous of the
  // two.
  useEffect(() => {
    if (!catalog) return;
    const next = catalog.levels.map((l) => ({ name: l.name, minPoints: String(l.minPoints) }));
    setRungs(next);
    setLadderBaseline(JSON.stringify(next));
  }, [catalog]);

  // `ladderBaseline` stays the raw RungDraft snapshot because `resetLadder` restores from it; only
  // the COMPARISON runs through `ladderPayload`, so what the user gets back on Cancel is exactly
  // what they had, while Save lights up only for a change the write would actually carry.
  const ladderDirty = useMemo(
    () =>
      JSON.stringify(ladderPayload(rungs)) !==
      JSON.stringify(ladderPayload(JSON.parse(ladderBaseline) as RungDraft[])),
    [rungs, ladderBaseline],
  );

  // The ladder has no close path of its own — Save/Reset sit inline on the page — so the settings
  // registry is its ONLY guard against the exits it can't see: reload, a link click, a rail row
  // switch. A real payload diff, so a no-op edit the write would drop never arms it.
  useReportSettingsDirty("gamification-levels", ladderDirty);

  if (!ecosystemId) return null;

  function patchRung(i: number, next: Partial<RungDraft>) {
    setLadderNote(null);
    setLadderError(null);
    setRungs((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...next } : r)));
  }

  function addRung() {
    setLadderNote(null);
    setRungs((prev) => [...prev, { name: "", minPoints: "" }]);
  }

  function removeRung(i: number) {
    setLadderNote(null);
    setRungs((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function saveLadder() {
    if (!ecosystemId) return;
    if (rungs.length === 0) {
      setLadderError("Add at least one rung (the first must start at 0).");
      return;
    }
    const payload = ladderPayload(rungs);
    if (payload.some((r) => !r.name)) {
      setLadderError("Every rung needs a name.");
      return;
    }
    if (payload.some((r) => !Number.isFinite(r.minPoints))) {
      setLadderError("Every rung's minimum points must be a number.");
      return;
    }
    setSavingLadder(true);
    setLadderError(null);
    setLadderNote(null);
    try {
      const res = await gamificationApi.putRealmLevels(ecosystemId, payload);
      const nextRungs = res.levels.map((l) => ({ name: l.name, minPoints: String(l.minPoints) }));
      setRungs(nextRungs);
      setLadderBaseline(JSON.stringify(nextRungs));
      setLadderNote("Ladder saved. Backfill to re-grade existing members.");
      // Levels feed the badge/level catalog view too — refresh the source tags. Through the shared
      // provider, so the Catalog section re-reads whether it is a sibling in this scroller (the
      // hub) or the topic next door (the gamification site).
      await refresh();
    } catch (err) {
      if (!isForbidden(err)) {
        reportUnexpectedAuthError(err, { feature: "gamification-catalog", step: "save-levels" });
      }
      setLadderError(errText(err, "Could not save the ladder."));
    } finally {
      setSavingLadder(false);
    }
  }

  function resetLadder() {
    setRungs(JSON.parse(ladderBaseline) as RungDraft[]);
    setLadderError(null);
    setLadderNote(null);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-sm font-medium text-apt-text">Level ladder</p>
          <p className="mt-0.5 text-xs text-apt-text-muted">
            Rungs must start at 0 and strictly increase. Saving replaces the ladder wholesale.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={addRung} aria-label="Add rung">
          <Plus data-icon="inline-start" />
          Add rung
        </Button>
      </div>

      {/* The load error belongs here as well as on the Catalog section: as its own topic this is
          the only thing on screen, and an empty rung list with no explanation reads as "this realm
          has no levels" — the opposite of what a 403 means. */}
      <ErrorText error={loadError} className="mt-4" />
      {!catalog && !loadError && <p className="mt-4 text-sm text-apt-text-muted">Loading…</p>}

      {catalog && (
        <>
          <div className="mt-3 flex flex-col gap-2">
            {rungs.map((r, i) => (
              <div key={i} className="flex items-end gap-2">
                <Field label={i === 0 ? "Rung (start)" : "Rung"} className="flex-1">
                  <Input
                    value={r.name}
                    onChange={(e) => patchRung(i, { name: e.target.value })}
                    placeholder="Novice"
                    aria-label={`Rung ${i + 1} name`}
                  />
                </Field>
                <Field label="Min points" className="w-32">
                  <Input
                    type="number"
                    value={i === 0 ? "0" : r.minPoints}
                    disabled={i === 0}
                    onChange={(e) => patchRung(i, { minPoints: e.target.value })}
                    aria-label={`Rung ${i + 1} minimum points`}
                  />
                </Field>
                <Button
                  variant="destructive-ghost"
                  size="icon"
                  className="mb-px"
                  disabled={i === 0}
                  onClick={() => removeRung(i)}
                  aria-label={`Remove rung ${i + 1}`}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>

          <ErrorText error={ladderError} className="mt-2" />

          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              disabled={!ladderDirty || savingLadder}
              onClick={saveLadder}
              className={ladderDirty && !savingLadder ? "bg-apt-gold text-apt-bg hover:bg-apt-gold-bright" : ""}
            >
              {savingLadder ? "Saving…" : "Save ladder"}
            </Button>
            <Button variant="ghost" size="sm" disabled={!ladderDirty || savingLadder} onClick={resetLadder}>
              Reset
            </Button>
            {ladderNote && !ladderDirty && (
              <span className="text-xs text-apt-text-muted">{ladderNote}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
