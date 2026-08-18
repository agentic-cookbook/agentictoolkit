"use client"

import * as React from "react"

import { Input, fieldShellClass } from "./input"
import { RemovableChip } from "./removable-chip"
import { Badge } from "./badge"
import { noAutofillProps } from "../lib/autofill"
import { cn } from "../lib/utils"

export interface RecipientInputProps {
  value: string[]
  onChange: (next: string[]) => void
  kind?: "email" | "phone" | "text"
  placeholder?: string
  ariaLabel: string
  disabled?: boolean
  className?: string
  /**
   * When true, renders the chip box and the text input as two distinct
   * stacked elements instead of one fused control. The chips box shows
   * existing recipients; the input below it adds new ones.
   */
  separateInput?: boolean
  /**
   * Read-only: show the recipients as static (non-removable) chips with no entry field. For callers
   * whose recipients are FIXED (e.g. seeded from a selection the backend keys off), so an editable
   * field would present edits the server silently drops. `onChange` never fires in this mode.
   */
  readOnly?: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[+]?[\d\s().-]{7,}$/

export function RecipientInput({
  value,
  onChange,
  kind = "text",
  placeholder,
  ariaLabel,
  disabled = false,
  className,
  separateInput = false,
  readOnly = false,
}: RecipientInputProps): React.ReactElement {
  const [text, setText] = React.useState("")
  const containerRef = React.useRef<HTMLDivElement>(null)

  const norm = (s: string): string => (kind === "email" ? s.toLowerCase() : s)
  const isValid = (s: string): boolean =>
    kind === "email" ? EMAIL_RE.test(s) : kind === "phone" ? PHONE_RE.test(s) : true

  function add(raw: string): void {
    const t = raw.trim()
    if (!t) return
    if (value.some((v) => norm(v) === norm(t))) return
    onChange([...value, t])
  }

  function commitFrom(input: string): void {
    const parts = input
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length === 0) return
    const next = [...value]
    for (const p of parts) {
      if (!next.some((v) => norm(v) === norm(p))) next.push(p)
    }
    if (next.length !== value.length) onChange(next)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter") {
      e.preventDefault()
      add(text)
      setText("")
    } else if (e.key === "Backspace" && text === "" && value.length && !separateInput) {
      onChange(value.slice(0, -1))
    }
  }

  function onChangeText(e: React.ChangeEvent<HTMLInputElement>): void {
    const v = e.target.value
    if (v.includes(",")) {
      commitFrom(v)
      setText("")
    } else {
      setText(v)
    }
  }

  /** Chips shared by both rendering modes. Read-only chips drop the ✕ remove affordance. */
  function renderChips(): React.ReactNode {
    return value.map((v, i) => {
      const invalid = !isValid(v)
      if (readOnly) {
        return (
          <Badge key={`${i}:${v}`} variant={invalid ? "error" : "neutral"} aria-invalid={invalid || undefined}>
            {v}
          </Badge>
        )
      }
      return (
        <RemovableChip
          key={`${i}:${v}`}
          variant={invalid ? "error" : "neutral"}
          aria-invalid={invalid || undefined}
          removeLabel={`Remove ${v}`}
          onRemove={() => onChange(value.filter((x) => x !== v))}
        >
          {v}
        </RemovableChip>
      )
    })
  }

  if (separateInput) {
    const defaultPlaceholder =
      kind === "email" ? "Add email…" : kind === "phone" ? "Add phone…" : "Add…"
    return (
      <div
        role="group"
        aria-label={ariaLabel}
        className={cn("flex flex-col gap-2", disabled && "pointer-events-none opacity-50", className)}
      >
        {/* Recipients box — chips only */}
        <div
          data-testid="recipients-box"
          className={cn(fieldShellClass, "flex min-h-[2.25rem] flex-wrap items-center gap-1.5 px-2 py-1.5")}
        >
          {value.length === 0 ? (
            <span className="text-sm text-apt-text-dim">No recipients yet</span>
          ) : (
            renderChips()
          )}
        </div>
        {/* Separate text entry — the Input primitive with this control's tighter metrics. Omitted in
            read-only mode (recipients are fixed). */}
        {!readOnly && (
          <Input
            value={text}
            onChange={onChangeText}
            onKeyDown={onKeyDown}
            onBlur={() => {
              add(text)
              setText("")
            }}
            placeholder={placeholder ?? defaultPlaceholder}
            disabled={disabled}
            aria-label={`Add to ${ariaLabel}`}
            inputMode={kind === "email" ? "email" : kind === "phone" ? "tel" : "text"}
            className="h-auto px-2 py-1.5"
          />
        )}
      </div>
    )
  }

  // Default fused mode — backward-compatible. The inner <input> is deliberately
  // bare: the container carries the field shell + focus ring for the whole control.
  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={ariaLabel}
      className={cn(
        fieldShellClass,
        "flex flex-wrap items-center gap-1.5 px-2 py-1.5",
        "focus-within:border-apt-gold focus-within:ring-2 focus-within:ring-apt-gold/25",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      {renderChips()}
      {!readOnly && (
        <input
          value={text}
          onChange={onChangeText}
          onKeyDown={onKeyDown}
          onBlur={(e) => {
            if (containerRef.current?.contains(e.relatedTarget as Node)) return
            add(text)
            setText("")
          }}
          placeholder={value.length === 0 ? placeholder : undefined}
          disabled={disabled}
          aria-label={`Add to ${ariaLabel}`}
          inputMode={kind === "email" ? "email" : kind === "phone" ? "tel" : "text"}
          // A recipient box collects OTHER people's addresses, so an email
          // `inputMode` here is exactly the cue that makes a manager offer the
          // signed-in user's own — see lib/autofill.
          {...noAutofillProps}
          className="min-w-[8ch] flex-1 bg-transparent text-sm text-apt-text outline-none placeholder:text-apt-text-dim"
        />
      )}
    </div>
  )
}
