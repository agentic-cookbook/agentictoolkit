'use client'

import { useId, type ReactNode } from 'react'
import type { Choice } from '../types'

export interface SelectProps<T extends string = string> {
  label?: ReactNode
  hint?: ReactNode
  value: T
  onChange: (value: T) => void
  choices: Choice<T>[]
  disabled?: boolean
  className?: string
  id?: string
}

export function Select<T extends string = string>({
  label,
  hint,
  value,
  onChange,
  choices,
  disabled,
  className,
  id,
}: SelectProps<T>) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const cls = ['aws-field', 'aws-field--select', className].filter(Boolean).join(' ')

  return (
    <div className={cls}>
      {label && (
        <label htmlFor={fieldId} className="aws-field__label">
          {label}
        </label>
      )}
      <select
        id={fieldId}
        className="aws-select"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {choices.map((choice) => (
          <option
            key={String(choice.value)}
            value={choice.value}
            disabled={choice.disabled}
          >
            {choice.label}
          </option>
        ))}
      </select>
      {hint && <p className="aws-field__hint">{hint}</p>}
    </div>
  )
}
