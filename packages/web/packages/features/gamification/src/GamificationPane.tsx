"use client";

import type { ReactNode } from "react";

import { BackfillSection } from "./BackfillSection";
import { CatalogSection } from "./CatalogSection";
import { EventTypesSection } from "./EventTypesSection";
import { LevelsSection } from "./LevelsSection";
import { RealmCatalogProvider } from "./realm-catalog";
import { RealmSettingsPane } from "./RealmSettingsPane";

/**
 * The COMBINED gamification pane: realm config, then catalog, ladder, backfill and event types,
 * all in one scroller under one save bar. This is the hub's shape — the product rail's
 * Gamification topic and the workspace-level /<slug>/gamification route both mount it — and it is
 * unchanged from the pane those two have always rendered: same order, same `border-t … pt-6`
 * rules between sections, same `space-y-7` rhythm (the sections' old `mt-7` is what the scroller's
 * `space-y-7` already supplies between siblings).
 *
 * It exists ALONGSIDE the four topic panes rather than instead of them because the hub and the
 * gamification site want genuinely different things: the hub shows Gamification as one topic
 * among a product's twenty, so it must stay one destination; the site is nothing BUT gamification,
 * so its four parts earn four rail rows. The sections themselves are the shared substance — this
 * file and {@link topic-panes} are two arrangements of them, not two implementations.
 *
 * No `SettingsDirtyProvider` here: the hub's chrome already mounts one above every settings
 * surface, and each section reports into whichever registry it finds.
 */
export function GamificationPane({
  ecosystemId,
  help,
}: {
  ecosystemId?: string;
  /** Unused: the breadcrumb names the pane (kept for the ScopedPane prop shape). */
  title?: ReactNode;
  help?: ReactNode;
}) {
  return (
    <RealmCatalogProvider ecosystemId={ecosystemId}>
      <RealmSettingsPane ecosystemId={ecosystemId} help={help}>
        {/* Realm badges. */}
        <div className="border-t border-apt-border pt-6">
          <CatalogSection ecosystemId={ecosystemId} />
        </div>

        {/* The level ladder — the other half of the same catalog response. */}
        <div className="border-t border-apt-border pt-6">
          <LevelsSection ecosystemId={ecosystemId} />
        </div>

        {/* Re-grade existing members after either of the two above changed. */}
        <div className="border-t border-apt-border pt-6">
          <BackfillSection ecosystemId={ecosystemId} />
        </div>

        {/* Custom event types — its own endpoint, its own state. */}
        <div className="border-t border-apt-border pt-6">
          <EventTypesSection ecosystemId={ecosystemId} />
        </div>
      </RealmSettingsPane>
    </RealmCatalogProvider>
  );
}
