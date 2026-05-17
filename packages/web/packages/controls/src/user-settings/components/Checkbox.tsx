'use client'

import { useId, type ReactNode } from 'react'

export interface CheckboxProps {
  label?: ReactNode
  hint?: ReactNode
  value: boolean
  onChange: (value: boolean) => void
  appearance?: 'switch' | 'check'
  disabled?: boolean
  className?: string
  id?: string
}

export function Checkbox({
  label,
  hint,
  value,
  onChange,
  appearance = 'switch',
  disabled,
  className,
  id,
}: CheckboxProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const cls = [
    'aws-field',
    'aws-field--checkbox',
    `aws-field--checkbox-${appearance}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cls}>
      <label htmlFor={fieldId} className="aws-checkbox">
        <input
          id={fieldId}
          type="checkbox"
          role={appearance === 'switch' ? 'switch' : undefined}
          className="aws-checkbox__input"
          checked={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className={`aws-checkbox__indicator aws-checkbox__indicator--${appearance}`} />
        {label && <span className="aws-checkbox__label">{label}</span>}
      </label>
      {hint && <p className="aws-field__hint">{hint}</p>}
    </div>
  )
}
