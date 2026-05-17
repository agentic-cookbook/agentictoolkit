import type { ReactNode } from 'react'

export type AppShellProps = {
  header: ReactNode
  sidebar?: ReactNode
  toc?: ReactNode
  children: ReactNode
}

export function AppShell({ header, sidebar, toc, children }: AppShellProps) {
  const cls = [
    'awt-app-shell',
    !sidebar && 'awt-app-shell--no-sidebar',
    !toc && 'awt-app-shell--no-toc',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={cls}>
      <div className="awt-app-shell__header">{header}</div>
      {sidebar && <div className="awt-app-shell__sidebar">{sidebar}</div>}
      <main className="awt-app-shell__main">{children}</main>
      {toc && <div className="awt-app-shell__toc">{toc}</div>}
    </div>
  )
}
