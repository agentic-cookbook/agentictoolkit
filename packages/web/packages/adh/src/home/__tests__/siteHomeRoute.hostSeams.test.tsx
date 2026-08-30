// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { defineSiteHome } from '../SiteHomeModel'
import { SiteHomeRoute } from '../SiteHomeRoute'
import type { SiteHomeShellProps } from '../SiteHomeModel'

/**
 * The HOST-SEAM contract: what `render`'s second argument is at a mount that fills no seams, and
 * that a mount which does fill them reaches the model unchanged.
 *
 * Worth pinning here rather than trusting the type, because the seam's whole safety rests on a
 * rule TypeScript cannot state — "every field of a seam bag is optional" — enforced at runtime by
 * one `host ?? EMPTY_HOST_SEAMS` and one `as never` cast. If that fallback were ever dropped, the
 * 30-odd sites that fill nothing would hand their models `undefined`, and every model that
 * destructures the bag would throw on its first render. The types would still compile.
 *
 * The failure this defends against is also SILENT in the other direction. `render` took ONE
 * argument until 2026-08-30; a model still written that way ignores the second and works, which
 * is exactly what makes it possible to add the parameter to the interface, forget it at a mount,
 * and notice nothing until a hub-only section quietly stops rendering. So both directions are
 * asserted: absent ⇒ `{}`, present ⇒ that same object.
 *
 * Mounted through a STUB shell (`model.shell`) that calls `children` with a fixed scope, rather
 * than the real SiteHomeShell. Nothing here is about workspace resolution — the seam is decided
 * one line below the shell either way — and borrowing the resolution harness would make this test
 * fail for reasons that have nothing to do with what it is asserting.
 */

vi.mock('next/navigation', () => ({
  useParams: () => ({ workspace: 'acme' }),
}))

/** A shell that resolves nothing: it hands `children` a settled scope and renders the result. */
function ImmediateShell({ children }: SiteHomeShellProps): ReactNode {
  return children({
    workspaceSlug: 'acme',
    scopedBase: '/acme',
    workspace: { slug: 'acme', name: 'Acme', kind: 'organization' },
  })
}

interface TestSeams {
  renderExtra?: () => ReactNode
}

afterEach(cleanup)

describe('SiteHomeRoute host seams', () => {
  it('hands a model that fills no seams an EMPTY bag, never undefined', () => {
    const seen = vi.fn()
    const model = defineSiteHome({
      parse: () => null,
      render: (_ctx, host: TestSeams) => {
        seen(host)
        // The destructure a real model does. It is the line that throws on `undefined`, so doing
        // it here is the point rather than an implementation detail of the assertion.
        const { renderExtra } = host
        return <div>{renderExtra?.() ?? 'no extra'}</div>
      },
      shell: ImmediateShell,
    })

    const { container } = render(<SiteHomeRoute model={model} path={[]} />)

    expect(seen).toHaveBeenCalledTimes(1)
    expect(seen.mock.calls[0]![0]).toEqual({})
    expect(container.textContent).toBe('no extra')
  })

  it('hands a model the mount’s seams when the mount supplies them', () => {
    const seen = vi.fn()
    const model = defineSiteHome({
      parse: () => null,
      render: (_ctx, host: TestSeams) => {
        seen(host)
        return <div>{host.renderExtra?.() ?? 'no extra'}</div>
      },
      shell: ImmediateShell,
    })
    // Module-scope-stable in real code; a const here for the identity assertion below.
    const seams: TestSeams = { renderExtra: () => 'hub chrome' }

    const { container } = render(<SiteHomeRoute model={model} path={[]} host={seams} />)

    // Identity, not equality. A route that rebuilt or spread the bag would pass a deep-equal
    // object and break memoization inside any model that forwards a seam into component props —
    // which is the failure the `host` prop's own docs warn a CALLER about, and this pins the
    // route's half of that bargain.
    expect(seen.mock.calls[0]![0]).toBe(seams)
    expect(container.textContent).toBe('hub chrome')
  })

  it('leaves the 30-odd single-parameter models alone', () => {
    // A model written before the seam existed: one parameter, no `host`. The interface grew a
    // second argument, and this is the assertion that growing it cost those models nothing —
    // JS ignores extra arguments, so the only way this breaks is a future change that makes the
    // seam REQUIRED, which is precisely the change that should fail here.
    const model = defineSiteHome({
      parse: () => null,
      render: ({ scopedBase }) => <div>{scopedBase}</div>,
      shell: ImmediateShell,
    })

    const { container } = render(<SiteHomeRoute model={model} path={[]} />)

    expect(container.textContent).toBe('/acme')
  })
})
