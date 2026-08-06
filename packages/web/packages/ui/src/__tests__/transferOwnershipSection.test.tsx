/// <reference types="@testing-library/jest-dom/vitest" />
import * as React from 'react'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import {
  TransferOwnershipSection,
  type TransferPreviewResult,
  type TransferTarget,
} from '../blocks/transfer-ownership-section'

const targets = [
  { slug: 'alice', kind: 'customer' as const, name: 'Alice' },
  { slug: 'bob', kind: 'customer' as const, name: 'Bob' },
]

/**
 * Two clicks, not one — hence two helpers. The section is a collapsed `Disclosure`, and Disclosure
 * renders its children only while open (`components/disclosure.tsx:70`), so the menu trigger is not
 * in the DOM at all until the header is clicked. They stay separate because the header TOGGLES:
 * a test that opens the menu twice must expand the section once, or the second call collapses it.
 *
 * The header is itself a button named for the section ("Transfer Ownership"); the trigger inside is
 * named for the action ("Transfer Persona"), the same split DeleteEntitySection uses ("Danger Zone"
 * / "Delete Persona"). Two buttons sharing one accessible name would make every later `getByRole`
 * ambiguous.
 *
 * No per-file geometry mock: real Base-UI floating parts already render in jsdom via the
 * rect/getComputedStyle stubs in `vitest.setup.ts`, which is how `dropdownMenu.test.tsx` opens a
 * real menu with nothing but `fireEvent.click` + `waitFor`.
 */
function openSection(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Transfer Ownership' }))
}

async function openMenu(triggerName: string): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: triggerName }))
  await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument())
}

