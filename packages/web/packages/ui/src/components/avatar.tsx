'use client'

import { Avatar as AvatarPrimitive } from '@base-ui/react/avatar'

import { cn } from '../lib/utils'

// Base UI avatar styled through the SEMANTIC `adh-avatar*` classes (skinned in
// ../styles/components.css): the class names are a public theming surface for
// the theme editor and user CSS themes, so they stay stable hooks in the DOM.

function Avatar({ className, ...props }: AvatarPrimitive.Root.Props) {
  return <AvatarPrimitive.Root className={cn('adh-avatar', className)} {...props} />
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return <AvatarPrimitive.Image className={cn('adh-avatar__image', className)} {...props} />
}

function AvatarFallback({ className, ...props }: AvatarPrimitive.Fallback.Props) {
  return <AvatarPrimitive.Fallback className={cn('adh-avatar__fallback', className)} {...props} />
}

export { Avatar, AvatarImage, AvatarFallback }
