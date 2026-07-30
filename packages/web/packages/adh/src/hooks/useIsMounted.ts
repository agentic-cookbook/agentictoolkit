'use client'

import { useEffect, useState } from 'react'

/**
 * `false` on the server + first client render, `true` after mount. The standard
 * guard for client-only work that must not run during hydration — chiefly
 * `createPortal(…, document.body)`, which has no target on the server. Shared so the
 * nav drawer and the theme-editor floating window express the deferral the same way.
 */
export function useIsMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}
