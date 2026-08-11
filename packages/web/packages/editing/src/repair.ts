import type { AnyFieldDescriptor } from "./descriptors"
import { fieldError, isEmptyValue } from "./validation"

/**
 * REPAIR — the answer to stored data that the UI's own rules reject.
 *
 * The bug this exists for: a row was written before a format rule existed (or by a
 * path that never applied it). The pane loads it, re-runs the rule on every render,
 * and `valid` is false from mount — so Save is grey no matter what else the user
 * edits, with nothing on screen saying why. The value is not the user's mistake and
 * they usually cannot fix it by hand.
 *
 * So a field that declares a rule must also declare how to satisfy it (see
 * `Validation` — the type will not let the two come apart), and a container that
 * loads failing data repairs it up front, with the user's acknowledgement, before
 * the pane is editable.
 *
 * ONLY `validate` failures are repairable. A `required` field left empty is not in
 * scope: there is nothing to derive the missing value from, so it stays a visible
 * field error and never raises the repair prompt.
 */

export interface FieldFault {
  readonly key: string
  readonly message: string
}

export interface RepairPlan<TRecord> {
  /** Fields whose LOADED value fails `validate` and can therefore be repaired. */
  readonly broken: readonly FieldFault[]
  /** The record with every broken field replaced by its repaired value. */
  readonly repaired: TRecord
  /**
   * Fields still failing after their own `repair` ran — a defect in the repair
   * function, not in the data. Never silently accepted: repairing a value into
   * another invalid one and saving it would corrupt the row it was meant to fix.
   */
  readonly unrepaired: readonly FieldFault[]
  /** True when `repaired` differs from the input in at least one field. */
  readonly changed: boolean
}

/**
 * Work out what a record needs before it can be edited. Pure: it computes the new
 * values and the faults, and persists nothing — the caller owns the prompt, the
 * write and the outcome.
 */
export function planRepairs<TRecord extends object>(
  record: TRecord,
  fields: Readonly<Record<string, AnyFieldDescriptor>>,
  context: unknown,
): RepairPlan<TRecord> {
  const values = record as Readonly<Record<string, unknown>>
  const broken: FieldFault[] = []
  const unrepaired: FieldFault[] = []
  const patch: Record<string, unknown> = {}

  for (const [key, descriptor] of Object.entries(fields)) {
    const repair = descriptor.repair
    if (!repair) continue
    const value = values[key]
    // Empty is "unset", never broken — see validation.ts. Repairing "" would
    // invent a value the user never entered.
    if (isEmptyValue(value)) continue
    const message = fieldError(descriptor, value, context)
    if (message === null) continue

    broken.push({ key, message })
    const next = repair(value, context)
    patch[key] = next
    const stillBad = fieldError(descriptor, next, context)
    if (stillBad !== null) unrepaired.push({ key, message: stillBad })
  }

  const changed = Object.entries(patch).some(([key, next]) => !Object.is(values[key], next))
  return {
    broken,
    repaired: changed ? ({ ...record, ...patch } as TRecord) : record,
    unrepaired,
    changed,
  }
}
