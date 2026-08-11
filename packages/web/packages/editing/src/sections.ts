/**
 * SECTIONS — the layout half of an editing container, and the reason a field
 * cannot be silently dropped.
 *
 * Every declared field must appear in exactly one section. That is checked by the
 * TYPE {@link SectionsCheck}, not at runtime: a field the layout forgot is a field
 * the user cannot edit, and the failure mode is invisible — the pane renders, Save
 * works, and one value is simply unreachable. Coverage is therefore a compile
 * error, reported with the missing names in it.
 *
 * `const` type parameters keep the key tuples literal, which is what lets the
 * check name the specific field rather than saying `string`.
 */

export type SectionTone = "default" | "danger"

export interface SectionSpec<TKey extends string = string> {
  readonly title: string
  readonly description?: string
  readonly tone: SectionTone
  readonly keys: readonly TKey[]
}

/** Any section, for use in constraints. Covariant in its keys, so a specific
 *  section is assignable here. */
export type AnySection = SectionSpec<string>

/** A titled group of fields. */
export function section<const TKeys extends readonly string[]>(
  title: string,
  keys: TKeys,
  options?: { readonly description?: string },
): SectionSpec<TKeys[number]> {
  return { title, keys, tone: "default", description: options?.description }
}

/**
 * The irreversible corner — archive, delete, transfer. Same machinery as
 * {@link section}, rendered apart and in the destructive tone, so "this group is
 * dangerous" is a property of the layout rather than a class name someone
 * remembered to add.
 */
export function dangerZone<const TKeys extends readonly string[]>(
  keys: TKeys,
  options?: { readonly title?: string; readonly description?: string },
): SectionSpec<TKeys[number]> {
  return {
    title: options?.title ?? "Danger Zone",
    keys,
    tone: "danger",
    description: options?.description,
  }
}

/** Every key named by any section in the list. */
export type CoveredKeys<TSections extends readonly AnySection[]> =
  TSections[number]["keys"][number]

/**
 * `unknown` when the sections cover the field set exactly (intersecting with
 * `unknown` is a no-op), otherwise an object type that no array of sections can
 * satisfy — so the assignment fails and the error text names what is missing or
 * unrecognised.
 *
 * `[X] extends [never]` rather than `X extends never`: a bare conditional
 * distributes over the union and a `never` operand would make the whole
 * conditional `never`, which reads as "no fields missing" for every input.
 */
export type SectionsCheck<
  TFieldKeys extends string,
  TSections extends readonly AnySection[],
> = ([Exclude<TFieldKeys, CoveredKeys<TSections>>] extends [never]
  ? unknown
  : {
      readonly __missingFields: Exclude<TFieldKeys, CoveredKeys<TSections>>
    }) &
  ([Exclude<CoveredKeys<TSections>, TFieldKeys>] extends [never]
    ? unknown
    : {
        readonly __unknownFields: Exclude<CoveredKeys<TSections>, TFieldKeys>
      })

/**
 * The one coverage rule runtime can see that the type cannot: a key listed by TWO
 * sections. The type system counts the union of the keys, and a union cannot tell
 * one occurrence from two. Returns the duplicated keys, in first-seen order.
 */
export function duplicatedKeys(sections: readonly AnySection[]): string[] {
  const seen = new Set<string>()
  const duplicated: string[] = []
  for (const spec of sections) {
    for (const key of spec.keys) {
      if (seen.has(key)) {
        if (!duplicated.includes(key)) duplicated.push(key)
      } else {
        seen.add(key)
      }
    }
  }
  return duplicated
}
