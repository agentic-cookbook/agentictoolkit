import { Link } from 'react-router'
import { slugToBreadcrumbs } from '../../lib/domain-utils'

export default function Breadcrumbs({ slug }: { slug: string }) {
  const crumbs = slugToBreadcrumbs(slug)
  if (crumbs.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1 font-mono text-xs text-[var(--color-text-dim)]">
        <li>
          <Link to="/" className="hover:text-[var(--color-text-secondary)]">
            Home
          </Link>
        </li>
        {crumbs.map((crumb, i) => (
          <li key={crumb.path} className="flex items-center gap-1">
            <span className="text-[var(--color-border)]">/</span>
            {i === crumbs.length - 1 ? (
              <span className="text-[var(--color-text-secondary)]">{crumb.label}</span>
            ) : (
              <Link to={crumb.path} className="hover:text-[var(--color-text-secondary)]">
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
