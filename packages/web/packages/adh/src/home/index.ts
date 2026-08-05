'use client'

// The shared workspace-route shell: one workspace chooser in a bar under the header, the site's
// own HTDV below it.
// Its own entry (and hence its own export subpath) so only a page that imports it pays for the
// package's @agentic-toolkit/data dependency — the header ships on every public page and must
// not carry workspace vocabulary.
//
// A site needs exactly two of these: `defineSiteHome` to declare its model, and `SiteHomeRoute`
// to render it. `SiteHomeShell` and `WorkspacePicker` are the parts the route assembles, exported
// for tests and for anything that legitimately needs one alone — a site reaching for them is
// rebuilding by hand the arrangement the model exists to own.
//
// `WorkspaceBar` and `useWorkspaceRoute` are the two halves SiteHomeShell composes, exported for
// ONE caller with a legitimate need: the hub, whose workspace is `/<slug>/home` rather than
// `${basePath}/<slug>` — a URL shape the shell cannot express, since the hub's bare `/<slug>` is
// a public profile page. It mounts these directly so the bar and its behaviour stay the fleet's,
// not a second implementation. A feature site never needs them.
export { SiteHomeRoute } from './SiteHomeRoute'
export { defineSiteHome } from './SiteHomeModel'
export type { SiteHomeModel, SiteHomeContext, SiteHomeScope } from './SiteHomeModel'
export { SiteHomeShell } from './SiteHomeShell'
export { WorkspaceBar } from './WorkspaceBar'
export { WorkspacePicker } from './WorkspacePicker'
export { useWorkspaceRoute } from './useWorkspaceRoute'
export type { WorkspaceOption } from './WorkspaceOption'
