import { cva, type VariantProps } from 'class-variance-authority'

/**
 * The family's vertical nav-rail link grammar — ONE home for the "list of
 * navigable things with a highlighted active item" idiom, shared by the CRUD
 * feature rail (@agentic-toolkit/crud CrudTablePage) and the details-page topic
 * rail (@agentic-toolkit/adh DetailsRail). A left-accent-border pill: muted by
 * default, with a left marker, a dim fill, and matching text when active.
 *
 * All three active parts read `apt-highlight`, the family's "this is the current
 * item" colour, so they can never drift apart. It defaults to --color-primary —
 * the unambiguous brand gold, which on the details pages the M3 runtime also
 * resolves --color-accent to — so this still reproduces the rail's former
 * hand-rolled --cg-accent styling exactly and stays gold everywhere else (where
 * the shadcn `--color-accent` is a neutral surface). A theme whose highlighted
 * state differs from its resting brand gold sets --color-highlight, and only the
 * active row moves. Callers own the container (row-wrap vs. column) and may add
 * their own type treatment, e.g. `font-mono` for code-like segment names.
 */
export const railLinkVariants = cva(
  'block rounded-md border-l-2 border-transparent px-3 py-1.5 text-sm no-underline outline-none transition-colors',
  {
    variants: {
      active: {
        true: 'border-l-apt-highlight bg-apt-highlight/15 text-apt-highlight',
        false:
          'text-apt-text-muted hover:bg-apt-surface-2 hover:text-apt-text focus-visible:border-l-apt-gold focus-visible:bg-apt-surface-2 focus-visible:text-apt-text',
      },
      /** A nested/child row — indented and slightly smaller (the details rail's
       *  leaf topics). Wrap the result in `cn()` so tailwind-merge collapses the
       *  base `text-sm` against the leaf `text-[0.85rem]`. */
      leaf: {
        true: 'pl-6 text-[0.85rem]',
        false: '',
      },
    },
    defaultVariants: { active: false, leaf: false },
  },
)

export type RailLinkVariants = VariantProps<typeof railLinkVariants>
