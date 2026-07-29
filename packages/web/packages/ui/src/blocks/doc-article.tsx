// The prose surface: pre-rendered document HTML dropped into a `.prose` container
// with the family's typography overrides.
//
// ⚠️ TRUSTED INPUT ONLY. `html` goes through `dangerouslySetInnerHTML`, so it must
// be markup the host itself produced — a build-time markdown render of files in
// its own repo, say. Never pass user-submitted or third-party HTML without
// sanitising it first; HDV does no escaping and cannot.
//
// A document is often TWO articles: the body, and (split off at its change-history
// heading) the history table that renders below the metadata block. That split is
// an HTML-string convention owned by the host, so it passes two DocArticles rather
// than one component guessing where to cut.

import type { HTMLAttributes } from "react"

import { cn } from "../lib/utils"

/**
 * The typography contract for rendered document HTML. Exported so a host can
 * apply the same treatment to prose it renders itself (an empty state, an
 * error page) without re-typing the class list.
 */
export const DOC_ARTICLE_PROSE_CLASS =
  "prose max-w-none prose-headings:scroll-mt-20 prose-code:before:content-none prose-code:after:content-none"

export interface DocArticleProps
  extends Omit<
    HTMLAttributes<HTMLElement>,
    "children" | "dangerouslySetInnerHTML"
  > {
  /** Pre-rendered, already-trusted document HTML. See the warning above. */
  html: string
  /** Element to render. `article` for a document, `div` for a fragment of one. */
  as?: "article" | "div" | "section"
}

export function DocArticle({
  html,
  as: Tag = "article",
  className,
  ...rest
}: DocArticleProps) {
  return (
    <Tag
      className={cn(DOC_ARTICLE_PROSE_CLASS, className)}
      dangerouslySetInnerHTML={{ __html: html }}
      {...rest}
    />
  )
}
