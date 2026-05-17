import type { ReactNode } from 'react'

export interface GroupProps {
  title?: ReactNode
  hint?: ReactNode
  children?: ReactNode
  className?: string
}

export function Group({ title, hint, children, className }: GroupProps) {
  const cls = ['aws-group', className].filter(Boolean).join(' ')
  return (
    <section className={cls}>
      {title && <h3 className="aws-group__title">{title}</h3>}
      {hint && <p className="aws-group__hint">{hint}</p>}
      <div className="aws-group__body">{children}</div>
    </section>
  )
}
