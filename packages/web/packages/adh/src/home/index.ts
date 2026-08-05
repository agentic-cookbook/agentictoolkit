'use client'

// The shared /home shell: one workspace chooser in the header, the site's own HTDV below it.
// Its own entry (and hence its own export subpath) so only a page that imports it pays for the
// package's @agentic-toolkit/data dependency — the header ships on every public page and must
// not carry workspace vocabulary.
//
// A site needs exactly two of these: `defineSiteHome` to declare its model, and `SiteHomeRoute`
// to render it. `SiteHomeShell` and `WorkspacePicker` are the parts the route assembles, exported
// for tests and for anything that legitimately needs one alone — a site reaching for them is
// rebuilding by hand the arrangement the model exists to own.
export { SiteHomeRoute } from './SiteHomeRoute'
export { defineSiteHome } from './SiteHomeModel'
export type { SiteHomeModel, SiteHomeContext, SiteHomeScope } from './SiteHomeModel'
export { SiteHomeShell } from './SiteHomeShell'
export { WorkspacePicker } from './WorkspacePicker'
