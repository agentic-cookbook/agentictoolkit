'use client'

import { useId, type ReactNode } from 'react'

export interface SliderProps {
  label?: ReactNode
  hint?: ReactNode
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  caption?: ReactNode | ((value: number) => ReactNode)
  disabled?: boolean
  className?: string
  id?: string
}

export function Slider({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  caption,
  disabled,
  className,
  id,
}: SliderProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const cls = ['aws-field', 'aws-field--slider', className].filter(Boolean).join(' ')
  const captionNode = typeof caption === 'function' ? caption(value) : caption

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
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {captionNode !== undefined && (
          <span className="aws-slider__caption">{captionNode}</span>
        )}
      </div>
      {hint && <p className="aws-field__hint">{hint}</p>}
    </div>
  )
}

export const CaptionedSlider = Slider
