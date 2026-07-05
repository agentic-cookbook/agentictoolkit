"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { useEffect, useState } from "react"

// Compose an optional consumer handler with our own so passing e.g. `onPointerUp`
// still fires — we never silently swallow a forwarded pointer handler.
function compose<E>(
  theirs: ((event: E) => void) | undefined,
  ours: (event: E) => void,
): (event: E) => void {
  return (event) => {
    theirs?.(event)
    ours(event)
  }
}

/**
 * The client interactivity layer for <Button>. It lives in its OWN `"use client"`
 * file so `button.tsx` (and therefore `buttonVariants`) can stay a plain module
 * that server components import and call.
 *
 * It tracks a pointer-driven pressed state the way CSS `:active` can't: pressed
 * turns on at `pointerdown` inside the button, off at `pointerup`/`pointercancel`
 * and at `pointerleave` WHILE still held, and back on if the pointer re-enters
 * before release. No `setPointerCapture` — we track `held` (the pointer is down)
 * plus whether it is currently inside, and reflect the combination via
 * `data-pressed`. A window `pointerup`/`pointercancel` listener (only while held)
 * ends the hold even when release happens outside the button. Keyboard activation
 * (Space/Enter) is unaffected: the pressed visual is intentionally pointer-only.
 */
export function PressableButton({
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerEnter,
  onPointerCancel,
  ...props
}: ButtonPrimitive.Props): React.JSX.Element {
  const [held, setHeld] = useState(false)
  const [pressed, setPressed] = useState(false)

  // While held, a release/cancel ANYWHERE ends the press — including outside the
  // button, where no element-level pointerup fires. Only attached while held.
  useEffect(() => {
    if (!held) return
    const end = (): void => {
      setHeld(false)
      setPressed(false)
    }
    window.addEventListener("pointerup", end)
    window.addEventListener("pointercancel", end)
    return () => {
      window.removeEventListener("pointerup", end)
      window.removeEventListener("pointercancel", end)
    }
  }, [held])

  return (
    <ButtonPrimitive
      data-slot="button"
      data-pressed={pressed ? "" : undefined}
      onPointerDown={compose(onPointerDown, () => {
        setHeld(true)
        setPressed(true)
      })}
      onPointerUp={compose(onPointerUp, () => {
        setHeld(false)
        setPressed(false)
      })}
      onPointerLeave={compose(onPointerLeave, () => {
        // Pointer left while held → drop the pressed visual, stay armed to restore.
        if (held) setPressed(false)
      })}
      onPointerEnter={compose(onPointerEnter, () => {
        // Re-entered while still held → restore the pressed visual.
        if (held) setPressed(true)
      })}
      onPointerCancel={compose(onPointerCancel, () => {
        setHeld(false)
        setPressed(false)
      })}
      {...props}
    />
  )
}
