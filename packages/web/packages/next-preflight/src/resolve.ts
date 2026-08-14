import { existsSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Walk the node_modules ancestor chain from `fromDir` looking for `pkgName`,
 * the way Node's own resolution does. Returns the package directory's real
 * path if found, or `undefined` if the walk reaches the filesystem root
 * without finding it.
 *
 * Deliberately does NOT evaluate the target's `exports` map — the question
 * here is whether the package DIRECTORY is reachable at all, which is what
 * the hoisted production tree either does or does not copy.
 *
 * The single shared primitive behind both `resolvesFrom` (a yes/no predicate)
 * and `linkClosure`'s directory lookup — the two used to duplicate this walk
 * with two different termination checks.
 */
export function resolveDirFrom(fromDir: string, pkgName: string): string | undefined {
  let dir = realpathSync(fromDir);
  for (;;) {
    const candidate = join(dir, "node_modules", pkgName);
    if (existsSync(join(candidate, "package.json"))) return realpathSync(candidate);
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** Does a bare specifier resolve from `fromDir`? See {@link resolveDirFrom}. */
export function resolvesFrom(fromDir: string, pkgName: string): boolean {
  return resolveDirFrom(fromDir, pkgName) !== undefined;
}
