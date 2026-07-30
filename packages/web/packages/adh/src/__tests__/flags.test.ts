import { describe, expect, it } from 'vitest'
import { FLAG, type FlagKey } from '../flags'

describe('@agentic-toolkit/adh/flags', () => {
  it('keeps every shipped flag key byte-identical to the pre-split vocabulary', () => {
    expect(FLAG).toEqual({
      newUserSignups: 'new_user_signups',
      newUserInvitations: 'new_user_invitations',
      emailAuth: 'email_auth',
      githubOauth: 'github_oauth',
      googleOauth: 'google_oauth',
      appleOauth: 'apple_oauth',
      gitlabOauth: 'gitlab_oauth',
      bitbucketOauth: 'bitbucket_oauth',
      enablePasskeySignin: 'enable_passkey_signin',
      // `show_bitbag` is deliberately absent: bitbag stopped being flag-gated when he
      // became a permanent footer fixture (BitbagDock), so the key was retired rather
      // than left as a switch that no longer switches anything. See footerBitbag.test.tsx,
      // which proves the footer ignores a stale disabled row still sitting in the table.
      landingSiteExplorerDiagram: 'landing_site_explorer_diagram',
      useHierarchicalMenuDetailsView: 'use_hierarchical_menu_details_view',
    })
  })

  it('types FlagKey as the value union', () => {
    const key: FlagKey = FLAG.enablePasskeySignin
    expect(key).toBe('enable_passkey_signin')
  })
})
