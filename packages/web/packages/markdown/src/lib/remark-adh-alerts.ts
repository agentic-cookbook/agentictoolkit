/**
 * remark plugin — GitHub-style alert blockquotes → ADH callouts.
 *
 * Turns
 *   > [!WARNING]
 *   > body…
 * into a `<div class="adh-mv-alert adh-mv-alert--warning">` with a title line, styled by
 * markdown-viewer.css. This is ours (a ~40-line transform, no docs-framework dependency), so the
 * one affordance worth keeping from Fumadocs's `<Callout>` renders consistently with the rest of
 * ADH — in the modal, the docs sites, everywhere the shared renderer runs.
 *
 * Works entirely on the mdast tree via `data.hName` / `data.hProperties`, which remark-rehype
 * honours when it converts to hast — so no hast pass and no unist-util-visit dependency. The
 * resulting `div`/`p` + className survive rehype-sanitize (both tags + className are allowlisted).
 */

interface MdNode {
  type: string
  value?: string
  children?: MdNode[]
  data?: { hName?: string; hProperties?: Record<string, unknown>; [k: string]: unknown }
  [k: string]: unknown
}

/** GitHub's five alert kinds → their display titles. */
const ALERT_TITLES: Record<string, string> = {
  NOTE: 'Note',
  TIP: 'Tip',
  IMPORTANT: 'Important',
  WARNING: 'Warning',
  CAUTION: 'Caution',
}

// Leading `[!TYPE]` marker (optionally followed by the rest of the first line).
const MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/

export function remarkAdhAlerts() {
  return (tree: MdNode): void => {
    walk(tree)
  }
}

function walk(node: MdNode): void {
  if (!node.children) return
  for (const child of node.children) {
    if (child.type === 'blockquote') transformAlert(child)
    // Recurse regardless, so alerts nested in lists / other blockquotes are caught too.
    walk(child)
  }
}

function transformAlert(bq: MdNode): void {
  const firstPara = bq.children?.[0]
  if (!firstPara || firstPara.type !== 'paragraph' || !firstPara.children?.length) return

  const firstInline = firstPara.children[0]
  if (!firstInline || firstInline.type !== 'text' || typeof firstInline.value !== 'string') return

  const match = MARKER.exec(firstInline.value)
  const kind = match?.[1] // NOTE | TIP | IMPORTANT | WARNING | CAUTION
  if (!kind) return
  const title = ALERT_TITLES[kind] ?? kind

  // Drop the "[!TYPE]" marker (and any trailing newline) from the first text node.
  firstInline.value = firstInline.value.slice(match[0].length)

  // If the marker sat alone on the first line, the first paragraph is now empty — remove it so the
  // alert doesn't open with a blank line. Otherwise keep the paragraph (body followed the marker).
  if (firstInline.value === '') {
    if (firstPara.children.length === 1) bq.children!.shift()
    else firstPara.children.shift()
  }

  // Retag the blockquote → <div class="adh-mv-alert adh-mv-alert--<kind>">.
  bq.data = bq.data ?? {}
  bq.data.hName = 'div'
  bq.data.hProperties = {
    ...(bq.data.hProperties ?? {}),
    className: ['adh-mv-alert', `adh-mv-alert--${kind.toLowerCase()}`],
  }

  // Prepend the title line (retagged → <p class="adh-mv-alert-title">; the icon is CSS ::before).
  const titleNode: MdNode = {
    type: 'paragraph',
    data: { hProperties: { className: ['adh-mv-alert-title'] } },
    children: [{ type: 'text', value: title }],
  }
  bq.children!.unshift(titleNode)
}
