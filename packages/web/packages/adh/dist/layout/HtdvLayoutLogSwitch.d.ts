/**
 * Turns the toolkit's HTDV layout log on (see `htdv-log.ts` in the ui blocks): one console line per
 * layout decision — the wide↔narrow mode flip, each fit pass's collapse/off-screen outcome, the
 * disclosure toggles, the narrow stack's push/pop. Renders nothing.
 *
 * Mounted from {@link AdhAppShell} behind its `devTools` prop, which the host derives from its own
 * build-inlined environment allowlist (`DEV_TOOLS_BUILD_ENABLED` in
 * `@agentic-toolkit/adh/header`): every
 * environment except production gets the log by default. Note the gate is a RUNTIME one — this
 * component ships in the production bundle and simply never mounts there, so the toolkit's default
 * (off) stands. See the `devTools` prop doc on {@link AdhAppShell} for why that is the accepted
 * cost. `__htdvLogDump()` in the console returns the buffered trace.
 */
export declare function HtdvLayoutLogSwitch(): null;
//# sourceMappingURL=HtdvLayoutLogSwitch.d.ts.map