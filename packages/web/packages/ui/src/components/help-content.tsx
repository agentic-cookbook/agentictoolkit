"use client"

import { createContext, useContext, type ReactElement, type ReactNode } from "react"

/** What a help popover is FOR, which is the only thing its icon says.
 *  Three cover the cases the feature was asked for; a fourth is added when
 *  something needs one. */
export type HelpFlavor = "help" | "info" | "new"

export interface HelpEntry {
  /** Optional heading above the body. Omitted for the header's site-name entry,
   *  which is derived from SEO copy and has no title to invent. */
  title?: string
  /** A string, not a ReactNode: 36 of the 40 site configs are `.ts` and cannot
   *  hold JSX, and this value is declared in those files. */
  body: string
  /** Default `info`. */
  flavor?: HelpFlavor
}

/** A site's help copy, keyed by the id a <HelpEnabled> names. */
export type SiteHelp = Record<string, HelpEntry>

/** The id the shared header's site name looks up. Lives here rather than in
 *  `adh/header` because `adh/site` needs it too, and `adh/site` already imports
 *  `adh/marketing`, which imports `adh/header` — a constant on that side would
 *  close the cycle. */
export const SITE_TITLE_HELP_ID = "site-title"

const HelpContentContext = createContext<SiteHelp>({})

/** Publishes a site's help copy to everything below it.
 *
 *  Mounted at the document level rather than passed to the header, because four
 *  sites replace the shared header entirely via MarketingRootHtml's `header`
 *  slot — a prop would reach the shared header and miss them. */
export function HelpContentProvider({
  help,
  children,
}: {
  help: SiteHelp
  children: ReactNode
}): ReactElement {
  return (
    <HelpContentContext.Provider value={help}>{children}</HelpContentContext.Provider>
  )
}

/** The entry for `id`, or undefined when the site declared none.
 *
 *  Undefined rather than a throw, including with no provider mounted at all:
 *  the first consumer is in the header on every page of every site, so a throw
 *  here turns a typo into a white screen. <HelpEnabled> warns in development
 *  instead. */
export function useHelpEntry(id: string): HelpEntry | undefined {
  return useContext(HelpContentContext)[id]
}
