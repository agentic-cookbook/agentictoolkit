// Shared vocabulary for the Hierarchical Document View (HDV) — the block family
// that renders a long-form document site: a collapsible nav tree, breadcrumbs,
// prose, a frontmatter metadata block, and a scrollspy table of contents.
//
// HDV is deliberately router-agnostic: it never imports `next/link` or
// `next/navigation`. A host injects its router through `LinkComponent` and tells
// HDV which page is current through a plain `activePath` string. That keeps the
// package usable from any React app and keeps the "what is the current route?"
// subscription where it belongs — in the host's own client component.
//
// NOTE: this file is `.ts`, so it is NOT reachable through the `./blocks/*`
// export wildcard (which maps to `*.tsx`). That is intentional — these types are
// re-exported from the `./blocks` barrel, which is the one public import path.

import type { AnchorHTMLAttributes, ComponentType, ReactNode } from "react"

/** A heading extracted from the rendered document, used by the nav and the ToC. */
export interface HeadingEntry {
  id: string
  text: string
  depth: number
}

/**
 * The host's link component. HDV renders `<LinkComponent to="/x">` wherever it
 * needs navigation; a Next host passes a 3-line adapter around `next/link`, and
 * anything else can let it default to a plain `<a href>`.
 *
 * `to` rather than `href` so the adapter is an explicit mapping, not an
 * accidental structural match with `<a>`.
 */
export type DocLinkComponent = ComponentType<
  { to: string; children?: ReactNode } & Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    "href"
  >
>

/** One breadcrumb segment: what to show, and where it points. */
export interface DocCrumb {
  label: ReactNode
  path: string
}

/**
 * One row of the document's frontmatter block ("version 1.2.0", "tags a, b").
 *
 * `value` may be an array of nodes, in which case the row renders them as a
 * wrapping, right-aligned group — the idiom for a list of references. The host
 * decides which frontmatter fields exist and how each renders; HDV only lays
 * them out.
 */
export interface DocMetadataField {
  label: ReactNode
  value: ReactNode
}
