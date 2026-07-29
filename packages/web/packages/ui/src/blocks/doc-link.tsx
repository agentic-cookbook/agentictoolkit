// The default `DocLinkComponent` — a plain `<a href>`. HDV renders links through
// an injected component so it never depends on a router; this is the fallback for
// hosts that have none (a plain React app, a test, a Storybook story). A Next host
// passes a three-line adapter around `next/link` instead.
//
// It lives in its own file rather than inside doc-breadcrumbs.tsx because both the
// breadcrumbs and the nav tree need it, and a nav importing from a breadcrumbs
// module would be a coupling with no reason behind it.

import type { AnchorHTMLAttributes, ReactNode } from "react"

export interface DefaultDocLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  /** Destination path. Named `to` to match `DocLinkComponent`. */
  to: string
  children?: ReactNode
}

export function DefaultDocLink({ to, children, ...rest }: DefaultDocLinkProps) {
  return (
    <a href={to} {...rest}>
      {children}
    </a>
  )
}
