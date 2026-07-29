// The document's frontmatter block: a right-aligned `<dl>` of "label value" rows
// that sits between the prose and its change history.
//
// HDV lays the rows out and nothing more. WHICH fields a document has, what they
// are called, how a value is formatted, and whether a value is a link are all the
// host's business — cookbook decides that a `status` of "accepted" is not worth a
// row and that a reference starting `http` renders as an `<a>`; another site will
// decide differently. Both hand HDV the same shape: a list of label/value pairs.

import type { HTMLAttributes, ReactNode } from "react"
import { Fragment } from "react"

import { cn } from "../lib/utils"
import type { DocMetadataField } from "./doc-types"

export interface DocMetadataProps
  extends Omit<HTMLAttributes<HTMLDListElement>, "children"> {
  /** The rows, in display order. Render nothing when empty. */
  fields: DocMetadataField[]
}

export function DocMetadata({ fields, className, ...rest }: DocMetadataProps) {
  if (fields.length === 0) return null

  return (
    <dl
      className={cn(
        "flex flex-col items-end gap-0.5 font-mono text-[11px] mb-6",
        className,
      )}
      {...rest}
    >
      {fields.map((field, index) => {
        // An array value is a LIST of values for one label (a document's
        // references, its tags) — it wraps as a right-aligned group rather than
        // pushing the row off the edge. Anything else renders as-is.
        const items = Array.isArray(field.value)
          ? (field.value as ReactNode[])
          : null
        return (
          <div key={index} className="flex gap-2">
            <dt className="text-[var(--color-text-dim)]">{field.label}</dt>
            <dd className="text-[var(--color-text-secondary)]">
              {items ? (
                <span className="flex flex-wrap justify-end gap-x-3">
                  {items.map((item, itemIndex) => (
                    <Fragment key={itemIndex}>{item}</Fragment>
                  ))}
                </span>
              ) : (
                field.value
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
