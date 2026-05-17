export type BreadcrumbEntry = { label: string; path: string }

function titleCase(s: string): string {
  return s
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function slugToBreadcrumbs(slug: string): BreadcrumbEntry[] {
  if (slug === '/') return []
  const parts = slug.split('/').filter(Boolean)
  const crumbs: BreadcrumbEntry[] = []
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (!part) continue
    crumbs.push({
      label: titleCase(part),
      path: '/' + parts.slice(0, i + 1).join('/'),
    })
  }
  return crumbs
}
