'use client'

import { createContext, useContext, type ReactNode } from 'react'

export type RouteValue = {
  pathname: string
  hash: string
  navigate: (to: string) => void
}

const DEFAULT_ROUTE: RouteValue = { pathname: '/', hash: '', navigate: () => {} }
const RouteContext = createContext<RouteValue>(DEFAULT_ROUTE)

export function RouteProvider({
  pathname,
  hash,
  navigate,
  children,
}: RouteValue & { children: ReactNode }) {
  return <RouteContext.Provider value={{ pathname, hash, navigate }}>{children}</RouteContext.Provider>
}

export function useCurrentRoute(): RouteValue {
  return useContext(RouteContext)
}
