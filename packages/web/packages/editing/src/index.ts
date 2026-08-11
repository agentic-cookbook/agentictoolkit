/**
 * @agentic-toolkit/editing — the one way to edit data on this platform.
 *
 * The public surface is deliberately small: a container, the field descriptors it
 * takes, the section helpers that lay them out, and the host a Next app wires its
 * router into. The BOUND CONTROLS are not here and never will be — a control that
 * is not reachable cannot be used outside a container, which is the whole
 * enforcement mechanism (see `controls.tsx`).
 *
 * ```tsx
 * const teamFields = {
 *   displayName: text({ label: "Display name", required: true }),
 *   identifier: rdid<{ orgSlug: string }>({
 *     label: "Identifier",
 *     hint: "Unique reverse-domain string.",
 *     validate: (value) =>
 *       /^[a-z0-9]+(\.[a-z0-9-]+)+$/.test(value)
 *         ? null
 *         : "Use reverse-domain form, e.g. com.example.platform.",
 *     repair: (value, ctx) => `${ctx.orgSlug}.${value}`,
 *   }),
 *   archived: checkbox({ label: "Archived" }),
 * }
 *
 * <EditingContainer
 *   record={team}
 *   fields={teamFields}
 *   context={{ orgSlug }}
 *   sections={[section("Team", ["displayName", "identifier"]), dangerZone(["archived"])]}
 *   onSave={(values) => saveTeam(team.id, values)}
 * />
 * ```
 */

export { EditingContainer } from "./container"
export type { EditingContainerProps, FieldsFor } from "./container"

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

export { createEditingHost, defaultEditingHost, EditingHostProvider } from "./host"
export type { EditingAlertProps, EditingHost } from "./host"
