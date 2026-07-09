import { cn } from "../lib/utils";

/**
 * The platform's one inline error line — a small red, `role="alert"` paragraph.
 * Every surface that shows a thrown/validation message renders it the same way,
 * so the alert styling and the truthy-guard live in exactly one place. `className`
 * adds call-site layout (padding/margin) without re-deriving the markup; it never
 * overrides the size/color. This is the blessed home for the treatment — crud
 * re-exports it for its CRUD surfaces.
 */
export function ErrorText({
  error,
  className,
}: {
  error: string | null | undefined;
  className?: string;
}) {
  return error ? (
    <p role="alert" className={cn("text-sm text-apt-red", className)}>
      {error}
    </p>
  ) : null;
}
