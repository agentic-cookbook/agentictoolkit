import { existsSync, realpathSync } from "node:fs";
import { dirname, join, parse } from "node:path";

/**
 * Does a bare specifier resolve from `fromDir`?
 *
 * Walks node_modules up the ancestor chain the way Node does. Deliberately does
 * NOT evaluate the target's `exports` map — the question here is whether the
 * package DIRECTORY is reachable at all, which is what the hoisted production
 * tree either does or does not copy.
 */
export function resolvesFrom(fromDir: string, pkgName: string): boolean {
  let dir = realpathSync(fromDir);
  const { root } = parse(dir);
  for (;;) {
    if (existsSync(join(dir, "node_modules", pkgName, "package.json"))) return true;
    if (dir === root) return false;
    const parent = dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
}
