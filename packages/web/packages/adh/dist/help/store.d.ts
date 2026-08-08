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
export declare function helpFor(key: string | undefined): string | undefined;
//# sourceMappingURL=store.d.ts.map