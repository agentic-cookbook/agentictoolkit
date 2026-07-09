'use client'

// The adh-chrome header family (SiteHeader, MarketingSiteHeader, header-auth)
// deliberately does NOT live here: HeaderAuthState is derived from
// @adh-shared/adh's AdhHeaderAuthProps so it can't drift from the header's
// contract, which pins those modules to the @adh-shared/auth shim package.
export { LoginCard } from './LoginCard'
export type { LoginCardProps } from './LoginCard'
export { SignupCard } from './SignupCard'
export type { SignupCardProps } from './SignupCard'
export { GithubIcon } from './GithubIcon'
