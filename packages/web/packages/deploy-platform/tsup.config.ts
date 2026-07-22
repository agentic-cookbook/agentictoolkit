import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/util/index.ts", "src/cooldown/index.ts"],
  format: ["esm"],
  target: "es2022",
  platform: "node",
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ["drizzle-orm"],
});
