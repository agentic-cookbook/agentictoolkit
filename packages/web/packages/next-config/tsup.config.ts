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
  // a site resolving `@agentic-toolkit/next-config` alone would 500 on the un-hoisted
  // siblings. `noExternal` overrides that default for these four so they land inside
  // `dist/index.js` as code rather than bare specifiers.
  noExternal: [
    "@agentic-toolkit/adh-registry",
    "@agentic-toolkit/next-env",
    "@agentic-toolkit/next-headers",
    "@agentic-toolkit/next-preflight",
  ],
});
