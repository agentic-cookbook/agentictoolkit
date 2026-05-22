'use client'

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
  signupLabel = 'signup',
  loginLabel = 'login',
}: AuthButtonsProps) {
  // Render as nav-link-styled anchors/buttons so they sit visually inline
  // with the primary nav links. Visual identity comes from
  // `.adh-header__nav-link` in the theme.
  const loginNode = onLogin ? (
    <button type="button" onClick={onLogin} className="adh-header__nav-link adh-header__nav-link--button">
      {loginLabel}
    </button>
  ) : loginHref ? (
    <a href={loginHref} className="adh-header__nav-link">{loginLabel}</a>
  ) : null

  const signupNode = onSignup ? (
    <button type="button" onClick={onSignup} className="adh-header__nav-link adh-header__nav-link--button">
      {signupLabel}
    </button>
  ) : signupHref ? (
    <a href={signupHref} className="adh-header__nav-link">{signupLabel}</a>
  ) : null

  return (
    <>
      {loginNode}
      {signupNode}
    </>
  )
}
