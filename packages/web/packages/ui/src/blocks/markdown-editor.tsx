"use client"

import { useId, useRef, type ChangeEvent, type ReactNode } from "react"
import { Upload } from "lucide-react"

import { cn } from "../lib/utils"
import { Button } from "../components/button"
import { Label } from "../components/label"
import { Textarea } from "../components/textarea"
import { EditorToolbar } from "../components/editor-toolbar"
import { MarkdownQuickReference } from "../components/markdown-quick-reference"
import { fieldCaptionClass } from "../lib/typography"

export interface MarkdownEditorProps {
  /** Controlled markdown source. */
  value: string
  /** Called with the next markdown source as the user types. */
  onChange: (next: string) => void
  /** Caption above the textarea; also the textarea's accessible name. */
  label?: ReactNode
  /** Placeholder shown while the textarea is empty. */
  placeholder?: string
  /** Visible textarea height, in rows. */
  rows?: number
  /** Toggle the browser's native spell-checker on the textarea (default off —
   *  markdown source is full of non-words). */
  spellCheck?: boolean
  /** When set, a built-in "Upload .md" toolbar control reads a chosen file and
   *  reports its text + filename. The caller decides what to do with it (e.g.
   *  set the body and derive a title) — the editor never owns title logic. */
  onUpload?: (text: string, fileName: string) => void
  /** Render the built-in markdown quick-reference control in the toolbar. */
  quickReference?: boolean
  /** Extra toolbar controls, slotted ahead of the built-in controls (e.g. a
   *  future spell-check toggle). */
  toolbarExtras?: ReactNode
  /** Accessible name for the toolbar. */
  toolbarLabel?: string
  className?: string
  /** Extra classes for the textarea. */
  textareaClassName?: string
  /** Disable typing, upload, and toolbar controls. */
  disabled?: boolean
}

/** Read a chosen `.md` file and hand its text + name back to the caller — the
 *  built-in upload control. Keeps the hidden native-input pattern (the only way
 *  to open a file picker; there is no @adh-shared file-upload primitive). */
function UploadMarkdownControl({
  onUpload,
  disabled,
}: {
  onUpload: (text: string, fileName: string) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function onFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    // Reset the input so re-choosing the same file fires change again.
    event.target.value = ""
    if (!file) return
    const text = await file.text()
    onUpload(text, file.name)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <Upload data-icon="inline-start" />
        Upload .md
      </Button>
      {/* adh-ui-allow: cs-no-bespoke — a file picker requires a native <input type="file">; there is no @adh-shared file-upload primitive, and the editor's upload control mandates it. The input is sr-only/aria-hidden; the visible control is the shared Button above. approved by mike 2026-06-26 */}
      <input
        ref={inputRef}
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        disabled={disabled}
        onChange={onFile}
      />
    </>
  )
}

/**
 * The shared markdown **body** editor: a labelled textarea for the raw markdown
 * source, with an editor toolbar row above it (an optional `.md` upload control,
 * a built-in quick-reference popover, and a slot for extra controls). The label
 * is associated with the textarea via `htmlFor`, so it is the textarea's
 * accessible name. Controlled via `value` / `onChange`; the editor owns no title
 * or classification fields — those stay with the consuming form.
 */
export function MarkdownEditor({
  value,
  onChange,
  label = "Markdown body",
  placeholder,
  rows = 16,
  spellCheck = false,
  onUpload,
  quickReference = true,
  toolbarExtras,
  toolbarLabel = "Markdown editor toolbar",
  className,
  textareaClassName,
  disabled,
}: MarkdownEditorProps) {
  const textareaId = useId()
  const hasToolbar = Boolean(toolbarExtras) || Boolean(onUpload) || quickReference

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-3">
        <Label
          htmlFor={textareaId}
          className={fieldCaptionClass}
        >
          {label}
        </Label>
        {hasToolbar && (
          <EditorToolbar ariaLabel={toolbarLabel}>
            {toolbarExtras}
            {onUpload && (
              <UploadMarkdownControl onUpload={onUpload} disabled={disabled} />
            )}
            {quickReference && <MarkdownQuickReference />}
          </EditorToolbar>
        )}
      </div>
      <Textarea
        id={textareaId}
        rows={rows}
        spellCheck={spellCheck}
        disabled={disabled}
        className={cn("font-mono text-[0.8rem]", textareaClassName)}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
