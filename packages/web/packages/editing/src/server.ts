/**
 * `@agentic-toolkit/editing/server` — the declarative half, with no React in it.
 *
 * A `fields` map and a `sections` list are plain data: they describe what a record
 * holds and how it is grouped, and nothing in them renders. This entry exists so a
 * Server Component can hold that data — a page that computes its field set from a
 * schema, a route that decides which sections a role may see — and hand it to a
 * container rendered by a client child.
 *
 * It is a SEPARATE tsup build, not merely a separate file, and that is the whole
 * point: `esbuild-plugin-preserve-directives` hoists a chunk's `"use client"` onto
 * every entry that imports it, so one build sharing a chunk graph with the main
 * barrel would stamp `"use client"` on this one too. Nothing would complain — a
 * Client Component is legal — and the descriptors would quietly become client-only
 * for every consumer. See `tsup.config.ts`.
 *
 * The main barrel re-exports every name here, so a client surface imports one path
 * and never has to know this entry exists.
 */

export { checkbox, rdid, select, text, textarea } from "./descriptors"
export type {
  AnyFieldDescriptor,
  ControlKind,
  DescriptorValue,
  FieldDescriptor,
  FieldOptions,
  Repairer,
  RequirableFieldOptions,
  SelectOption,
  TextFieldOptions,
  Validation,
  Validator,
} from "./descriptors"

export { dangerZone, section } from "./sections"
export type { AnySection, CoveredKeys, SectionsCheck, SectionSpec, SectionTone } from "./sections"
