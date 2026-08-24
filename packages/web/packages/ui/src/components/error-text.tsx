import { cn } from "../lib/utils"

/**
 * The platform's one inline error line — a small red, `role="alert"` paragraph.
 * Every surface that shows a thrown/validation message renders it the same way,
 * so the alert styling and the truthy-guard live in exactly one place. `className`
 * adds call-site layout (padding/margin) without re-deriving the markup. It goes
 * through `cn`, so it CAN also override the metrics, and a few dense surfaces do
 * (`text-xs` in the DM composer and the notification inbox, where `text-sm` would
 * outweigh the rows it sits under). What it must never override is the COLOUR or
 * the `role="alert"` — those two are the treatment, and they are the reason this
 * is the blessed home for it. crud re-exports it for its CRUD surfaces.
 */
export function ErrorText({
  error,
  className,
}: {
  error: string | null | undefined
  className?: string
}) {
  return error ? (
    <p role="alert" className={cn("text-sm text-apt-red", className)}>
      {error}
    </p>
  ) : null
}

/**
 * The same error line for the one place `ErrorText` cannot go: INSIDE a dialog's
 * description. Base UI renders `DialogDescription` as a `<p>`, and a `<p>` may not
 * nest inside a `<p>` — the browser closes the outer one and the error escapes the
 * element it was appended to. So this is a `<span>` (block-displayed, so it still
 * takes its own line) rather than a second treatment.
 *
 * It keeps the `role="alert"` for the reason that matters here: the modal is ALREADY
 * open and traps focus when the action fails, so text appended to the description
 * changes under a screen reader with nothing to announce it, and there is no other
 * route to the reason. Every confirm dialog that can fail in place renders this, so
 * the markup and that reasoning live once instead of once per dialog.
 *
 * The TREATMENT is `ErrorText`’s, to the token: same `text-sm`, same `text-apt-red`. The
 * element is the only thing that differs, because the element is the only thing the `<p>`
 * nesting rule forces — a second colour here would mean two consecutive failures of the same
 * kind (a rename refused, then a delete refused) rendering in two different reds.
 */
export function DialogErrorText({
  error,
  className,
}: {
  error: string | null | undefined
  className?: string
}) {
  return error ? (
    <span role="alert" className={cn("mt-2 block text-sm text-apt-red", className)}>
      {error}
    </span>
  ) : null
}
