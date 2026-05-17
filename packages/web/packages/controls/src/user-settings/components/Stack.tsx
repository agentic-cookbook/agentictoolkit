import type { CSSProperties, ReactNode } from 'react'

type StackProps = {
  children?: ReactNode
  gap?: number | string
  align?: CSSProperties['alignItems']
  justify?: CSSProperties['justifyContent']
  className?: string
  style?: CSSProperties
}

function gapValue(gap: number | string | undefined): string | undefined {
  if (gap === undefined) return undefined
  return typeof gap === 'number' ? `${gap}px` : gap
}

export function VStack({ children, gap, align, justify, className, style }: StackProps) {
  const cls = ['aws-stack', 'aws-stack--v', className].filter(Boolean).join(' ')
  const merged: CSSProperties = {
    gap: gapValue(gap),
    alignItems: align,
    justifyContent: justify,
    ...style,
  }
  return (
    <div className={cls} style={merged}>
      {children}
    </div>
  )
}

export function HStack({ children, gap, align, justify, className, style }: StackProps) {
  const cls = ['aws-stack', 'aws-stack--h', className].filter(Boolean).join(' ')
  const merged: CSSProperties = {
    gap: gapValue(gap),
    alignItems: align,
    justifyContent: justify,
    ...style,
  }
  return (
    <div className={cls} style={merged}>
      {children}
    </div>
  )
}
