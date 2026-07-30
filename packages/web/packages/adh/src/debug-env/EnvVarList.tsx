'use client'

import type { EnvVarEntry } from './env-vars'

export type EnvVarListProps = {
  /** Env vars that are set (already masked where secret), in display order. */
  entries: EnvVarEntry[]
}

/**
 * Read-only list of the env vars the site is paying attention to that are set.
 * Secret-named values arrive pre-masked from the server (see `env-vars.ts`).
 */
export function EnvVarList({ entries }: EnvVarListProps) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-apt-text-muted">
        No tracked env vars are set.
      </p>
    )
  }
  return (
    <dl className="flex flex-col gap-1.5">
      {entries.map((entry) => (
        <div
          key={entry.name}
          className="flex items-baseline justify-between gap-4 text-xs"
        >
          <dt className="shrink-0 font-mono text-apt-text-muted">{entry.name}</dt>
          <dd className="min-w-0 text-right font-mono break-all text-apt-text">
            {entry.value}
            {entry.secret && (
              <span className="ml-1 text-apt-text-dim">(masked)</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}
