import { type ReactNode } from 'react';
export type TelemetryProviderProps = {
    children: ReactNode;
    /** Classifies the current hostname into a deployment environment, used to tag every
     *  error report. Injected by the host: the toolkit has no site registry, and without
     *  this Sentry defaults `environment` to "production", making testing/staging errors
     *  impossible to triage by env. */
    resolveEnvironment: (hostname: string) => string;
};
/**
 * Initializes error + analytics capture for the site. Drop-in: wrap a site's
 * providers tree with it once. Renders children unchanged.
 */
export declare function TelemetryProvider({ children, resolveEnvironment }: TelemetryProviderProps): ReactNode;
//# sourceMappingURL=TelemetryProvider.d.ts.map