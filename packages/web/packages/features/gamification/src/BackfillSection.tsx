"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";

import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { isForbidden } from "@agentic-toolkit/data";
import { gamificationApi } from "@agentic-toolkit/data/gamification";
import { Button } from "@agentic-toolkit/ui/components/button";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";

import { useRealmCatalog } from "./realm-catalog";
import { forbiddenAware } from "./err-text";

/**
 * Re-grade every member from telemetry already earned (POST /gamification/replay).
 *
 * Its own component, and mounted TWICE on the gamification site — once under Catalog, once under
 * Levels — because it is the follow-through for a change in either: adding a badge and raising a
 * rung both leave existing members ungraded, and the ladder's own success note says "Backfill to
 * re-grade existing members" in so many words. Replay is idempotent (it recomputes from stored
 * telemetry rather than appending), so two entry points are two doors to one safe action, not two
 * actions. The hub's combined pane shows it once, at the bottom, exactly as before.
 */

const errText = forbiddenAware("You don't have access to change this realm's catalog.");

export function BackfillSection({ ecosystemId }: { ecosystemId?: string }) {
  const { catalog, refresh } = useRealmCatalog();

  const [backfilling, setBackfilling] = useState(false);
  const [backfillNote, setBackfillNote] = useState<string | null>(null);
  const [backfillError, setBackfillError] = useState<string | null>(null);

  if (!ecosystemId) return null;
  // Gated on the catalog like the pre-split section was: until the realm's config has loaded there
  // is nothing to re-grade AGAINST, and an enabled button here would fire a replay against a
  // catalog the user has not seen.
  if (!catalog) return null;

  async function backfill() {
    if (!ecosystemId) return;
    setBackfilling(true);
    setBackfillNote(null);
    setBackfillError(null);
    try {
      const res = await gamificationApi.replayRealm(ecosystemId);
      setBackfillNote(`Backfilled ${res.subjects} members, ${res.badges} badges.`);
      await refresh();
    } catch (err) {
      if (!isForbidden(err)) {
        reportUnexpectedAuthError(err, { feature: "gamification-catalog", step: "replay" });
      }
      setBackfillError(errText(err, "Could not backfill."));
    } finally {
      setBackfilling(false);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-sm font-medium text-apt-text">Backfill</p>
          <p className="mt-0.5 text-xs text-apt-text-muted">
            Re-grade every member from telemetry already earned — award new badges and re-level
            after catalog changes.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={backfilling} onClick={backfill}>
          <RotateCcw data-icon="inline-start" />
          {backfilling ? "Backfilling…" : "Backfill now"}
        </Button>
      </div>
      {backfillNote && <p className="mt-3 text-sm text-apt-green">{backfillNote}</p>}
      <ErrorText error={backfillError} className="mt-3" />
    </div>
  );
}
