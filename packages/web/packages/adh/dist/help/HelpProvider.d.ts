import { type ReactNode } from 'react';
import { type HelpTopicId } from './topics';
export interface HelpContextValue {
    isOpen: boolean;
    /** Open the modal. Pass a topic id to deep-link straight to it (e.g. `open('errors')`). */
    open: (topicId?: HelpTopicId) => void;
    close: () => void;
}
/**
 * Mounts the single Help modal for a site and exposes {@link useHelp} to open it from anywhere.
 * Placed once in the shared {@link AppShell}, so every site gets Help with no per-app wiring, and
 * any feature (an error toast, an empty state) can deep-link a topic via `useHelp().open(id)`.
 *
 * Owns both the open state and the selection `path` so a deep-link and manual navigation share one
 * source of truth; the window itself is presentational.
 */
export declare function HelpProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
/**
 * Open/close the Help modal from anywhere under a {@link HelpProvider}.
 *
 * Returns a safe no-op outside a provider so a stray Help trigger never crashes its host (a header
 * button is worse dead than fatal) — the button just won't open the absent window.
 */
export declare function useHelp(): HelpContextValue;
//# sourceMappingURL=HelpProvider.d.ts.map