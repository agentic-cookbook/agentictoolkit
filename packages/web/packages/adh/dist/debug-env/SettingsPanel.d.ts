import type { EnvOverrideSurface } from './seams';
/**
 * The console's Settings topic: the host's simulated-environment switch plus the
 * toolkit's own debug view flags.
 *
 * `envOverride` is INJECTED ({@link EnvOverrideSurface}) rather than imported: the store
 * belongs to the host, whose env vocabulary this package must not learn, and whose module
 * is deliberately pinned to a single subscriber set across bundler copies. Reading it from
 * here would move that module across a package boundary and change which bundler inlines
 * it — see the comment on the host's own `envOverride` module.
 */
export declare function SettingsPanel({ envOverride }: {
    envOverride: EnvOverrideSurface;
}): import("react").JSX.Element;
//# sourceMappingURL=SettingsPanel.d.ts.map