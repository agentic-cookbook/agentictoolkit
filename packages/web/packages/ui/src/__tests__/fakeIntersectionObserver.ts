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

  /**
   * Deliver ONE callback carrying several changes, in the order given.
   *
   * The real observer batches this way and guarantees nothing about the order
   * within a batch, which is exactly what a consumer must not depend on — so
   * tests need to be able to hand the changes over deliberately shuffled.
   */
  report(changes: { id: string; isIntersecting: boolean }[]) {
    const entries = changes.map(({ id, isIntersecting }) => {
      const target = this.observed.find((el) => el.id === id)
      if (!target) throw new Error(`#${id} is not observed`)
      return { isIntersecting, target } as unknown as IntersectionObserverEntry
    })
    this.callback(entries, this as unknown as IntersectionObserver)
  }

  /** Report `id` as the element now inside the observed band. */
  enter(id: string) {
    this.report([{ id, isIntersecting: true }])
  }

  /**
   * Report `id` as having scrolled out of the band. The real observer only ever
   * mentions what CHANGED, so a consumer that re-scans its entries each callback
   * loses track of everything still visible from an earlier one.
   */
  leave(id: string) {
    this.report([{ id, isIntersecting: false }])
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
