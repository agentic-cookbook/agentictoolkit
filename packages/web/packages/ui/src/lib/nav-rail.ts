import { cva, type VariantProps } from 'class-variance-authority'

/**
 * The family's vertical nav-rail link grammar — ONE home for the "list of
 * navigable things with a gold active item" idiom, shared by the CRUD feature
 * rail (@adh-shared/crud CrudTablePage) and the details-page topic rail
 * (@adh-shared/adh DetailsRail). A left-accent-border pill: muted by default,
 * with a gold left marker, accent-dim fill, and gold text when active.
 *
 * `apt-gold` (= --color-primary) is the unambiguous brand gold. On the details
 * pages the M3 runtime resolves --color-accent to the SAME value, so this
 * reproduces the rail's former hand-rolled --cg-accent styling exactly while
 * staying gold everywhere else (where the shadcn `--color-accent` is a neutral
 * surface). Callers own the container (row-wrap vs. column) and may add their
 * own type treatment, e.g. `font-mono` for code-like segment names.
 */
export const railLinkVariants = cva(
  'block rounded-md border-l-2 border-transparent px-3 py-1.5 text-sm no-underline outline-none transition-colors',
  {
    variants: {
      active: {
        true: 'border-l-apt-gold bg-apt-gold/15 text-apt-gold',
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
