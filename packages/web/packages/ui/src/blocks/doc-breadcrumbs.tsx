// The document reader's breadcrumb trail: a fixed home crumb, then one crumb per
// ancestor, with the current page rendered as plain text rather than a link.
//
// The caller supplies the crumbs already resolved — HDV deliberately does not
// derive them from a slug, because every site slices its URL space differently
// (cookbook's `slugToBreadcrumbs` title-cases domain segments; another site might
// look labels up in a manifest). Deriving them here would bake one site's URL
// convention into the toolkit.

import type { HTMLAttributes } from "react"

import { cn } from "../lib/utils"
import { DefaultDocLink } from "./doc-link"
import type { DocCrumb, DocLinkComponent } from "./doc-types"

export interface DocBreadcrumbsProps
  extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** Ancestor crumbs, root-first. The last one is the current page. */
  crumbs: DocCrumb[]
  /** Label for the always-present first crumb. */
  homeLabel?: DocCrumb["label"]
  /** Destination for the always-present first crumb. */
  homeHref?: string
  /** The host's router link. Defaults to a plain `<a href>`. */
  LinkComponent?: DocLinkComponent
}

export function DocBreadcrumbs({
  crumbs,
  homeLabel = "Home",
  homeHref = "/",
  LinkComponent = DefaultDocLink,
  className,
  ...rest
}: DocBreadcrumbsProps) {
  // At the root there is no trail to show — a lone "Home" crumb pointing at the
  // page you are already on is noise, so the whole nav disappears.
  if (crumbs.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className={cn("mb-4", className)} {...rest}>
      <ol className="flex items-center gap-1 font-mono text-xs text-[var(--color-text-dim)]">
        <li>
          <LinkComponent
            to={homeHref}
            className="hover:text-[var(--color-text-secondary)]"
          >
            {homeLabel}
          </LinkComponent>
        </li>
        {crumbs.map((crumb, index) => (
          <li key={crumb.path} className="flex items-center gap-1">
            <span className="text-[var(--color-border)]">/</span>
            {index === crumbs.length - 1 ? (
              <span className="text-[var(--color-text-secondary)]">
                {crumb.label}
              </span>
            ) : (
              <LinkComponent
                to={crumb.path}
                className="hover:text-[var(--color-text-secondary)]"
              >
                {crumb.label}
              </LinkComponent>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
