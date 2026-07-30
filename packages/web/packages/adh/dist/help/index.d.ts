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
export { HelpProvider, useHelp } from './HelpProvider';
export type { HelpContextValue } from './HelpProvider';
export { HelpWindow } from '@agentic-toolkit/adh/help/HelpWindow';
export { HELP_TOPICS, findTopicPath, isLeaf } from './topics';
export type { HelpTopic, HelpTopicId } from './topics';
//# sourceMappingURL=index.d.ts.map