"use client";

import { useRouter } from "next/navigation";
import { Fragment } from "react";
import type { ReactNode } from "react";
import { confirmNavigation } from "@agentic-toolkit/ui/lib/navigation-guard";
import { SettingsPanel } from "./SettingsPanel";
import { SettingsNavProvider, type SettingsNav } from "./settings-nav";
// NO `import "./settings.css"` here, deliberately — see package.json's "comment:styles".
// tsup extracts a side-effect CSS import into a sibling dist/index.css and DELETES the
// import from the emitted JS, so in a production build nothing would pull the stylesheet
// in and every rule below would be missing while `next dev` and vitest (which take the
// `development` condition straight to this source) looked perfect. The sheet ships as
// "@agentic-toolkit/account/styles.css" and is @imported by adh's adh-site.css, the one
// stylesheet all ~45 sites already load.

export interface Topic {
  id: string;
  label: string;
  icon?: ReactNode;
  dividerAfter?: boolean;
  /** Explicit navigation target for this item (each item can route anywhere). */
  href: string;
  /** Dimmed + non-clickable when true (e.g. scoped items while "All" is active). */
  disabled?: boolean;
  content: ReactNode;
}

export function SettingsLayout({
  topics,
  activeId,
  afterId,
  slot,
  slotActive,
  contentHeader,
  contentOverride,
  onNavigate,
}: {
  topics: Topic[];
  activeId?: string;
  /** Render `slot` as a nav row immediately after the item with this id. */
  afterId?: string;
  slot?: ReactNode;
  /** Move the selection bar onto the slot row (no topic is active). */
  slotActive?: boolean;
  /** Render as a full-width row above the whole topic|details grid (e.g. the
   *  resource action bar). Stays put as topics switch beneath it. */
  contentHeader?: ReactNode;
  /** Render this instead of the active topic's content (e.g. the "All" landing). */
  contentOverride?: ReactNode;
  /** Controlled mode: handle topic selection in-place instead of routing to
   *  `topic.href`. Used by the settings overlay so it can switch sections without
   *  navigating away from the route it's layered over. */
  onNavigate?: (topic: Topic) => void;
}) {
  const router = useRouter();
  const active = slotActive
    ? undefined
    : (topics.find((t) => t.id === activeId) ?? undefined);
  const content = contentOverride ?? active?.content;

  // Picking a section. A nav row is a <button> that calls router.push — which the shared
  // UnsavedChangesGuard does NOT intercept (it catches anchor clicks + programmatic navigations
  // that consult confirmNavigation). Uncontrolled (the /settings route), route through
  // confirmNavigation() so switching sections with a dirty panel open prompts Discard/Stay
  // instead of silently dropping the edits; with nothing dirty no guard is registered and it
  // resolves immediately, so ordinary navigation is unaffected.
  //
  // Controlled (the User Settings overlay) hands off UNGATED and returns: that caller runs its
  // own attemptExit/isAnyDirty gate around the section switch, and asking here too would be two
  // alerts for one decision.
  const selectTopic = async (t: Topic): Promise<void> => {
    if (onNavigate) {
      onNavigate(t);
      return;
    }
    if (!(await confirmNavigation())) return;
    router.push(t.href, { scroll: false });
  };

  // Published to the panels so one of them can send the user to a SIBLING section without
  // guessing a URL — see settings-nav.tsx for the 404 that motivated it. It routes through
  // the same selectTopic above, so a host in controlled mode (the overlay) switches in place
  // and a routed host (hub's /settings) navigates, with the dirty-panel gate each already
  // applies. Not memoized: `topics` is rebuilt every render by every caller
  // (buildSettingsTopics()), so a useMemo here would only ever miss.
  const nav: SettingsNav = {
    goToTopic: (topicId) => {
      const target = topics.find((t) => t.id === topicId);
      if (target) void selectTopic(target);
    },
  };

  const grid = (
    <div className="settings-layout">
      <aside className="settings-nav" aria-label="Settings sections">
        <ul>
          {slot && afterId === undefined && (
            <li className={`settings-nav-slot${slotActive ? " is-active" : ""}`}>
              {slot}
            </li>
          )}
          {topics.map((t) => (
            <Fragment key={t.id}>
              <li>
                <button
                  type="button"
                  disabled={t.disabled}
                  className={`settings-nav-item${t.id === active?.id ? " is-active" : ""}`}
                  onClick={() => {
                    void selectTopic(t);
                  }}
                >
                  {t.icon}
                  <span className="settings-nav-label">{t.label}</span>
                </button>
              </li>
              {t.dividerAfter && (
                <li className="settings-nav-divider" role="separator" />
              )}
              {slot && afterId === t.id && (
                <li className={`settings-nav-slot${slotActive ? " is-active" : ""}`}>
                  {slot}
                </li>
              )}
            </Fragment>
          ))}
        </ul>
      </aside>
      <main className="settings-content">
        {content && <SettingsPanel>{content}</SettingsPanel>}
      </main>
    </div>
  );

  // A `contentHeader` (the resource action bar) spans the full width above the
  // whole topic|details grid; without one, the grid stands alone as before.
  return (
    <SettingsNavProvider value={nav}>
      {!contentHeader ? (
        grid
      ) : (
        <div className="settings-shell">
          {contentHeader}
          {grid}
        </div>
      )}
    </SettingsNavProvider>
  );
}
