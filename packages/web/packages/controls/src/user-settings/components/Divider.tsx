export interface DividerProps {
  className?: string
}

export function Divider({ className }: DividerProps) {
  const cls = ['aws-divider', className].filter(Boolean).join(' ')
  return <hr className={cls} />
}
