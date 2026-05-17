import { useEffect, useRef, type RefObject } from 'react'

export function useScrollToBottom(
  ref: RefObject<HTMLElement | null>,
  deps: unknown[],
): void {
  const isAtBottomRef = useRef(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 30
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [ref])

  useEffect(() => {
    const el = ref.current
    if (el && isAtBottomRef.current) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
