/// <reference types="@testing-library/jest-dom/vitest" />
import * as React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TransferOwnershipSection } from '../blocks/transfer-ownership-section'

const targets = [
  { slug: 'alice', name: 'Alice' },
  { slug: 'bob', name: 'Bob' },
]

/**
 * Two clicks, not one. The section is a collapsed `Disclosure`, and Disclosure renders its
 * children only while open (`components/disclosure.tsx:70`) — so the menu trigger is not in the
 * DOM at all until the header is clicked. The header is itself a button named for the section
 * ("Transfer Ownership"); the trigger inside is named for the action ("Transfer Persona"), the
 * same split DeleteEntitySection uses ("Danger Zone" / "Delete Persona"). Two buttons sharing one
 * accessible name would make every later `getByRole` ambiguous.
 *
 * No per-file geometry mock: real Base-UI floating parts already render in jsdom via the
 * rect/getComputedStyle stubs in `vitest.setup.ts`, which is how `dropdownMenu.test.tsx` opens a
 * real menu with nothing but `fireEvent.click` + `waitFor`.
 */
async function openMenu(triggerName: string): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Transfer Ownership' }))
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
    await openMenu('Transfer Application')

    // The child is nested, not flattened into the top level...
    expect(screen.queryByRole('menuitem', { name: 'Shop' })).toBeNull()
    // ...and the workspace itself is a branch, never a destination: "transfer to workspace X" is
    // underspecified for an entity that lives in an ecosystem, so clicking it must not preview.
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bob' }))
    expect(onPreview).not.toHaveBeenCalled()
  })
})
