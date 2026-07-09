/**
 * JSON-Schema helpers for the panel: `$ref` resolution (against the once-stored
 * {@link API_SCHEMAS}), example generation, and human-readable type labels /
 * field lists. All ref walks carry a `seen` set so recursive schemas terminate.
 */
import { API_SCHEMAS } from '../generated/endpoints.generated'
import type { ApiSchemas, JsonSchema } from '../types'

const REF_PREFIX = '#/components/schemas/'

type SchemaObject = Record<string, unknown>

export function isSchemaObject(schema: JsonSchema | undefined): schema is SchemaObject {
  return typeof schema === 'object' && schema !== null
}

/** The referenced schema name, when `schema` is a local `$ref`. */
export function refName(schema: JsonSchema | undefined): string | undefined {
  if (isSchemaObject(schema)) {
    const ref = schema['$ref']
    if (typeof ref === 'string' && ref.startsWith(REF_PREFIX)) return ref.slice(REF_PREFIX.length)
  }
  return undefined
}

function variants(schema: SchemaObject, key: 'anyOf' | 'oneOf'): JsonSchema[] | undefined {
  const v = schema[key]
  return Array.isArray(v) ? (v as JsonSchema[]) : undefined
}

function isNullVariant(schema: JsonSchema): boolean {
  return isSchemaObject(schema) && schema['type'] === 'null'
}

/** The declared `type`, collapsing a `['string','null']` union to `string`. */
function primaryType(schema: SchemaObject): string | undefined {
  const t = schema['type']
  if (Array.isArray(t)) return (t as string[]).find((x) => x !== 'null') ?? (t as string[])[0]
  return typeof t === 'string' ? t : undefined
}

/** A concrete sample value for a schema — the skeleton shown before "Send". */
export function schemaToExample(
  schema: JsonSchema | undefined,
  schemas: ApiSchemas = API_SCHEMAS,
  seen: Set<string> = new Set(),
): unknown {
  if (schema === undefined || schema === true) return {}
  if (schema === false) return null

  const name = refName(schema)
  if (name) {
    if (seen.has(name)) return null // cycle — stop descending
    return schemaToExample(schemas[name], schemas, new Set(seen).add(name))
  }

  const s = schema as SchemaObject
  const union = variants(s, 'anyOf') ?? variants(s, 'oneOf')
  if (union && union.length) {
    const chosen = union.find((v) => !isNullVariant(v)) ?? union[0]
    return schemaToExample(chosen, schemas, seen)
  }
  const allOf = Array.isArray(s['allOf']) ? (s['allOf'] as JsonSchema[]) : undefined
  if (allOf) {
    return allOf.reduce<Record<string, unknown>>((acc, part) => {
      const ex = schemaToExample(part, schemas, seen)
      return ex && typeof ex === 'object' && !Array.isArray(ex) ? { ...acc, ...ex } : acc
    }, {})
  }

  if (s['example'] !== undefined) return s['example']
  if (s['default'] !== undefined) return s['default']
  if (Array.isArray(s['enum']) && (s['enum'] as unknown[]).length) return (s['enum'] as unknown[])[0]

  switch (primaryType(s)) {
    case 'string':
      return s['format'] === 'date-time' ? '2020-01-01T00:00:00.000Z' : 'string'
    case 'integer':
    case 'number':
      return 0
    case 'boolean':
      return true
    case 'null':
      return null
    case 'array': {
      const items = s['items'] as JsonSchema | undefined
      return items ? [schemaToExample(items, schemas, seen)] : []
    }
    default: {
      const props = s['properties'] as Record<string, JsonSchema> | undefined
      if (props) {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(props)) out[k] = schemaToExample(v, schemas, seen)
        return out
      }
      return {}
    }
  }
}

