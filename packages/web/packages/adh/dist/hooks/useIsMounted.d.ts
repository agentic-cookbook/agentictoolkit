/**
 * `false` on the server + first client render, `true` after mount. The standard
 * guard for client-only work that must not run during hydration — chiefly
 * `createPortal(…, document.body)`, which has no target on the server. Shared so the
 * nav drawer and the theme-editor floating window express the deferral the same way.
 */
export declare function useIsMounted(): boolean;
//# sourceMappingURL=useIsMounted.d.ts.map