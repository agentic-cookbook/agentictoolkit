import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProfileView } from '../ProfileView'
import type { ProfilePrincipal } from '../types'

/**
 * ProfileView is rendered with NO AuthProvider above it, which is the point rather than a
 * convenience: the component ships on 41 sites and its `useViewerPrincipal` reads
 * `useOptionalAuth`, so "no provider" must mean "anonymous viewer, no upgrade" and must not
 * throw. Every assertion below is therefore about the ANONYMOUS render — the seed principal
 * exactly as the server resolved it.
 */
function principal(over: Partial<ProfilePrincipal> = {}): ProfilePrincipal {
  return {
    slug: 'fishlamp',
    displayName: 'Fish Lamp',
    avatarUrl: null,
    createdAt: '2026-01-02T03:04:05.000Z',
    socialLinks: [],
    emails: [],
    phones: [],
    addresses: [],
    personas: [],
    kind: 'user',
    ...over,
  }
}

describe('ProfileView', () => {
  it('renders the shared header for the principal it was handed', () => {
    render(<ProfileView principal={principal()} siteId="projects" />)
    // UserCard labels its <article> with the display name, so this asserts the HEADER is the
    // card rather than merely that the name appears somewhere on the page.
    expect(screen.getByRole('article', { name: "Fish Lamp's profile" })).toBeInTheDocument()
    expect(screen.getByText('@fishlamp')).toBeInTheDocument()
  })

  it("renders an organization's blurb, which a user card has no field for", () => {
    // `description` is the one field that runs org → user rather than the other way. A user
    // principal carries none, so this is also what distinguishes the two renders.
    render(
      <ProfileView
        principal={principal({ kind: 'organization', description: 'We make lamps for fish.' })}
        siteId="projects"
      />,
    )
    expect(screen.getByText('We make lamps for fish.')).toBeInTheDocument()
  })

  it('renders the passed child section between the header and the footer link', () => {
    render(
      <ProfileView principal={principal()} siteId="projects">
        <section aria-label="Projects">Three public projects</section>
      </ProfileView>,
    )
    expect(screen.getByRole('region', { name: 'Projects' })).toBeInTheDocument()
  })

  it('links to the hub from a site that is not the hub', () => {
    render(<ProfileView principal={principal()} siteId="projects" />)
    const link = screen.getByRole('link', { name: 'Full Profile' })
    // Not asserting the host: `siteUrl` resolves it from the environment, and pinning it here
    // would make this test a second copy of the registry's env detection rather than a check
    // that the profile links to the right PATH.
    expect(link.getAttribute('href')).toContain('/fishlamp')
  })

  it('renders NO Full Profile link on the hub, because that link would point at this page', () => {
    render(<ProfileView principal={principal()} siteId="hub" />)
    expect(screen.queryByRole('link', { name: 'Full Profile' })).toBeNull()
  })
})
