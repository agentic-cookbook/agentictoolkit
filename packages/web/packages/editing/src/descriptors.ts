import type { ReactNode } from "react"

/**
 * FIELD DESCRIPTORS — the declarative half of an editing container.
 *
 * A descriptor says WHAT a field is (its value type, its label, how to check it,
 * how to fix stored data that fails the check). It says nothing about how the
 * control is wired: there is no `value`, no `onChange`, no `dirty`. Wiring is the
 * container's job, and a descriptor has no way to express it — which is what makes
 * "forgot to hook this control up to Save" unrepresentable rather than merely
 * discouraged.
 *
 * The value type is carried in an INVARIANT phantom (`__value`). Without it every
 * descriptor would be structurally identical whenever `validate`/`repair` are
 * omitted, and `checkbox()` would type-check against a `string` field. Invariant
 * (not co- or contravariant) so a `select` whose options are a strict subset OR a
 * strict superset of the field's type is also rejected: either way the control and
 * the field disagree about what values exist.
 *
 * `TContext` is contravariant by construction (it appears only as a parameter of
 * `validate`/`repair`), so a descriptor that needs `{ orgSlug: string }` to repair
 * itself is assignable only to a container whose `context` supplies it. A container
 * with no `context` has `TContext = undefined`, and such a descriptor will not fit.
 */

/**
 * There is deliberately no numeric control yet. A number input's editing state is
 * a STRING ("", "-", "1.") that is not yet a number, so it needs a draft model this
 * container does not have — the draft mirrors the record. Adding one means
 * answering that first, and no surface being retrofitted has forced the question.
 */
export type ControlKind = "text" | "textarea" | "rdid" | "checkbox" | "select"

/** Returns null when the value is acceptable, or the message to show under the field. */
export type Validator<TValue, TContext> = (value: TValue, context: TContext) => string | null

/** Turns a value that fails {@link Validator} into one that passes it. */
export type Repairer<TValue, TContext> = (value: TValue, context: TContext) => TValue

/**
 * Validation is all-or-nothing: a field either declares NEITHER `validate` nor
 * `repair`, or BOTH. Declaring a check without a way to fix data that already
 * fails it is the exact shape of the bug this package exists to prevent — stored
 * data that the UI refuses, with no path back to a saveable state, leaving Save
 * permanently grey. The union makes that shape not compile.
 */
export type Validation<TValue, TContext> =
  | { readonly validate?: undefined; readonly repair?: undefined }
  | {
      readonly validate: Validator<TValue, TContext>
      readonly repair: Repairer<TValue, TContext>
    }

export interface SelectOption<TValue> {
  readonly value: TValue
  readonly label: string
}

/**
 * What every field may declare, whatever its control.
 *
 * The options are split across three types rather than pooled into one, because an
 * option a control ignores is worse than an option it lacks: it reads at the call
 * site as a behaviour that was asked for and granted. `placeholder` on a checkbox
 * renders nowhere, and `required` on a checkbox can never fire — "empty" is
 * null/blank/[] and `false` is none of those, so the box is satisfied unticked.
 * Both were accepted silently. Now neither compiles.
 */
export interface FieldOptions {
  /** Caption above the control. */
  readonly label: string
  /** Dim helper line below the control; replaced by the error when there is one. */
  readonly hint?: ReactNode
  /** Renders the control read-only without removing it from the layout. */
  readonly disabled?: boolean
}

/**
 * Every control whose value can be EMPTY — which is every one but the checkbox,
 * since a boolean is always one of its two values.
 */
export interface RequirableFieldOptions extends FieldOptions {
  /**
   * Blocks Save while the value is empty, and shows "Required." under the field.
   * Deliberately NOT part of the repair pass: an empty required value cannot be
   * invented, so it is the user's to fill in, and the field says so instead of the
   * button going quietly dead.
   */
  readonly required?: boolean
}

/** The controls the user types into, and the only ones a placeholder reaches. */
export interface TextFieldOptions extends RequirableFieldOptions {
  /** Greyed sample text shown while the control is empty. */
  readonly placeholder?: string
}

export interface FieldDescriptor<TValue, TContext = unknown> {
  readonly kind: ControlKind
  readonly label: string
  readonly hint?: ReactNode
  readonly required: boolean
  readonly placeholder?: string
  readonly disabled: boolean
  /** `textarea` only. */
  readonly rows?: number
  /** `select` only. */
  readonly options?: readonly SelectOption<TValue>[]
  readonly validate?: Validator<TValue, TContext>
  readonly repair?: Repairer<TValue, TContext>
  /** Phantom. Never present at runtime; see the module docblock. */
  readonly __value?: (value: TValue) => TValue
}

/** The constraint used where any descriptor will do (fields maps, layout checks). */

export type AnyFieldDescriptor = FieldDescriptor<any, any>

/** The value type a descriptor edits. */
export type DescriptorValue<TDescriptor> =
  TDescriptor extends FieldDescriptor<infer TValue, any> ? TValue : never

function common(
  kind: ControlKind,
  options: TextFieldOptions,
): Pick<
  FieldDescriptor<never, never>,
  "kind" | "label" | "hint" | "required" | "placeholder" | "disabled"
> {
  return {
    kind,
    label: options.label,
    hint: options.hint,
    required: options.required ?? false,
    placeholder: options.placeholder,
    disabled: options.disabled ?? false,
  }
}

/** A single-line string field. */
export function text<TContext = unknown>(
  options: TextFieldOptions & Validation<string, TContext>,
): FieldDescriptor<string, TContext> {
  return { ...common("text", options), validate: options.validate, repair: options.repair }
}

/** A multi-line string field. */
export function textarea<TContext = unknown>(
  options: TextFieldOptions & { readonly rows?: number } & Validation<string, TContext>,
): FieldDescriptor<string, TContext> {
  return {
    ...common("textarea", options),
    rows: options.rows,
    validate: options.validate,
    repair: options.repair,
  }
}

/**
 * A dotted machine identifier. Identical to {@link text} except that typing is
 * lowercased as it goes in — the grammar itself is the caller's, declared through
 * `validate`/`repair`, because "what a valid identifier looks like here" differs
 * per surface and does not belong in a shared control.
 */
export function rdid<TContext = unknown>(
  options: TextFieldOptions & Validation<string, TContext>,
): FieldDescriptor<string, TContext> {
  return { ...common("rdid", options), validate: options.validate, repair: options.repair }
}

/** A boolean field. */
export function checkbox<TContext = unknown>(
  options: FieldOptions & Validation<boolean, TContext>,
): FieldDescriptor<boolean, TContext> {
  return { ...common("checkbox", options), validate: options.validate, repair: options.repair }
}

/**
 * A closed choice. `const TValue` keeps the option literals, so the descriptor's
 * value type is the union of the options and a field typed more widely (or more
 * narrowly) than the list will not accept it.
 */
export function select<const TValue extends string | number, TContext = unknown>(
  options: RequirableFieldOptions & {
    readonly options: readonly SelectOption<TValue>[]
  } & Validation<TValue, TContext>,
): FieldDescriptor<TValue, TContext> {
  return {
    ...common("select", options),
    options: options.options,
    validate: options.validate,
    repair: options.repair,
  }
}
