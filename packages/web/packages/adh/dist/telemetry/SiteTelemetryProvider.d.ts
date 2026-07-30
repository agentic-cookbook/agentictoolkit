import type { ReactNode } from 'react';
/**
 * adh's telemetry, pre-wired with the site registry's hostname classifier — the SAME classifier
 * the site switcher uses, so an error's `environment` tag always agrees with which environment's
 * site the user was actually on. Callers get a props-free provider, exactly as before the
 * toolkit split.
 *
 * Named `SiteTelemetryProvider` rather than `TelemetryProvider`: this barrel already publishes a
 * `TelemetryProvider` (this package's registry-free primitive, imported here as the underlying
 * mechanism this component wraps). The two are unrelated components that happened to share a
 * name.
 *
 * `./TelemetryProvider` is a RELATIVE import, not `@agentic-toolkit/adh/telemetry` — this file
 * lives in the same `telemetry/index` tsup entry as its target, and that bare specifier is not
 * in this package's own `external` array (only the `report-error`/`retry` leaves are), so a
 * self-referencing package-path import here would not resolve the way the cross-entry ones do
 * elsewhere in this package. Same-entry siblings (see TelemetryProvider.tsx importing
 * `./analytics`) use relative imports; only cross-entry/cross-package references need the
 * package-path form.
 */
export declare function SiteTelemetryProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
//# sourceMappingURL=SiteTelemetryProvider.d.ts.map