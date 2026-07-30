import { type ReactElement } from 'react';
/**
 * Drop-in for a Next App Router `app/global-error.tsx` — the ROOT boundary, which
 * replaces the root layout when it (or a render below it) crashes. Because the app's
 * stylesheet may not be present at that point, it renders its OWN `<html>`/`<body>`
 * with minimal, color-free inline styles (browser defaults) rather than `apt-*`
 * classes. Reports the error to GlitchTip; a stale-deploy {@link isChunkLoadError}
 * additionally triggers a guarded hard reload.
 */
export declare function GlobalError({ error, reset, }: {
    error: Error & {
        digest?: string;
    };
    reset: () => void;
}): ReactElement;
//# sourceMappingURL=GlobalError.d.ts.map