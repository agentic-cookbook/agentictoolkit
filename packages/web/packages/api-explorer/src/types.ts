/**
 * Shapes for the spec-projected endpoint metadata that {@link ApiEndpointPanel}
 * consumes. The data itself is GENERATED from websites/main/api/openapi.json into
 * src/generated/endpoints.generated.ts (`pnpm gen`); this file is the hand-written
 * contract both the generator's output and the panel agree on.
 */

/** A JSON Schema node, kept verbatim from the spec. May still contain a `$ref`
 *  to `#/components/schemas/*` — resolve it against {@link ApiSchemas} at render
 *  time (with a cycle guard) rather than inlining, so shared schemas are stored
 *  once and recursive schemas can't blow up the generated file. */
export type JsonSchema = { [key: string]: unknown } | boolean

/** The spec's `components.schemas`, verbatim — the resolution target for `$ref`. */
export type ApiSchemas = Record<string, JsonSchema>

export interface EndpointParam {
  name: string
  in: 'path' | 'query'
  required: boolean
  schema: JsonSchema
  description?: string
}

export interface EndpointRequestBody {
  required: boolean
  contentType: string
  schema: JsonSchema
}

export interface EndpointResponse {
  /** HTTP status as a string (`"200"`, `"401"`) or `"default"`. */
  status: string
  description?: string
  contentType?: string
  schema?: JsonSchema
}

export interface EndpointMeta {
  /** `"<METHOD> <path>"`, e.g. `"GET /persona/personas/{id}"` — the map key. */
  key: string
  /** Upper-case HTTP method. */
  method: string
  /** Backend-native path (no `/api` prefix), e.g. `/persona/personas/{id}`. */
  path: string
  tag?: string
  summary?: string
  description?: string
  params: EndpointParam[]
  requestBody?: EndpointRequestBody
  responses: EndpointResponse[]
  /** Names of the security schemes guarding the op (e.g. `["bearerAuth"]`). */
  security?: string[]
  /** Sibling endpoint keys sharing the resource base — the CRUD family / related
   *  calls. Always includes this endpoint's own key. */
  family: string[]
}

/** A method+path reference into the endpoint map. */
export interface EndpointRef {
  method: string
  path: string
}
