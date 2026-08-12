import type { ReactNode } from "react";

/**
 * Body of a settings feature. The feature title is rendered by SettingsLayout in
 * the shared header bar, and the help blurb lives in the tab-row popover
 * (FeatureTabs) — so this is just a section wrapper around the feature content.
 */
export function SettingsPanel({ children }: { children: ReactNode }) {
  return (
    <section className="settings-panel flex min-h-0 min-w-0 flex-1 flex-col">{children}</section>
  );
}
