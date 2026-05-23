'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'

export type ButtonVariant = 'default' | 'outline' | 'ghost' | 'link'
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}

function joinClasses(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={joinClasses(
          'adh-button',
          `adh-button--${variant}`,
          `adh-button--size-${size}`,
          className,
        )}
        ref={ref}
        type={asChild ? type : (type ?? 'button')}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button }
