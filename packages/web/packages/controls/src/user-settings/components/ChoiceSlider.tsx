'use client'

import { useId, type ReactNode } from 'react'
import type { Choice } from '../types'

export interface ChoiceSliderProps<T extends string | number = string> {
  label?: ReactNode
  hint?: ReactNode
  value: T
  onChange: (value: T) => void
  choices: Choice<T>[]
  disabled?: boolean
  className?: string
  id?: string
}

export function ChoiceSlider<T extends string | number = string>({
  label,
  hint,
  value,
  onChange,
  choices,
  disabled,
  className,
  id,
}: ChoiceSliderProps<T>) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const cls = ['aws-field', 'aws-field--choice-slider', className].filter(Boolean).join(' ')

  const index = Math.max(
    0,
    choices.findIndex((c) => c.value === value),
  )
  const current = choices[index] ?? choices[0]

  return (
    <div className={cls}>
      {label && (
        <label htmlFor={fieldId} className="aws-field__label">
          {label}
        </label>
      )}
      <div className="aws-slider">
        <input
          id={fieldId}
          type="range"
          className="aws-slider__input"
          value={index}
          min={0}
          max={Math.max(0, choices.length - 1)}
          step={1}
          disabled={disabled}
          onChange={(e) => {
            const next = choices[Number(e.target.value)]
            if (next) onChange(next.value)
          }}
        />
        <span className="aws-slider__caption">{current?.label}</span>
      </div>
      {hint && <p className="aws-field__hint">{hint}</p>}
    </div>
  )
}
