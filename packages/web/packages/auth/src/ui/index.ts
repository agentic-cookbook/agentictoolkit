'use client'

// The adh-chrome header family (SiteHeader, MarketingSiteHeader) deliberately does
// NOT live here: it resolves adh's own 45-site registry, so it belongs to adh's app
// tier (@agentic-toolkit/adh). The generic half — the header primitives and the pluggable
// auth-source contract whose HeaderAuthState is derived from AdhHeaderAuthProps, so
// it can't drift from the header's contract — lives in @agentic-toolkit/adh.
export { LoginCard } from './LoginCard'
export type { LoginCardProps, LoginMode } from './LoginCard'
export { MfaStep } from './MfaStep'
export type { MfaStepProps, MfaOperations } from './MfaStep'
export { SignupCard } from './SignupCard'
export type { SignupCardProps } from './SignupCard'
export { GithubIcon } from './GithubIcon'
