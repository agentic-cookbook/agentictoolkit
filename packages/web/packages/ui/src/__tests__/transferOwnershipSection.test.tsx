/// <reference types="@testing-library/jest-dom/vitest" />
import * as React from 'react'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TransferOwnershipSection } from '../blocks/transfer-ownership-section'

const targets = [
  { slug: 'alice', name: 'Alice' },
  { slug: 'bob', name: 'Bob' },
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
        currentTargetSlug="alice"
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

    fireEvent.click(screen.getByRole('button', { name: 'Transfer' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(targets[1]))
  })

  it('disables the workspace that already owns the object', async () => {
    render(
      <TransferOwnershipSection
        entityNoun="Persona"
        entityLabel="persona.alice.charlie"
        targets={targets}
        currentTargetSlug="alice"
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
        currentTargetSlug="alice"
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
    const settlers: Record<string, (r: unknown) => void> = {}
    const onPreview = vi.fn(
      (t: { slug: string }) => new Promise((res) => { settlers[t.slug] = res as (r: unknown) => void }),
    )

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
      settlers.alice({ newId: 'persona.alice.charlie', tokens: 9, revoking: [] })
    })

    expect(screen.queryByText(/persona\.alice\.charlie/)).toBeNull()
    expect(screen.queryByText(/9 API tokens/)).toBeNull()
    expect(screen.getByText('Checking…')).toBeInTheDocument()

    // Bob's own answer still lands — the guard orphans the stale preflight, not the live one.
    await act(async () => {
      settlers.bob({ newId: 'persona.bob.charlie', tokens: 0, revoking: [] })
    })
    expect(screen.getByText(/persona\.bob\.charlie/)).toBeInTheDocument()
  })
})
