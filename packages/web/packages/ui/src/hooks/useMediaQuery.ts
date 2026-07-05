"use client"

import { useCallback, useSyncExternalStore } from "react"

/**
 * Subscribe to a CSS media query and return whether it currently matches.
 *
 * SSR-safe: returns `false` on the server, then the real value on the client.
 * Built on `useSyncExternalStore` (not `useEffect`+`setState`) so the matched
 * value is read during render rather than synced in an effect. Use for
 * desktop/mobile gating, e.g. `useMediaQuery("(min-width: 1024px)")`.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => {
      if (typeof window === "undefined") return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener("change", onStoreChange)
      return () => mql.removeEventListener("change", onStoreChange)
    },
    [query],
  )

  const getSnapshot = useCallback(
    (): boolean => typeof window !== "undefined" && window.matchMedia(query).matches,
    [query],
  )

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
