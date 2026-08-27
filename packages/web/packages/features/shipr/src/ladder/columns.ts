/**
 * The colour of each rung.
 *
 * The script's own palette, kept: `main` plain, then cool-to-warm down the pipeline, so a
 * glance at a row says how far into the fleet a commit has reached. Two people looking at
 * the same repository — one in a terminal, one in this tab — should be looking at the same
 * picture, and a second palette would make "the green one" mean two different rungs.
 *
 * `prep` and `ship` are deliberately DIFFERENT colours even though they are the same commit
 * one repository apart. They sit in different repositories, they move on different commands,
 * and drawing them identically puts the reader back to telling them apart by counting
 * columns — which is the thing the ladder exists to make unnecessary.
 *
 * Keyed by the backend's column key (`src/shipr/ladder.ts` — `LADDER_COLUMNS`, where an
 * environment's key is its first four characters). A key with no entry falls back to the
 * body colour rather than disappearing: a new environment should render plainly, not
 * invisibly.
 *
 * `test` AND `prod` GO THROUGH `var()`, and the other four do not. The categorical hues
 * live in a plain `:root` rather than in `@theme` (see `themes/src/tailwind.css`), so
 * Tailwind's tree-shaking never emits a `text-apt-cat-*` utility and the class name was a
 * no-op — cyan and magenta both rendered as inherited white, which is the two columns
 * `main` is supposed to be the only white one among (Mike). An arbitrary value referencing
 * the variable is the consumption path those tokens are documented to have.
 */
export const COLUMN_COLOR: Readonly<Record<string, string>> = {
  main: 'text-apt-text',
  prep: 'text-apt-blue',
  ship: 'text-apt-green',
  test: 'text-[var(--color-apt-cat-teal)]',
  stag: 'text-apt-gold',
  prod: 'text-[var(--color-apt-cat-pink)]',
};

export function columnColor(key: string): string {
  return COLUMN_COLOR[key] ?? 'text-apt-text';
}

/**
 * The width the `when` column has to be for the shas to line up.
 *
 * Measured over the rows actually being drawn, not assumed: "3 weeks ago" and "2 days ago"
 * differ by a character, and a fixed guess either wastes a column on every row or lets the
 * longest one push its subject out of line.
 */
export function whenWidth(rows: readonly { when: string }[]): number {
  return rows.reduce((w, r) => Math.max(w, r.when.length), 0);
}
