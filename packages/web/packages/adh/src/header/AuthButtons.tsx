'use client'

import { Button } from '../components/ui/button'

export type AuthButtonsProps = {
  onSignup?: () => void
  onLogin?: () => void
  signupHref?: string
  loginHref?: string
  signupLabel?: string
  loginLabel?: string
}

export function AuthButtons({
  onSignup,
  onLogin,
  signupHref,
  loginHref,
  signupLabel = 'Sign up',
  loginLabel = 'Log in',
}: AuthButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      {onLogin ? (
        <Button variant="ghost" size="sm" onClick={onLogin}>
          {loginLabel}
        </Button>
      ) : loginHref ? (
        <Button variant="ghost" size="sm" asChild>
          <a href={loginHref}>{loginLabel}</a>
        </Button>
      ) : null}
      {onSignup ? (
        <Button size="sm" onClick={onSignup}>
          {signupLabel}
        </Button>
      ) : signupHref ? (
        <Button size="sm" asChild>
          <a href={signupHref}>{signupLabel}</a>
        </Button>
      ) : null}
    </div>
  )
}
