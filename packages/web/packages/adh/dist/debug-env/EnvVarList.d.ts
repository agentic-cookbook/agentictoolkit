import type { EnvVarEntry } from './env-vars';
export type EnvVarListProps = {
    /** Env vars that are set (already masked where secret), in display order. */
    entries: EnvVarEntry[];
};
/**
 * Read-only list of the env vars the site is paying attention to that are set.
 * Secret-named values arrive pre-masked from the server (see `env-vars.ts`).
 */
export declare function EnvVarList({ entries }: EnvVarListProps): import("react").JSX.Element;
//# sourceMappingURL=EnvVarList.d.ts.map