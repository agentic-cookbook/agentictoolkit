/**
 * A driveable IntersectionObserver for jsdom, which ships none.
 *
 * Not a stub: a no-op observer would let a scrollspy test pass while the marker
 * never moves. This one records what was observed and lets a test say "the
 * reader has reached THIS heading now", so the assertions are about behaviour.
 *
 * Shared by every test that renders a scrollspy — one fake, so the two can't
 * disagree about what an observer does.
 */

export class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = []
  observed: Element[] = []
  disconnected = false

  constructor(
    public callback: IntersectionObserverCallback,
    public options?: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.instances.push(this)
  }

  observe(el: Element) {
    this.observed.push(el)
  }

  unobserve(el: Element) {
    this.observed = this.observed.filter((e) => e !== el)
  }

  disconnect() {
    this.disconnected = true
  }

  /** Report `id` as the element now inside the observed band. */
  enter(id: string) {
    const target = this.observed.find((el) => el.id === id)
    if (!target) throw new Error(`#${id} is not observed`)
    this.callback(
      [{ isIntersecting: true, target } as unknown as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    )
  }

  /** The observer created most recently — i.e. the one currently subscribed. */
  static get current(): FakeIntersectionObserver {
    const observer = FakeIntersectionObserver.instances.at(-1)
    if (!observer) throw new Error('no IntersectionObserver was created')
    return observer
  }
}

let original: unknown

/** Install the fake. Call from `beforeEach`; pair with `restoreIntersectionObserver`. */
export function installIntersectionObserver() {
  FakeIntersectionObserver.instances = []
  original = (globalThis as Record<string, unknown>).IntersectionObserver
  ;(globalThis as Record<string, unknown>).IntersectionObserver =
    FakeIntersectionObserver
}

/** Restore whatever was there before. Call from `afterEach`. */
export function restoreIntersectionObserver() {
  ;(globalThis as Record<string, unknown>).IntersectionObserver = original
}
