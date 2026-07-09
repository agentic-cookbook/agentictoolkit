'use client'

/** The package's one inline error rendering — every CRUD surface shows thrown
 *  messages the same way. */
export function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm text-apt-red">
      {error}
    </p>
  ) : null
}
