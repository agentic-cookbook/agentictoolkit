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

/**
 * One node of the document tree: a section, a directory, or a page.
 *
 * There is no `kind` discriminator on purpose — a node with `children` is a
 * branch and one without is a leaf, which is the only distinction the tree
 * draws. `label` is a string rather than a `ReactNode` because the collapse
 * control announces itself with it ("Expand Principles").
 */
export interface HdvNavNode {
  /** Display text, and the accessible name of a collapse control. */
  label: string
  /** Destination, and the node's identity within the tree. */
  href: string
  /**
   * Headings to inline beneath a leaf, for sites where a page's own outline
   * belongs in the nav. HDV renders every entry it is given — filtering by
   * depth, or deciding which pages deserve an outline at all, is the host's
   * call and stays in the host's adapter.
   */
  headings?: HeadingEntry[]
  /** Child nodes. Present and non-empty makes this node a branch. */
  children?: HdvNavNode[]
}

/**
 * A fixed row outside the tree — a page that is not a document, drawn with a
 * section's own type but with no contents to open ("Projects", "Changelog").
 *
 * They are data rather than a slot so the divider that separates them from the
 * tree can appear and disappear along with them. `DocNav` takes two lists,
 * `topLinks` and `bottomLinks`, which differ only in which side of the tree they
 * sit on and therefore which side of them the divider goes.
 */
export interface DocNavTopLink {
  label: ReactNode
  href: string
}

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
