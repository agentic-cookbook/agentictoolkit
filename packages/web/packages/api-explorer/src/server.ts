// Server-only entry — NO 'use client'. The crawlable, SSR API reference: per-endpoint components
// (pre-highlighted code) + slug helpers for building the routes. Kept OFF the main barrel (which is
// 'use client', for the interactive ApiBrowser) so importing these never drags the client tree —
// and so these server components keep their server semantics instead of being marked client.

export { ApiReferenceShell, endpointHref } from './ApiReferenceShell'
export type { ApiReferenceShellProps } from './ApiReferenceShell'
export { ApiEndpointReference } from './ApiEndpointReference'
export type { ApiEndpointReferenceProps } from './ApiEndpointReference'
export { StaticCodeBlock } from './StaticCodeBlock'
export type { StaticCodeBlockProps } from './StaticCodeBlock'

// Pure metadata helpers (server-usable) for enumerating and resolving the reference routes.
export { endpointSlug, endpointForSlug, allEndpoints } from './lib/slug'
export { allTags, endpointsForTag, getEndpoint, endpointKey } from './lib/getEndpoint'
export type { EndpointMeta, EndpointRef } from './types'
