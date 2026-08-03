/** The Danger Zone's copy is parameterized by `actionVerb` so a REVERSIBLE destructive action
 *  (archive) can reuse the same two-phase type-to-confirm ceremony without telling the user their
 *  data is being deleted, or that the action is permanent. Passing no `actionVerb` at all must
 *  render today's exact "Delete"/"Permanently"/"cannot be undone" wording, unchanged — every
 *  existing caller (TeamSettingsPane, EcosystemSettingsPane, the ui-showcase demo) passes none. */
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
  it('defaults to Delete/Permanently/cannot-be-undone wording through both dialog phases', () => {
    render(
      <DeleteEntitySection
        entityNoun="Team"
        confirmValue="team.x"
        childEntities="its members"
        onConfirm={noop}
      />,
    )
    disclose()
    // Collapsed section's built-in description (no `description` prop passed).
    expect(
      screen.getByText('Permanently delete this team and all of its data. This cannot be undone.'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Delete Team$/ }))

    // Phase 1 (warn).
    expect(screen.getByText('Delete Team?')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Deleting a team deletes all the data associated with the team, including its members. Do you wish to proceed?',
      ),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))

    // Phase 2 (type-to-confirm).
    expect(screen.getByText('Permanently delete this Team')).toBeInTheDocument()
    expect(screen.getByText(/^You are about to permanently delete this Team\./)).toBeInTheDocument()
    expect(screen.getByText('Type team.x to confirm deletion')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Permanently Delete' })).toBeInTheDocument()
  })

  it('uses a supplied reversible action verb through both dialog phases, with no "delete" anywhere', () => {
    render(
      <DeleteEntitySection
        entityNoun="Organization"
        confirmValue="acme"
        childEntities="its handle"
        onConfirm={noop}
        description="Archiving hides this organization and frees its handle."
        actionVerb={{ imperative: 'Archive', gerund: 'Archiving', reversible: true }}
      />,
    )
    disclose()
    fireEvent.click(screen.getByRole('button', { name: /^Archive Organization$/ }))

    expect(screen.getByText('Archive Organization?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))

    expect(screen.getByText('Archive this Organization')).toBeInTheDocument()
    // The whole flow must be free of "delete" — the action is reversible.
    expect(screen.queryByText(/[Dd]elete/)).toBeNull()
    // ...and free of any claim that it is permanent or irreversible.
    expect(screen.queryByText(/permanently/i)).toBeNull()
    expect(screen.queryByText(/cannot be undone/i)).toBeNull()
  })

  it('a reversible action verb never claims permanence even without a caller-supplied description', () => {
    render(
      <DeleteEntitySection
        entityNoun="Organization"
        confirmValue="acme"
        childEntities="its handle"
        onConfirm={noop}
        actionVerb={{ imperative: 'Archive', gerund: 'Archiving', reversible: true }}
      />,
    )
    disclose()
    // The built-in fallback description (no `description` override) must itself be
    // reversible-safe — this is the exact gap a prior review round caught: the fallback
    // hardcoded "Permanently {verb} ... This cannot be undone." regardless of reversibility.
    expect(screen.getByText('Archive this organization. This can be undone later.')).toBeInTheDocument()
    expect(screen.queryByText(/permanently/i)).toBeNull()
    expect(screen.queryByText(/cannot be undone/i)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /^Archive Organization$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))

    // Phase 2 (type-to-confirm) must also stay reversible-safe: no "permanently", no "deletion".
    expect(screen.queryByText(/permanently/i)).toBeNull()
    expect(screen.queryByText(/deletion/i)).toBeNull()
    expect(screen.getByText('Type acme to confirm')).toBeInTheDocument()
  })
})
