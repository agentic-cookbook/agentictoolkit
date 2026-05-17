import '@testing-library/jest-dom/vitest'

// jsdom doesn't provide ResizeObserver
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver
}

// Node 24's experimental built-in localStorage interferes with jsdom's,
// leaving window.localStorage with missing methods in some test orderings.
// Install a deterministic in-memory Storage shim. Tests that want to clear
// it can iterate keys themselves.
if (typeof window !== 'undefined') {
  const makeStorage = (): Storage => {
    const store = new Map<string, string>()
    const api = {
      get length() {
        return store.size
      },
      key(i: number): string | null {
        return Array.from(store.keys())[i] ?? null
      },
      getItem(k: string): string | null {
        return store.has(k) ? (store.get(k) as string) : null
      },
      setItem(k: string, v: string): void {
        store.set(k, String(v))
      },
      removeItem(k: string): void {
        store.delete(k)
      },
      clear(): void {
        store.clear()
      },
    }
    return api as Storage
  }
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: makeStorage(),
  })
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: makeStorage(),
  })
}

// jsdom doesn't provide matchMedia
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList
}
