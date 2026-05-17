'use client'

import { useId, type ReactNode } from 'react'

export interface StepperProps {
  label?: ReactNode
  hint?: ReactNode
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  className?: string
  id?: string
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function Stepper({
  label,
  hint,
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  disabled,
  className,
  id,
}: StepperProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const cls = ['aws-field', 'aws-field--stepper', className].filter(Boolean).join(' ')

  const set = (next: number) => onChange(clamp(next, min, max))

  return (
    <div className={cls}>
      {label && (
        <label htmlFor={fieldId} className="aws-field__label">
          {label}
        </label>
      )}
      <div className="aws-stepper">
        <button
          type="button"
          className="aws-stepper__btn"
          aria-label="Decrement"
          disabled={disabled || value <= min}
          onClick={() => set(value - step)}
        >
          −
        </button>
        <input
          id={fieldId}
          type="number"
          className="aws-stepper__value"
          value={value}
          min={min === -Infinity ? undefined : min}
          max={max === Infinity ? undefined : max}
          step={step}
          disabled={disabled}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (!Number.isNaN(n)) set(n)
          }}
        />
        <button
          type="button"
          className="aws-stepper__btn"
          aria-label="Increment"
          disabled={disabled || value >= max}
          onClick={() => set(value + step)}
        >
          +
        </button>
      </div>
      {hint && <p className="aws-field__hint">{hint}</p>}
    </div>
  )
}
