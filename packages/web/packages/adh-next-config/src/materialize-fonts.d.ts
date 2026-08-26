/**
 * Ambient declaration for the theme's font-materializer subpath export.
 *
 * `@agenticdevelopertoolkit/themes`'s package.json maps `./materialize-fonts` straight to
 * `src/materialize-fonts.mjs` — deliberately raw JS with no `dist` and no `types`
 * condition (see that file's own header: building or type-generating it would defeat
 * its `import.meta.url`-relative font lookup, the same reason it stays external in
 * this package's `tsup.config.ts`). Every existing caller is itself a plain
 * `next.config.mjs`, so this package is the first TypeScript consumer of the
 * subpath and there is no upstream declaration file to pick up.
 */
declare module "@agenticdevelopertoolkit/themes/materialize-fonts" {
  /**
   * Copy the theme's woff2 faces into an app's `public/`, so they are served from
   * the app's own origin at the absolute path the theme css already names. See the
   * module's own JSDoc for the full contract; only the shape this package calls is
   * declared here.
   */
  export function materializeThemeFonts(appRoot?: string): void;
}
