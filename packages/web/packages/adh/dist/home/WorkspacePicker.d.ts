import { type ReactElement } from 'react';
import type { Workspace } from '@agentic-toolkit/data';
/**
 * The workspace switcher in SiteHomeShell's bar: a plain PopupMenu over the caller's
 * owner-scopable workspaces. Presentational and data-free — it takes a list and a callback, so
 * the mounted one and the tested one cannot drift apart.
 *
 * A switcher, and nothing else: no "All" row (one workspace is always chosen), and no "New
 * Organization" — org creation is the hub's, where NewOrganizationModal lives.
 *
 * `allLabel` doubles as PopupMenu's EMPTY-SELECTION trigger text, which is why the three
 * pre-selection states ride on it rather than on a fourth prop. Each renders one inert row in the
 * open menu, which says the same thing the trigger does. The third state is reachable, not
 * theoretical: `workspaces` can load (non-empty) before `selected` does — SiteHomeShell resolves
 * a workspace only once its prefs GET settles (or its 5s bail fires), and that GET can easily
 * outlast the workspace list's own fetch. Without folding it into "Loading…" too, that window
 * renders a blank trigger — a real state loaded and non-empty, but nothing chosen yet.
 */
export declare function WorkspacePicker({ workspaces, selected, onSelect, }: {
    /** The caller's workspaces, or null while the list is still loading. */
    workspaces: Workspace[] | null;
    /** The chosen workspace's slug, or null before resolution. */
    selected: string | null;
    onSelect: (slug: string) => void;
}): ReactElement;
//# sourceMappingURL=WorkspacePicker.d.ts.map