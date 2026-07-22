import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/util/index.ts",
    "src/cooldown/index.ts",
    "src/schema/index.ts",
    "src/conn/index.ts",
    "src/providers/index.ts",
    "src/canon/index.ts",
    "src/enumerate/index.ts",
  ],
  format: ["esm"],
  target: "es2022",
  platform: "node",
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ["drizzle-orm"],
});
