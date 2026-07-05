"use client"

import type { HTMLAttributes, ReactElement, ReactNode, Ref } from "react"

import { cn } from "../lib/utils"

// A themable dashboard panel: a bordered/rounded card with a consistent header
//
//   [icon] [title] [titleAfter]  …flex…  [center]  …flex…  [actions]
//
// over a body that is either content-sized (a stat card) or a scrolling fill
// pane (a list). Styled with the family `apt-*` token utilities like every
// other block (the old inline-style + hex-fallback layer predates the central
// @source registration that guarantees these utilities exist on every site).
// Generic on purpose — the host owns what goes in the header slots and the
// body (icons, copy buttons, filter controls, progress bars, rows).

/** Default header height — shared so sibling panels' headers line up on a rail. */
export const INFO_PANEL_HEADER_HEIGHT = 41

// Hoisted so the header doesn't allocate a fresh (constant-valued) style object
// on every render — the height is a module constant, not caller-dynamic.
const HEADER_STYLE = { minHeight: INFO_PANEL_HEADER_HEIGHT } as const

export interface InfoPanelProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Leading glyph shown before the title — bring your own color/size. */
  icon?: ReactNode
  title: ReactNode
  /** Rendered immediately after the title (e.g. a copy button). */
  titleAfter?: ReactNode
  /** Dim count after the title; omit (or 0) to hide. */
  count?: number
  /** Centered header slot — e.g. a progress bar. */
  center?: ReactNode
  /** Right-justified header slot — e.g. a filter box + an options gear. */
  actions?: ReactNode
  /** Fill + scroll mode: the body scrolls and the panel flexes to fill its
   *  track. Default false → a content-sized card. */
  scroll?: boolean
  /** Outer flex shorthand (mostly for fill mode), e.g. "1 1 0". */
  flex?: string
  maxHeight?: string | number
  /** Body padding; mode-dependent default (card: 12/16, scroll: 8/16). */
  bodyPadding?: string
  /** Ref to the scrolling body element (so the host can tail/anchor it). */
  bodyRef?: Ref<HTMLDivElement>
  /** Accessible region name; defaults to `title` when it is a string. */
  ariaLabel?: string
  children: ReactNode
}

export function InfoPanel({
  icon,
  title,
  titleAfter,
  count,
  center,
  actions,
  scroll = false,
  flex,
  maxHeight,
  bodyPadding,
  bodyRef,
  ariaLabel,
  "aria-label": ariaLabelAttr,
  className,
  style,
  children,
  ...rest
}: InfoPanelProps): ReactElement {
  // Precedence: explicit `ariaLabel` prop → a raw `aria-label` attr → string
  // title. The raw attr is pulled OUT of `...rest` so the explicit
  // `aria-label={label}` below can't clobber a caller's name with `undefined`.
  const label =
    ariaLabel ?? ariaLabelAttr ?? (typeof title === "string" ? title : undefined)
  return (
    <section
      // Remaining host attributes (data-*, id, handlers) pass through to the
      // panel root so hosts can tag it for tests/analytics without a wrapper.
      {...rest}
      aria-label={label}
      className={cn(
        "flex flex-col overflow-hidden rounded-[10px] border border-apt-border bg-apt-surface text-apt-text",
        scroll && "min-h-0",
        className,
      )}
      // flex/maxHeight are caller-supplied layout numbers, not theme knowledge.
      style={{ flex: flex ?? (scroll ? "1 1 0" : "0 0 auto"), maxHeight, ...style }}
    >
      <div
        className="box-border flex flex-none items-center gap-2 border-b border-apt-border py-1 pr-3 pl-3.5"
        style={HEADER_STYLE}
      >
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          {icon && (
            <span className="inline-flex shrink-0 items-center" aria-hidden>
              {icon}
            </span>
          )}
          <span className="text-sm font-semibold whitespace-nowrap">{title}</span>
          {count != null && count > 0 && (
            <span className="font-mono text-[11px] text-apt-text-dim">{count}</span>
          )}
          {titleAfter}
        </div>
        {center != null && (
          <div className="flex min-w-0 flex-1 items-center justify-center">{center}</div>
        )}
        {actions != null && (
          <div className={cn("flex shrink-0 items-center gap-2", center == null && "ml-auto")}>
            {actions}
          </div>
        )}
      </div>
      <div
        ref={bodyRef}
        className={cn(scroll ? "min-h-0 flex-auto overflow-y-auto" : "flex-none")}
        style={{ padding: bodyPadding ?? (scroll ? "8px 16px 10px" : "12px 16px") }}
      >
        {children}
      </div>
    </section>
  )
}
