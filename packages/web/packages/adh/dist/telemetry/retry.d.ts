/**
 * Mark the *exact* RequestInit object that will be handed to `window.fetch` as the auth
 * retry. Must be the post-spread object (the one fetch receives), not an upstream copy.
 */
export declare function markRetriedRequest(init: object): void;
/** Read-and-clear the retry flag for a RequestInit/Request the fetch wrapper is sending. */
export declare function consumeRetriedFlag(init: unknown): boolean;
//# sourceMappingURL=retry.d.ts.map