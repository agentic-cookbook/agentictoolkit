import type { HTMLAttributes, ReactNode } from "react"

import { ExternalLink } from "../components/external-link"
import { StatRow, type StatTone } from "../components/stat"
import { InfoPanel } from "./info-panel"

// The dashboard stat card — an InfoPanel headed by an icon + title with an
// optional "{tool} ↗" deep link in the actions slot, over a stack of StatRows,
// freeform content, and a muted mono footnote. Pure assembly: the shell is
// InfoPanel, the rows are StatRow, the link is ExternalLink — this block owns
// only the arrangement.

export interface StatCardStat {
  label: ReactNode
  value: ReactNode
  tone?: StatTone
}

export interface StatCardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode
  /** Leading header glyph — bring your own color/size (matches InfoPanel). */
  icon?: ReactNode
  /** "{label} ↗" deep link into the source tool, in the header's actions slot. */
  link?: { href: string; label: ReactNode }
  /** Extra header controls after the link (e.g. a live status word). */
  actions?: ReactNode
  /** Declarative stat rows; freeform `children` render after them. */
  stats?: StatCardStat[]
  children?: ReactNode
  /** Muted mono qualifier under the rows (e.g. "anonymous · cookieless"). */
  footnote?: ReactNode
}

export function StatCard({
  title,
  icon,
  link,
  actions,
  stats,
  children,
  footnote,
  className,
  ...rest
}: StatCardProps) {
  const headerActions =
    link != null || actions != null ? (
      <>
        {link && <ExternalLink href={link.href}>{link.label}</ExternalLink>}
        {actions}
      </>
    ) : undefined
  return (
    <InfoPanel
      title={title}
      icon={icon}
      actions={headerActions}
      className={className}
      {...rest}
    >
      <div className="flex flex-col gap-2.5">
        {stats?.map((s, i) => (
          // Key by the label when it is a stable string/number (the row's
          // identity), falling back to index only for opaque ReactNode labels.
          <StatRow
            key={typeof s.label === "string" || typeof s.label === "number" ? s.label : i}
            label={s.label}
            value={s.value}
            tone={s.tone}
          />
        ))}
        {children}
        {footnote != null && (
          <div className="pt-0.5 font-mono text-[10px] text-apt-text-dim">{footnote}</div>
        )}
      </div>
    </InfoPanel>
  )
}
