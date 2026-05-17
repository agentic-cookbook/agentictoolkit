'use client'

import { useId, type ReactNode } from 'react'

export interface ColorPickerProps {
  label?: ReactNode
  hint?: ReactNode
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  id?: string
}

export function ColorPicker({
  label,
  hint,
  value,
  onChange,
  disabled,
  className,
  id,
}: ColorPickerProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const cls = ['aws-field', 'aws-field--color', className].filter(Boolean).join(' ')

  return (
    <div className={cls}>
      {label && (
        <label htmlFor={fieldId} className="aws-field__label">
          {label}
        </label>
      )}
      <div className="aws-color">
        <input
          id={fieldId}
          type="color"
          className="aws-color__input"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="aws-color__hex" aria-hidden="true">
          {value}
        </span>
      </div>
      {hint && <p className="aws-field__hint">{hint}</p>}
    </div>
  )
}
