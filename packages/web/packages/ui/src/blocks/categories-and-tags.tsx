"use client"

import * as React from "react"

import { CategoryField, type CategoryTreeNode } from "./category-field"
import { TagSetField } from "./tag-set-field"
import { FIELD_LABEL_GROUP_CLASS } from "./field"
import { cn } from "../lib/utils"

/**
 * The classification block: a thing's ONE category over its SET of tags, as two rows
 * that read as a table.
 *
 * It exists because the two belong together on screen and nowhere else in the code:
 * `CategoryField` and `TagSetField` stay separately importable and separately tested,
 * and this composes them. All it owns is the arrangement — inline captions in one
 * right-aligned column (`--apt-field-label-w`, set here so both rows resolve the same
 * width and their captions' right edges line up) and the gap between the rows.
 *
 * WORDS ARE THE HOST'S. Both halves' `label` and `noun` are required: this block does
 * not know whether it is filing research papers or work items, and a default here would
 * be a string the host cannot reach.
 */
export function CategoriesAndTags({
  category,
  tags,
  disabled = false,
  className,
}: {
  category: {
    /** The row's caption. */
    label: string
    /** The singular, lowercase noun for the controls' microcopy ("category"). */
    noun: string
    /** Suggestion list, never a closed set. */
    options: readonly string[]
    /** The tree behind those names, when the host has one — drives the breadcrumb + rename. */
    nodes?: readonly CategoryTreeNode[]
    /** The chosen name, or `""` for none. */
    value: string
    onChange: (next: string) => void
    onRename?: (node: CategoryTreeNode, nextName: string) => void | Promise<void>
  }
  tags: {
    /** The row's caption — the PLURAL noun. */
    label: string
    /** The singular, lowercase noun for the controls' microcopy ("tag"). */
    noun: string
    options: readonly string[]
    value: string[]
    onChange: (next: string[]) => void
  }
  /** Read-only: both rows at once, since they edit one draft. */
  disabled?: boolean
  className?: string
}): React.ReactElement {
  return (
    <div
      data-slot="categories-and-tags"
      // The label column's width lives here rather than on either field: it is what the two
      // rows share, and setting it once is what makes the captions align. Any host that wants
      // a wider column overrides the same variable through `className`. `FIELD_LABEL_GROUP_CLASS`
      // is the same constant `document-identity-field.tsx` uses for its own (separate) DOM
      // subtree — one source both read, rather than two literals that must be kept equal by hand.
      className={cn("flex w-full flex-col gap-3", FIELD_LABEL_GROUP_CLASS, className)}
    >
      <CategoryField
        layout="inline"
        label={category.label}
        noun={category.noun}
        options={category.options}
        nodes={category.nodes}
        value={category.value}
        onChange={category.onChange}
        onRename={category.onRename}
        disabled={disabled}
      />
      <TagSetField
        layout="inline"
        label={tags.label}
        noun={tags.noun}
        options={tags.options}
        value={tags.value}
        onChange={tags.onChange}
        disabled={disabled}
      />
    </div>
  )
}
