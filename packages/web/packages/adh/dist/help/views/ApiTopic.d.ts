/**
 * The API help topic: the full interactive {@link ApiBrowser} (its own Tags → Endpoints
 * hierarchy nests inside this pane). Opened unfocused so the whole surface is browsable.
 *
 * "Try it" issues authenticated calls through the host's same-origin `/api` BFF proxy, so it
 * only succeeds where the user has a session (the product sites). On a public site with no
 * session the browse/read view still works; the try-it call simply 401s — acceptable for
 * Phase 0. A dedicated browse-only mode for the public apidocs site is Phase 2.
 */
export declare function ApiTopic(): import("react").JSX.Element;
//# sourceMappingURL=ApiTopic.d.ts.map