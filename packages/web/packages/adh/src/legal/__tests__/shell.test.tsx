import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import * as legal from '../index'
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
    expect(Object.keys(legal).sort()).toEqual(['LegalPageShell'])
  })
})
