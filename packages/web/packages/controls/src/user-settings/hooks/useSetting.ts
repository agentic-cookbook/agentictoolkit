import { useCallback, useEffect, useRef, useState } from 'react'

export interface SettingStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function defaultStorage(): SettingStorage | null {
  if (typeof window === 'undefined') return null
  try {
    const ls = window.localStorage
    if (!ls || typeof ls.getItem !== 'function') return null
    return {
      getItem: (k) => ls.getItem(k),
      setItem: (k, v) => ls.setItem(k, v),
      removeItem: (k) => ls.removeItem(k),
    }
  } catch {
    return null
  }
}

export interface UseSettingOptions<T> {
  storage?: SettingStorage | null
  serialize?: (value: T) => string
  deserialize?: (raw: string) => T
}

const defaultSerialize = <T,>(v: T): string => JSON.stringify(v)
const defaultDeserialize = <T,>(s: string): T => JSON.parse(s) as T

export function useSetting<T>(
  key: string,
  defaultValue: T,
  options: UseSettingOptions<T> = {},
): readonly [T, (value: T) => void, () => void] {
  const usingDefaultStorage = options.storage === undefined
  const {
    storage = defaultStorage(),
    serialize = defaultSerialize,
    deserialize = defaultDeserialize,
  } = options

  const optsRef = useRef({ storage, serialize, deserialize })
  optsRef.current = { storage, serialize, deserialize }

  const [value, setValueInternal] = useState<T>(() => {
    if (!storage) return defaultValue
    try {
      const raw = storage.getItem(key)
      if (raw === null) return defaultValue
      return deserialize(raw)
    } catch {
      return defaultValue
    }
  })

  const setValue = useCallback(
    (next: T) => {
      setValueInternal(next)
      const { storage: s, serialize: ser } = optsRef.current
      if (!s) return
      try {
        s.setItem(key, ser(next))
      } catch {
        /* ignore */
      }
    },
    [key],
  )

  const reset = useCallback(() => {
    setValueInternal(defaultValue)
    const { storage: s } = optsRef.current
    if (!s) return
    try {
      s.removeItem(key)
    } catch {
      /* ignore */
    }
    // defaultValue is intentionally captured by closure; if a consumer changes
    // it, they should change the key too — same contract as React's useState.
  }, [key, defaultValue])

  // Cross-tab sync via the `storage` event when using the default storage
  // (which wraps window.localStorage). Custom storages don't fire this event.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!usingDefaultStorage) return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return
      if (e.newValue === null) {
        setValueInternal(defaultValue)
        return
      }
      try {
        setValueInternal(deserialize(e.newValue))
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key, usingDefaultStorage, deserialize, defaultValue])

  return [value, setValue, reset] as const
}