/** A short human type label, e.g. `string`, `string?` (nullable), `Persona[]`. */
export function typeLabel(schema: JsonSchema | undefined, schemas: ApiSchemas = API_SCHEMAS): string {
  if (schema === undefined) return 'any'
  if (schema === true) return 'any'
  if (schema === false) return 'never'

  const name = refName(schema)
  if (name) return name // a $ref renders as its schema name (no recursion → no cycle risk)

  const s = schema as SchemaObject
  const union = variants(s, 'anyOf') ?? variants(s, 'oneOf')
  if (union && union.length) {
    const nonNull = union.filter((v) => !isNullVariant(v))
    const nullable = nonNull.length !== union.length
    const inner = nonNull.length === 1 ? typeLabel(nonNull[0], schemas) : nonNull.map((v) => typeLabel(v, schemas)).join(' | ')
    return nullable ? `${inner}?` : inner
  }

  if (Array.isArray(s['enum']) && (s['enum'] as unknown[]).length) {
    const values = (s['enum'] as unknown[]).map((v) => JSON.stringify(v))
    return values.length <= 4 ? values.join(' | ') : `${values.slice(0, 3).join(' | ')} | …`
  }

  const type = primaryType(s)
  const nullable = Array.isArray(s['type']) ? (s['type'] as string[]).includes('null') : s['nullable'] === true
  let label: string
  if (type === 'array') {
    const items = s['items'] as JsonSchema | undefined
    label = `${typeLabel(items, schemas)}[]`
  } else if (type === 'object' || (!type && s['properties'])) {
    label = typeof s['title'] === 'string' ? (s['title'] as string) : 'object'
  } else {
    label = type ?? 'any'
  }
  return nullable ? `${label}?` : label
}

export interface SchemaField {
  name: string
  type: string
  required: boolean
  description?: string
}

/** Resolve a schema to the underlying object (deref, unwrap `array`→items and
 *  null unions), so a list response's row shape can be described. */
export function unwrapToObject(
  schema: JsonSchema | undefined,
  schemas: ApiSchemas = API_SCHEMAS,
  seen: Set<string> = new Set(),
): SchemaObject | undefined {
  if (!isSchemaObject(schema)) return undefined
  const name = refName(schema)
  if (name) {
    if (seen.has(name)) return undefined
    return unwrapToObject(schemas[name], schemas, new Set(seen).add(name))
  }
  const s = schema
  const union = variants(s, 'anyOf') ?? variants(s, 'oneOf')
  if (union) {
    const chosen = union.find((v) => !isNullVariant(v))
    return chosen ? unwrapToObject(chosen, schemas, seen) : undefined
  }
  // allOf — merge each branch's object shape so the field list matches the example
  // (schemaToExample already merges allOf; describeFields must too).
  const allOf = Array.isArray(s['allOf']) ? (s['allOf'] as JsonSchema[]) : undefined
  if (allOf) {
    const properties: Record<string, unknown> = {}
    const required: string[] = []
    for (const part of allOf) {
      const obj = unwrapToObject(part, schemas, seen)
      if (!obj) continue
      Object.assign(properties, (obj['properties'] as Record<string, unknown>) ?? {})
      if (Array.isArray(obj['required'])) required.push(...(obj['required'] as string[]))
    }
    return { type: 'object', properties, required }
  }
  if (primaryType(s) === 'array') return unwrapToObject(s['items'] as JsonSchema, schemas, seen)
  return s
}

/** Top-level field rows for a response/body schema (one level deep). */
export function describeFields(schema: JsonSchema | undefined, schemas: ApiSchemas = API_SCHEMAS): SchemaField[] {
  const obj = unwrapToObject(schema, schemas)
  if (!obj) return []
  const props = obj['properties'] as Record<string, JsonSchema> | undefined
  if (!props) return []
  const required = new Set(Array.isArray(obj['required']) ? (obj['required'] as string[]) : [])
  return Object.entries(props).map(([name, prop]) => {
    const field: SchemaField = {
      name,
      type: typeLabel(prop, schemas),
      required: required.has(name),
    }
    if (isSchemaObject(prop) && typeof prop['description'] === 'string') field.description = prop['description'] as string
    return field
  })
}
