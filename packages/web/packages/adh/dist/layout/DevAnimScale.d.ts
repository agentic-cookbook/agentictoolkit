/**
 * Applies the dev-only 10x-slow animation scale to the DOCUMENT ROOT. Renders nothing.
 *
 * Root, not a container, because that's the only element that reaches everything: dialogs, popovers
 * and menus render through a PORTAL into `document.body`, so they are outside every React subtree
 * but inside `<html>`. It also has to be `<html>` to win — Tailwind defines
 * `--default-transition-duration` on `:root`, and an inline style there beats the stylesheet rule
 * while still inheriting. See `slowAnimationVars` for what the two variables cover.
 *
 * Mounted from {@link AdhAppShell} rather than the Debug console, because the flag has to keep applying
 * after the console is closed — and the console is where you turn it on.
 */
export declare function DevAnimScale(): null;
//# sourceMappingURL=DevAnimScale.d.ts.map