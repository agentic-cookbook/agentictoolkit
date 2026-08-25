// Package-local addition to the root setupFiles (packages/web/vitest.setup.ts
// already provides jest-dom + the ResizeObserver/localStorage/matchMedia shims).
//
// @base-ui/react Dialog uses a floating-point scroll/size check that requires
// window.getComputedStyle to return sane values. jsdom's stub returns empty
// strings for most properties; prime the ones Dialog queries so it can mount.
if (typeof window !== 'undefined') {
  const orig = window.getComputedStyle.bind(window)
  window.getComputedStyle = (el: Element, pseudo?: string | null) => {
    const style = orig(el, pseudo)
    // Override only if the jsdom stub returns "". Base UI reads these to detect
    // scroll containers and positioned ancestors.
    const get = style.getPropertyValue.bind(style)
    style.getPropertyValue = (prop: string) => {
      const v = get(prop)
      if (v !== '') return v
      if (prop === 'overflow' || prop === 'overflow-x' || prop === 'overflow-y')
        return 'visible'
      return v
    }
    return style
  }
}
