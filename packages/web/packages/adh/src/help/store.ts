// NO "use client" — a pure lookup over a JSON file, usable from a server component, and its own
// entry so a site that wants one sentence does not pull in the Help modal's client graph.
//
// This is the ROUTE-keyed help store, which is a different thing from the rest of this directory:
// `./index` and `./surface` are the help WINDOW (a topic tree the reader navigates), while this is
// the one-line blurb a pane shows in place. They share a content package and nothing else.

import helpContent from '@agentic-toolkit/adh-site-config/content/help.en.json'

const help = helpContent as Record<string, string>

/**
 * Help text for a hierarchical view's route + ui key, from the unified site-config help store
 * (`websites/site-config/content/help.en.json`). The key is the route to the details page + the
 * ui element: `<feature>` for a feature's breadcrumb/landing, `<feature>/<topic>` for a topic's
 * detail pane. Returns undefined when there is no entry.
 *
 * It lives HERE, in the adh package, because the sentences are adh's product vocabulary: a
 * portable feature package may not import them (scripts/check_boundaries.py), so every host that
 * mounts such a package passes this function down as a seam — see ConfigurationGroup's `helpFor`.
 */
export function helpFor(key: string | undefined): string | undefined {
  if (!key) return undefined
  return help[key]
}