describe('TransferOwnershipSection', () => {
  it('previews before confirming and names who loses access', async () => {
    const onPreview = vi.fn().mockResolvedValue({
      newId: 'persona.bob.charlie',
      tokens: 2,
      revoking: [{ kind: 'user' as const, id: 'u1', name: 'Dana', via: 'team' as const }],
    })
    const onConfirm = vi.fn().mockResolvedValue(undefined)

    render(
      <TransferOwnershipSection
        entityNoun="Persona"
        entityLabel="persona.alice.charlie"
        targets={targets}
        currentTarget={{ slug: 'alice', kind: 'customer' }}
        onPreview={onPreview}
        onConfirm={onConfirm}
      />,
    )

    openSection()
    await openMenu('Transfer Persona')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bob' }))

    await waitFor(() => expect(onPreview).toHaveBeenCalledWith(targets[1]))
    expect(await screen.findByText(/persona\.bob\.charlie/)).toBeTruthy()
    expect(screen.getByText(/Dana/)).toBeTruthy()
    expect(screen.getByText(/2 API tokens/)).toBeTruthy()
    expect(onConfirm).not.toHaveBeenCalled()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'persona.alice.charlie' } })
    fireEvent.click(screen.getByRole('button', { name: 'Transfer' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(targets[1]))
  })

  it('arms Transfer only once the object\'s own identifier is typed back exactly', async () => {
    /**
     * The gate {@link DeleteEntitySection} already applies, for the same reason: the destination
     * comes from a dropdown, so the whole transfer is otherwise two clicks away from a persona
     * leaving the workspace. Exact match — case-sensitive, untrimmed — so a near-miss reads as a
     * near-miss rather than quietly arming.
     */
    const onPreview = vi.fn().mockResolvedValue({ newId: 'persona.bob.charlie', tokens: 0, revoking: [] })
    const onConfirm = vi.fn().mockResolvedValue(undefined)

    render(
      <TransferOwnershipSection
        entityNoun="Persona"
        entityLabel="persona.alice.charlie"
        targets={targets}
        onPreview={onPreview}
        onConfirm={onConfirm}
      />,
    )
    openSection()
    await openMenu('Transfer Persona')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bob' }))

    const input = await screen.findByRole('textbox')
    expect(screen.getByRole('button', { name: 'Transfer' })).toBeDisabled()

    // A prefix does not count...
    fireEvent.change(input, { target: { value: 'persona.alice' } })
    expect(screen.getByRole('button', { name: 'Transfer' })).toBeDisabled()
    // ...nor does a case fold...
    fireEvent.change(input, { target: { value: 'Persona.Alice.Charlie' } })
    expect(screen.getByRole('button', { name: 'Transfer' })).toBeDisabled()
    // ...nor stray whitespace, which is NOT trimmed.
    fireEvent.change(input, { target: { value: ' persona.alice.charlie ' } })
    expect(screen.getByRole('button', { name: 'Transfer' })).toBeDisabled()

    fireEvent.change(input, { target: { value: 'persona.alice.charlie' } })
    expect(screen.getByRole('button', { name: 'Transfer' })).toBeEnabled()

    // Backing out and re-aiming at another workspace closes the gate again: the losses just
    // read no longer describe the transfer the armed button would run.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await openMenu('Transfer Persona')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Alice' }))
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''))
    expect(screen.getByRole('button', { name: 'Transfer' })).toBeDisabled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('names a bucket access-group loss, including principals only that layer can produce', async () => {
    /**
     * A storage bucket's authorization is its `access.groups` seats and nothing else — the bucket
     * tables carry no row-level security behind them — so a group seat is its own `via` ("group"),
     * and the member list admits principals the roles layer never yields (an organization, an app,
     * an API token). The preview is the only place an admin sees them before the move.
     *
     * The literal below is annotated `TransferPreviewResult` on purpose: it is a COMPILE-time
     * assertion as much as a runtime one. Narrow `revoking`'s unions back to the roles-layer
     * spellings and `pnpm run lint` (tsc --noEmit) fails on this object, before any test runs.
     */
    const preview: TransferPreviewResult = {
      newId: 'storage.bob.shop.assets',
      tokens: 0,
      revoking: [
        { kind: 'organization', id: 'o1', name: 'Northwind', via: 'group' },
        { kind: 'token', id: 't1', name: 'ci-deploy', via: 'group' },
        { kind: 'app', id: 'a1', name: 'Reporter', via: 'group' },
      ],
    }
    const onPreview = vi.fn().mockResolvedValue(preview)

    render(
      <TransferOwnershipSection
        entityNoun="Storage Bucket"
        entityLabel="storage.alice.shop.assets"
        targets={targets}
        onPreview={onPreview}
        onConfirm={vi.fn()}
      />,
    )
    openSection()
    await openMenu('Transfer Storage Bucket')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bob' }))

    // Every one of the three is rendered: a subject the dialog cannot name is a loss the admin
    // authorizes blind.
    expect(await screen.findByText(/Northwind/)).toBeTruthy()
    expect(screen.getByText(/ci-deploy/)).toBeTruthy()
    expect(screen.getByText(/Reporter/)).toBeTruthy()
  })

  it('disables the workspace that already owns the object', async () => {
    render(
      <TransferOwnershipSection
        entityNoun="Persona"
        entityLabel="persona.alice.charlie"
        targets={targets}
        currentTarget={{ slug: 'alice', kind: 'customer' }}
        onPreview={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    openSection()
    await openMenu('Transfer Persona')
    // `data-disabled` is Base UI's own hook — this package's CSS keys on it
    // (`styles/components.css:98`), so asserting it pins the same contract the theme relies on.
    expect(screen.getByRole('menuitem', { name: 'Alice (current)' })).toHaveAttribute('data-disabled')
  })

  it('keeps two same-slug workspaces apart by kind, and greys out only the matching one', async () => {
    /**
     * `customer.customers.slug` and `organization.organizations.slug` are separate namespaces with
     * separate uniques, so a user whose own slug is `acme` can also belong to an org called `acme`.
     * Keyed by slug alone these were two React children with the same key, and BOTH read as the
     * current workspace — so the one destination the user actually wanted was the disabled one.
     */
    const onPreview = vi.fn().mockResolvedValue({ newId: null, tokens: 0, revoking: [] })
    const collision = [
      { slug: 'acme', kind: 'customer' as const, name: 'Acme (personal)' },
      { slug: 'acme', kind: 'organization' as const, name: 'Acme Inc' },
    ]

    render(
      <TransferOwnershipSection
        entityNoun="Persona"
        entityLabel="persona.acme.charlie"
        targets={collision}
        currentTarget={{ slug: 'acme', kind: 'customer' }}
        onPreview={onPreview}
        onConfirm={vi.fn()}
      />,
    )
    openSection()
    await openMenu('Transfer Persona')

    expect(screen.getByRole('menuitem', { name: 'Acme (personal) (current)' })).toHaveAttribute('data-disabled')
    const org = screen.getByRole('menuitem', { name: 'Acme Inc' })
    expect(org).not.toHaveAttribute('data-disabled')

    // ...and picking it previews the ORG, kind included, so the server resolves the namespace the
    // user pointed at rather than the one its own precedence order checks first.
    fireEvent.click(org)
    await waitFor(() => expect(onPreview).toHaveBeenCalledWith(collision[1]))
  })

  it('nests a target that carries children, and never treats it as a destination', async () => {
    const onPreview = vi.fn()
    render(
      <TransferOwnershipSection
        entityNoun="Application"
        entityLabel="app.alice.web"
        targets={[{ slug: 'bob', name: 'Bob', children: [{ slug: 'ecosystem.bob.shop', name: 'Shop' }] }]}
        onPreview={onPreview}
        onConfirm={vi.fn()}
      />,
    )
    openSection()
    await openMenu('Transfer Application')

    // The child is nested, not flattened into the top level...
    expect(screen.queryByRole('menuitem', { name: 'Shop' })).toBeNull()
    // ...and the workspace itself is a branch, never a destination: "transfer to workspace X" is
    // underspecified for an entity that lives in an ecosystem, so clicking it must not preview.
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bob' }))
    expect(onPreview).not.toHaveBeenCalled()
  })

  it('can be cancelled while the preflight is still running, and ignores its late answer', async () => {
    // The preflight is read-only, so it must never seal the dialog. Hold it open by hand.
    let settle!: (r: unknown) => void
    const onPreview = vi.fn().mockReturnValue(new Promise((res) => { settle = res }))

    render(
      <TransferOwnershipSection
        entityNoun="Persona"
        entityLabel="persona.alice.charlie"
        targets={targets}
        currentTarget={{ slug: 'alice', kind: 'customer' }}
        onPreview={onPreview}
        onConfirm={vi.fn()}
      />,
    )
    openSection()
    await openMenu('Transfer Persona')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bob' }))
    expect(await screen.findByText('Checking…')).toBeInTheDocument()

    // Cancel is live during the preflight — the whole point of the fix.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByText('Checking…')).toBeNull())

    // The orphaned preflight answers afterwards; it must not repopulate a dismissed dialog. (This
    // half holds for free — `reset()` nulls `chosen`, which unmounts DialogContent, so there is
    // nowhere for a late answer to land. The `previewSeq` guard is what the NEXT test pins.)
    settle({ newId: 'persona.bob.charlie', tokens: 0, revoking: [] })
    await waitFor(() => expect(screen.queryByText(/persona\.bob\.charlie/)).toBeNull())
  })

  it('never shows a stale preflight in the dialog for the workspace picked after it', async () => {
    /**
     * The case `previewSeq` exists for, and the only one where a late answer is dangerous: the
     * dialog is OPEN, for Bob, while Alice's abandoned preflight resolves. Without the guard,
     * Alice's losses render under a Transfer button that confirms Bob — the user authorizes one
     * move having been shown the consequences of another. Delete either `seq` check in `choose()`
     * and this test fails; the cancel test above passes either way.
     */
    const settlers = new Map<string, (r: TransferPreviewResult) => void>()
    const onPreview = vi.fn(
      (t: TransferTarget) =>
        new Promise<TransferPreviewResult>((res) => { settlers.set(t.slug, res) }),
    )
    /** Answers one in-flight preflight — and fails the test, rather than TypeErroring, if the
     *  preflight it names was never started. */
    function settle(slug: string, result: TransferPreviewResult): void {
      const res = settlers.get(slug)
      if (!res) throw new Error(`no preflight in flight for ${slug}`)
      res(result)
    }

    render(
      <TransferOwnershipSection
        entityNoun="Persona"
        entityLabel="persona.carol.charlie"
        targets={targets}
        onPreview={onPreview}
        onConfirm={vi.fn()}
      />,
    )

    // Pick Alice, abandon her mid-preflight, then pick Bob. The section stays expanded throughout,
    // so the header is clicked once — openMenu alone reopens the dropdown.
    openSection()
    await openMenu('Transfer Persona')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Alice' }))
    expect(await screen.findByText('Checking…')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByText('Checking…')).toBeNull())

    await openMenu('Transfer Persona')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bob' }))
    expect(await screen.findByText('Checking…')).toBeInTheDocument()

    // Alice's preflight answers now, into Bob's open dialog.
    await act(async () => {
      settle('alice', { newId: 'persona.alice.charlie', tokens: 9, revoking: [] })
    })

    expect(screen.queryByText(/persona\.alice\.charlie/)).toBeNull()
    expect(screen.queryByText(/9 API tokens/)).toBeNull()
    expect(screen.getByText('Checking…')).toBeInTheDocument()

    // Bob's own answer still lands — the guard orphans the stale preflight, not the live one.
    await act(async () => {
      settle('bob', { newId: 'persona.bob.charlie', tokens: 0, revoking: [] })
    })
    expect(screen.getByText(/persona\.bob\.charlie/)).toBeInTheDocument()
  })
})
