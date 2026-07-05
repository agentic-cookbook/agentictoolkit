'use client'

import { useCallback, useState } from 'react'

import { errorMessage } from '../lib/errors'

export interface ActionState {
  busy: boolean
  error: string | null
  /** Run one async action: clears the error, holds busy for the duration, and
   *  captures a thrown message instead of rejecting. */
  run: (action: () => Promise<void>) => Promise<void>
}

/** The busy/error state machine every async button needs, in one place. */
export function useAction(): ActionState {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Stable identity (setState setters are stable) so a consumer may safely put
  // `run` in an effect dependency array without re-firing every render.
  const run = useCallback(async (action: () => Promise<void>): Promise<void> => {
    setError(null)
    setBusy(true)
    try {
      await action()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }, [])
  return { busy, error, run }
}
