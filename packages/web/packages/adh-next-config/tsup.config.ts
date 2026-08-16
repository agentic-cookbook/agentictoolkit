import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  platform: "node",
  splitting: false,
  clean: true,
  external: ["next"],
  // tsup auto-externalizes anything listed in package.json `dependencies` by default —
  // the brief's `external: ["next"]` alone does NOT bundle the four siblings, it only
  // adds `next` on top of that default. Verified by building with `noExternal` absent:
  // `dist/index.js` still carried a bare `import ... from "@agentic-toolkit/next-preflight"`
  // (Step 8's grep found it), which is exactly the defect this package exists to prevent —
  // a site resolving `@agentic-toolkit/adh-next-config` alone would 500 on the un-hoisted
  // siblings. `noExternal` overrides that default for these four so they land inside
  // `dist/index.js` as code rather than bare specifiers.
  // `@agentic-toolkit/themes` is a DECLARED dependency (see package.json) but is
  // DELIBERATELY ABSENT from this list — it must stay external, the opposite of the
  // other four siblings. `materialize-fonts.mjs` locates its font files relative to
  // `import.meta.url` (its OWN module URL), and its export map ships it as raw
  // `src/materialize-fonts.mjs` with no `dist`/no build step, on purpose — see that
  // file's header. Bundling it into `dist/index.js` would move `import.meta.url` to
  // this package's dist file, and `FONTS_DIR` would resolve to a `next-config/dist/fonts`
  // that does not exist, breaking font materialization for every site. Do NOT add it
  // here to "match the other siblings" — that would reintroduce the exact defect this
  // package exists to prevent, just for a different file.
  noExternal: [
    "@agentic-toolkit/adh-registry",
    "@agentic-toolkit/next-env",
    "@agentic-toolkit/next-headers",
    "@agentic-toolkit/next-preflight",
  ],
});
