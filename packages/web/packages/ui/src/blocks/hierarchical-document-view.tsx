// The HDV frame: two nested flex rows that place the reader's three columns.
//
// It is deliberately TWO components rather than one, because the three columns
// do not live in one place. The nav persists across navigations and belongs to
// the host's layout; the article and its rail are the page. A single component
// taking all three slots would pull the nav into the page and remount it on
// every route change, resetting the sections the reader had opened — the one
// piece of state `DocNavTree` exists to keep.
//
// Slots only: no data, no state, no router, no landmarks. What is worth sharing
// here is the measure and the column widths, which have to agree with
// `DOC_NAV_ASIDE_CLASS` and `DOC_TABLE_OF_CONTENTS_CLASS`; a consumer
// re-deriving them by eye gets a reader that is subtly too wide to read.

import type { HTMLAttributes, ReactNode } from "react"

import { cn } from "../lib/utils"

/** The outer row: nav column, then everything else. */
export const HIERARCHICAL_DOCUMENT_VIEW_CLASS = "flex flex-1"

/**
 * The content region beside the nav.
 *
 * A `div`, not a `main`: hosts already have a `main` landmark in their app
 * shell, and a second one nested inside it is invalid HTML. The host owns its
 * landmarks; HDV owns the columns.
 */
export const HIERARCHICAL_DOCUMENT_VIEW_CONTENT_CLASS = "flex-1 min-w-0"

/** The inner row: article, then the rail. */
export const DOC_PAGE_CLASS = "flex"

/**
 * The reader's measure. `max-w-3xl` is the whole point of the block — prose
 * that runs the full width of a 1440px window is unreadable.
 */
export const DOC_PAGE_ARTICLE_CLASS =
  "flex-1 min-w-0 px-6 py-8 lg:px-10 max-w-3xl"

export interface HierarchicalDocumentViewProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /**
   * The nav column — normally `DocNav`, rendered unwrapped so it keeps its own
   * `aside`, sticky offset and drawer. Omit it for a document with no tree.
   */
  nav?: ReactNode
  /** The document region: one `DocPage` per route. */
  children: ReactNode
}

/**
 * The frame that goes in the host's layout, around its routed content.
 *
 * ```tsx
 * <HierarchicalDocumentView nav={<DocNav … />}>{children}</HierarchicalDocumentView>
 * ```
 */
export function HierarchicalDocumentView({
  nav,
  children,
  className,
  ...rest
}: HierarchicalDocumentViewProps) {
  return (
    <div className={cn(HIERARCHICAL_DOCUMENT_VIEW_CLASS, className)} {...rest}>
      {nav}
      <div className={HIERARCHICAL_DOCUMENT_VIEW_CONTENT_CLASS}>{children}</div>
    </div>
  )
}

export interface DocPageProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /**
   * The right rail — normally `DocTableOfContents`, rendered unwrapped so it
   * keeps its own `aside` and sticky offset. Omit it and the article gets the
   * full width of the content region.
   */
  toc?: ReactNode
  /** The document itself: breadcrumbs, article, metadata, source. */
  children: ReactNode
}

/**
 * The frame that goes in the host's page, around one document.
 *
 * ```tsx
 * <DocPage toc={<DocTableOfContents … />}>
 *   <DocBreadcrumbs … />
 *   <DocArticle … />
 * </DocPage>
 * ```
 */
export function DocPage({ toc, children, className, ...rest }: DocPageProps) {
  return (
    <div className={cn(DOC_PAGE_CLASS, className)} {...rest}>
      <div className={DOC_PAGE_ARTICLE_CLASS}>{children}</div>
      {toc}
    </div>
  )
}
