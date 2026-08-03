/** The Danger Zone's copy is parameterized by `actionVerb` so a REVERSIBLE destructive action
 *  (archive) can reuse the same two-phase type-to-confirm ceremony without telling the user their
 *  data is being deleted. The default stays "Delete", so every existing caller is unchanged. */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DeleteEntitySection } from '../blocks/delete-entity-section'

const noop = async (): Promise<void> => {}

/** The section is a Disclosure, collapsed by default; its header is a button carrying the title. */
function disclose(): void {
  fireEvent.click(screen.getByRole('button', { name: /Danger Zone/ }))
}

describe('DeleteEntitySection', () => {
  it('defaults to Delete wording', () => {
    render(
      <DeleteEntitySection
        entityNoun="Team"
        confirmValue="team.x"
        childEntities="its members"
        onConfirm={noop}
      />,
    )
    disclose()
    expect(screen.getByRole('button', { name: /^Delete Team$/ })).toBeInTheDocument()
  })

  it('uses a supplied action verb through both dialog phases', () => {
    render(
      <DeleteEntitySection
        entityNoun="Organization"
        confirmValue="acme"
        childEntities="its handle"
        onConfirm={noop}
        description="Archiving hides this organization and frees its handle."
        actionVerb={{ imperative: 'Archive', gerund: 'Archiving' }}
      />,
    )
    disclose()
    fireEvent.click(screen.getByRole('button', { name: /^Archive Organization$/ }))

    expect(screen.getByText('Archive Organization?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))

    expect(screen.getByText('Archive this Organization')).toBeInTheDocument()
    // The whole flow must be free of "delete" — the action is reversible.
    expect(screen.queryByText(/[Dd]elete/)).toBeNull()
  })
})
