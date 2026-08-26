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
  signupLabel = 'join',
  loginLabel = 'login',
}: AuthButtonsProps) {
  // Render as nav-link-styled anchors/buttons so they sit visually inline
  // with the primary nav links. Visual identity comes from
  // `.adh-header__nav-link` in the theme.
  const loginNode = onLogin ? (
    // adh-ui-allow: cs-no-bespoke — this is the <a> two lines down in button clothing: same affordance, same .adh-header__nav-link identity, chosen only by whether a handler or an href was passed. A @agenticdevelopertoolkit/ui <Button> brings its own visual identity, which is exactly what must NOT happen to a nav link.
    <button type="button" onClick={onLogin} className="adh-header__nav-link adh-header__nav-link--button">
      {loginLabel}
    </button>
  ) : loginHref ? (
    <a href={loginHref} className="adh-header__nav-link">{loginLabel}</a>
  ) : null

  const signupNode = onSignup ? (
    // adh-ui-allow: cs-no-bespoke — same as loginNode above: the handler variant of a nav link, not a button. Keep the two branches visually identical.
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
