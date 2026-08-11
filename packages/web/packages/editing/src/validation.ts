import type { AnyFieldDescriptor } from "./descriptors"

/**
 * VALIDATION — pure, so the rule that decides whether Save can light up is
 * testable without rendering anything.
 *
 * Three independent reasons a field can block Save, in this order:
 *
 * 1. `required` and empty. Not repairable (see FieldOptions.required) — it is the
 *    user's to fill in, and the field says "Required." so the grey button has a
 *    visible cause.
 * 2. A `select` holding a value its own option list does not contain. The type
 *    system forbids writing that, but it cannot reach a row the server already
 *    holds — an option retired since the row was written, or a value put there by
 *    another path. Checked here rather than left to the control, because a select
 *    given an unknown value renders the FIRST option: the pane would state a value
 *    the row does not hold, and Save would write it without the user choosing it.
 * 3. `validate` returned a message.
 *
 * An EMPTY value that is not required skips `validate` entirely. Otherwise every
 * optional formatted field would reject "" — the value that means "unset" — and a
 * pane with one blank optional identifier would never save.
 */

/** key → message, for failing fields only. */
export type FieldErrors = Readonly<Record<string, string>>

export const REQUIRED_MESSAGE = "Required."

/** The message for a `select` holding a value that is not one of its options. */
export function unlistedChoiceMessage(value: unknown): string {
  return `"${String(value)}" is not one of the available choices.`
}

/** "Nothing was entered": null/undefined, a blank string, or an empty list. */
export function isEmptyValue(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === "string") return value.trim() === ""
  if (Array.isArray(value)) return value.length === 0
  return false
}

/**
 * The message a field would show for `value`, or null when it is acceptable.
 * Exported because the repair pass asks the same question of the LOADED record
 * that the container asks of the draft, and the two must not be able to disagree.
 */
export function fieldError(
  descriptor: AnyFieldDescriptor,
  value: unknown,
  context: unknown,
): string | null {
  const empty = isEmptyValue(value)
  if (descriptor.required && empty) return REQUIRED_MESSAGE
  if (empty) return null
  if (descriptor.kind === "select" && descriptor.options) {
    const listed = descriptor.options.some((option) => Object.is(option.value, value))
    if (!listed) return unlistedChoiceMessage(value)
  }
  return descriptor.validate ? descriptor.validate(value, context) : null
}

/** Every field's error, keyed by field name; absent keys are valid. */
export function validateValues(
  values: Readonly<Record<string, unknown>>,
  fields: Readonly<Record<string, AnyFieldDescriptor>>,
  context: unknown,
): FieldErrors {
  const errors: Record<string, string> = {}
  for (const [key, descriptor] of Object.entries(fields)) {
    const message = fieldError(descriptor, values[key], context)
    if (message !== null) errors[key] = message
  }
  return errors
}
