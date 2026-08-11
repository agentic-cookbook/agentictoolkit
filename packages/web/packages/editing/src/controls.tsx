"use client"

import * as React from "react"

import { Checkbox } from "@agentic-toolkit/ui/components/checkbox"
import { Input } from "@agentic-toolkit/ui/components/input"
import { Select } from "@agentic-toolkit/ui/components/select"
import { Textarea } from "@agentic-toolkit/ui/components/textarea"
import { Field } from "@agentic-toolkit/ui/blocks/field"

import type { AnyFieldDescriptor } from "./descriptors"

/**
 * BOUND CONTROLS — deliberately not exported from this package.
 *
 * The enforcement the platform needs is "you cannot use an editing control outside
 * an editing container". A branded prop would express that as a rule someone can
 * satisfy incorrectly; an EXPORT BOUNDARY makes it structural. These components
 * take `value`/`onChange`/`error` from the container and nothing else supplies
 * them, and no entry in the package's `exports` map reaches this file — so there
 * is no import path that produces an unwired control, and therefore no syntax for
 * the mistake. The rule needs no linting because it cannot be written down.
 *
 * The unbound primitives in `@agentic-toolkit/ui` stay available for display-only
 * surfaces; what is unavailable is a control that LOOKS wired and is not.
 */

export interface BoundFieldProps {
  readonly name: string
  readonly descriptor: AnyFieldDescriptor
  readonly value: unknown
  readonly error?: string
  /** The whole container is read-only (a viewer, or a save in flight). */
  readonly locked: boolean
  readonly onChange: (value: unknown) => void
}

export function BoundField({
  name,
  descriptor,
  value,
  error,
  locked,
  onChange,
}: BoundFieldProps): React.ReactElement {
  const disabled = locked || descriptor.disabled
  const shared = { "data-editing-field": name, disabled }

  if (descriptor.kind === "checkbox") {
    // A checkbox reads as "[box] label", not as a caption above a control, so it
    // does not go through Field — but it keeps Field's hint/error line so every
    // field on the pane reports its problem in the same place.
    return (
      <div className="flex flex-col items-start gap-1.5">
        <label className="flex items-center gap-2 text-sm text-apt-text">
          <Checkbox
            {...shared}
            checked={value === true}
            onCheckedChange={(checked: boolean) => onChange(checked)}
          />
          <span>{descriptor.label}</span>
        </label>
        <FieldFootnote hint={descriptor.hint} error={error} />
      </div>
    )
  }

  if (descriptor.kind === "textarea") {
    return (
      <Field label={descriptor.label} hint={descriptor.hint} error={error}>
        <Textarea
          {...shared}
          rows={descriptor.rows}
          placeholder={descriptor.placeholder}
          aria-invalid={error ? true : undefined}
          value={asText(value)}
          onChange={(event) => onChange(event.target.value)}
        />
      </Field>
    )
  }

  if (descriptor.kind === "select") {
    const options = descriptor.options ?? []
    return (
      <Field label={descriptor.label} hint={descriptor.hint} error={error}>
        <Select
          {...shared}
          aria-invalid={error ? true : undefined}
          value={String(value ?? "")}
          onChange={(event) => {
            // Map the DOM's string back to the option's own value, so a numeric
            // select round-trips as a number rather than silently becoming text.
            const picked = options.find((option) => String(option.value) === event.target.value)
            onChange(picked ? picked.value : event.target.value)
          }}
        >
          {options.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
    )
  }

  // "text" and "rdid" — same control; rdid lowercases as it goes in, because the
  // grammars it is used for are all lowercase and the shift key is not a decision.
  const lowercase = descriptor.kind === "rdid"
  return (
    <Field label={descriptor.label} hint={descriptor.hint} error={error}>
      <Input
        {...shared}
        placeholder={descriptor.placeholder}
        aria-invalid={error ? true : undefined}
        value={asText(value)}
        onChange={(event) =>
          onChange(lowercase ? event.target.value.toLowerCase() : event.target.value)
        }
      />
    </Field>
  )
}

/** Field's hint/error line, for the one control that does not use Field. */
function FieldFootnote({
  hint,
  error,
}: {
  hint?: React.ReactNode
  error?: string
}): React.ReactElement | null {
  if (error) return <span className="font-mono text-[0.7rem] text-apt-red">{error}</span>
  if (hint) return <span className="font-mono text-[0.7rem] text-apt-text-dim">{hint}</span>
  return null
}

function asText(value: unknown): string {
  return value == null ? "" : String(value)
}
