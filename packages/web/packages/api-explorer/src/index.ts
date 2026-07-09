'use client'

// Components only — the generated metadata (a large map) is reached exclusively
// through the browser, which ApiButton loads lazily. Keeping getEndpoint /
// API_ENDPOINTS off the barrel means importing ApiButton never pulls the
// metadata into the host page's initial bundle. Consumers reference endpoints by
// { method, path }; anyone needing the raw maps imports the subpath directly.
export { ApiButton } from './ApiButton'
export type { ApiButtonProps } from './ApiButton'
export { ApiBrowser } from './ApiBrowser'
export type { ApiBrowserProps } from './ApiBrowser'
export { ApiEndpointDetail } from './ApiEndpointDetail'
export type { ApiEndpointDetailProps } from './ApiEndpointDetail'
export type { EndpointMeta, EndpointRef } from './types'
export { RecordApiButton } from './RecordApiButton'
