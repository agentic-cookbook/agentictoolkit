// Package-local addition to the root setupFiles (packages/web/vitest.setup.ts
// already provides jest-dom + the ResizeObserver/localStorage/matchMedia shims).
//
// The default host's alert is @agentic-toolkit/ui's AlertModal, built on the
// @base-ui/react Dialog, which runs a floating-point scroll/size check that needs
// window.getComputedStyle to return sane values. jsdom's stub returns empty
// strings; prime the properties Dialog queries so it can mount. Same patch as
// @agentic-toolkit/ui's own setup, for the same components.
if (typeof window !== 'undefined') {
  const orig = window.getComputedStyle.bind(window)
  window.getComputedStyle = (el: Element, pseudo?: string | null) => {
    const style = orig(el, pseudo)
    const get = style.getPropertyValue.bind(style)
    style.getPropertyValue = (prop: string) => {
      const v = get(prop)
      if (v !== '') return v
      if (prop === 'overflow' || prop === 'overflow-x' || prop === 'overflow-y') return 'visible'
      return v
    }
    return style
  }
}
