import type { ReactNode } from 'react';
/**
 * Binds the toolkit's hierarchical-view switch for the whole app — every topic/detail stack under
 * it (the workspace home and shell, the debug console, and the explorers the toolkit renders on
 * its own several layers down) answers to the one value set here.
 *
 * PARKED (2026-07-23): the platform renders the classic Hierarchical Topic Detail (HTDV) ONLY, so
 * this hard-codes `menuDetail={false}`. The cascading menu view (HMDV) and its
 * `use_hierarchical_menu_details_view` feature flag are SHELVED, not deleted — the toolkit switch
 * (HierarchicalDetailView + provider), the HMDV component, and the flag key all stay in place. To
 * bring the switch back, restore the flag read here:
 *
 *   // Package path, not a relative one: keeps the stateful flags module a preserved import (one
 *   // copy, shared with every other useFeatureFlag consumer) — see AdhAppShell and tsup.config.ts
 *   // `external`. Split across two packages (Task 5.3): the provider mechanism lives in the
 *   // toolkit, the FLAG vocabulary in the app tier — both now in this package, but still
 *   // two entries, so both specifiers stay full package paths.
 *   import { FlagState, useFeatureFlag } from '@agentic-toolkit/adh/flags'
 *   import { FLAG } from '@agentic-toolkit/adh/flags'
 *   const menuDetail = useFeatureFlag(FLAG.useHierarchicalMenuDetailsView) === FlagState.Yes
 *
 * and pass `menuDetail` below instead of the literal `false`. (When re-arming, mind the first-paint
 * remount the flag causes: the two views are different COMPONENTS, so a late Yes remounts the stack
 * and drops the detail pane's children — the flag must resolve at first paint, which the
 * `NEXT_PUBLIC_DEV_FEATURE_FLAGS` build-inline override does but the `dev_flags` cookie and the
 * backend flag table do not. See FeatureFlagsProvider's `buildFlags`.)
 *
 * ALSO WHEN RE-ARMING — the help modal is currently OUTSIDE this provider. Task 5.8 split the
 * shell in two: this flag now lives inside `AdhAppShell` (here), while `HelpProvider` is mounted
 * one level ABOVE it by `@agentic-toolkit/adh/layout`'s AppShell. Before the split the nesting was the
 * other way round, so HelpWindow's own <HierarchicalDetailView> sat under this provider; today it
 * reads MenuDetailViewContext's `createContext(false)` default instead. Identical while
 * `menuDetail` is hard-coded `false` — the moment you pass a real flag value here, the help
 * modal will keep rendering HTDV while the rest of the app switches. The fix is to re-nest:
 * either move HelpProvider inside AdhAppShell, or hoist this provider back above it in
 * `@agentic-toolkit/adh/layout`'s AppShell.
 */
export declare function HierarchicalDetailViewFlag({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
//# sourceMappingURL=HierarchicalDetailViewFlag.d.ts.map