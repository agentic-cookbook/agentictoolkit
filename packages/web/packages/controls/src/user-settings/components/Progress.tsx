import type { ReactNode } from 'react'

export interface ProgressProps {
  label?: ReactNode
  hint?: ReactNode
  value?: number
  max?: number
  indeterminate?: boolean
  className?: string
}

export function Progress({
  label,
  hint,
  value,
  max = 100,
  indeterminate,
  className,
}: ProgressProps) {
  const cls = [
    'aws-field',
    'aws-field--progress',
    indeterminate ? 'aws-field--progress-indeterminate' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const pct =
    indeterminate || value === undefined
      ? undefined
      : Math.max(0, Math.min(100, (value / max) * 100))

  return (
    <div className={cls}>
      {label && <div className="aws-field__label">{label}</div>}
      <div
        className="aws-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={indeterminate ? undefined : value}
      >
        <div
          className="aws-progress__bar"
          style={
            indeterminate
              ? undefined
              : { width: `${pct ?? 0}%` }
          }
        />
      </div>
      {hint && <p className="aws-field__hint">{hint}</p>}
    </div>
  )
}
