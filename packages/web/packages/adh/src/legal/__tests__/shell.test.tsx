import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import * as shell from '../LegalPageShell'
import { LegalPageShell } from '../LegalPageShell'

describe('LegalPageShell (copy-free)', () => {
  it('renders the effective date it is given', () => {
    render(
      <LegalPageShell prefix="Terms of" title="Service" effectiveDate="June 23, 2026">
        <p>body</p>
      </LegalPageShell>,
    )
    expect(screen.getByText('Effective June 23, 2026')).toBeTruthy()
    expect(screen.getByText('body')).toBeTruthy()
  })

  it('exports no adh legal copy and no adh constants', () => {
    // The SHELL module, not the barrel. This package is adh's, so the barrel
    // re-exporting Terms/Privacy and the adh constants is the point — that is what
    // absorbing `@adh/chrome/legal` meant. What must stay copy-free is this file:
    // the chrome every site in the family renders, whose dates and addresses arrive
    // as props. The same commit that merged the copy in also moved the constants OUT
    // of here into `constants.ts`; this is the assertion that keeps them out.
    expect(Object.keys(shell).sort()).toEqual(['LegalPageShell'])
  })
})
