'use client'

import { useId, type ReactNode } from 'react'
import type { Choice } from '../types'

export interface RadioGroupProps<T extends string | number = string> {
  label?: ReactNode
  hint?: ReactNode
  value: T
  onChange: (value: T) => void
  choices: Choice<T>[]
  disabled?: boolean
  className?: string
  name?: string
}

export function RadioGroup<T extends string | number = string>({
  label,
  hint,
  value,
  onChange,
  choices,
  disabled,
  className,
  name,
}: RadioGroupProps<T>) {
  const generatedName = useId()
  const groupName = name ?? generatedName
  const cls = ['aws-field', 'aws-field--radio', className].filter(Boolean).join(' ')

  return (
    <fieldset className={cls} disabled={disabled}>
      {label && <legend className="aws-field__label">{label}</legend>}
      <div className="aws-radio-group" role="radiogroup">
        {choices.map((choice) => {
          const checked = choice.value === value
          return (
            <label key={String(choice.value)} className="aws-radio">
              <input
                type="radio"
                className="aws-radio__input"
                name={groupName}
                checked={checked}
                disabled={choice.disabled}
                onChange={() => onChange(choice.value)}
              />
              <span className="aws-radio__indicator" />
              <span className="aws-radio__label">{choice.label}</span>
              {choice.hint && <span className="aws-radio__hint">{choice.hint}</span>}
            </label>
          )
        })}
      </div>
      {hint && <p className="aws-field__hint">{hint}</p>}
    </fieldset>
  )
}
