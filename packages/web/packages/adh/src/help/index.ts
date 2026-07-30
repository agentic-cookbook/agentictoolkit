'use client'

/**
 * @agentic-toolkit/adh/help — the shared Help modal.
 *
 * A draggable {@link FloatingWindow} (same shell as the debug console) whose
 * {@link HierarchicalDetailView} navigates a data-driven topic tree: Quickstart, Hub Features,
 * the interactive API browser, MCP, OAuth, and Reference. Mount {@link HelpProvider} once (the
 * shared AppShell does this) and open it from anywhere with {@link useHelp}.
 *
 * Import the CSS once per app: `@import "@agentic-toolkit/adh/help.css"` in the app's globals —
 * a SEPARATE import, deliberately not folded into `./styles.css`. It pulls in
 * @agentic-toolkit/{markdown,api-explorer} stylesheets that the vendored status/builder boards
 * (which ship the components bundle but vendor neither package) must not be made to resolve.
 */
export { HelpProvider, useHelp } from './HelpProvider'
export type { HelpContextValue } from './HelpProvider'
// The package path, never './HelpWindow'. `help/HelpWindow` is its own tsup entry with a
// matching `external` so HelpProvider's `next/dynamic(() => import('@agentic-toolkit/adh/
// help/HelpWindow'))` has a real subpath to resolve; a relative specifier here would ALSO
// inline the whole window into this barrel, so the package would ship two copies of the
// same component under two ids. (`topics` is stateless, so the copy it takes with it is
// only bytes.) The static re-export does put the window on this barrel's import graph, but
// `sideEffects` names only `**/*.css`, so a consumer that takes just HelpProvider/useHelp
// drops it — the ~98 KB window reaches a page only through HelpProvider's `next/dynamic`.
export { HelpWindow } from '@agentic-toolkit/adh/help/HelpWindow'
export { HELP_TOPICS, findTopicPath, isLeaf } from './topics'
export type { HelpTopic, HelpTopicId } from './topics'
