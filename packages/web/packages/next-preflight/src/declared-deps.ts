import { readFileSync, realpathSync, existsSync } from "node:fs";
import { join } from "node:path";
import { resolveDirFrom, resolvesFrom } from "./resolve.js";

export { resolvesFrom };

type Manifest = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};

function readManifest(dir: string): Manifest | undefined {
  const p = join(dir, "package.json");
  if (!existsSync(p)) return undefined;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Manifest;
  } catch (err) {
    // Swallowing this drops the node from the closure walk silently — exactly
    // the malformed input the gate should be loudest about — so warn instead
    // of going quiet.
    console.warn(`next-preflight: failed to parse ${p}: ${(err as Error).message}`);
    return undefined;
  }
}

/** Realpath `dir`, or `undefined` if it does not exist (or is unreadable). */
function realpathOrUndefined(dir: string): string | undefined {
  try {
    return realpathSync(dir);
  } catch {
    return undefined;
  }
}

/**
 * Every workspace-local package the site can reach, transitively.
 *
 * Only follows `link:`/`workspace:`/`file:` specs — those are the edges pnpm
 * satisfies with a symlink into the monorepo rather than a copy from the
 * registry, and therefore the edges whose transitive requirements the site's
 * own graph does not automatically carry.
 */
export function linkClosure(siteDir: string): Map<string, string> {
  const out = new Map<string, string>();
  const site = realpathSync(siteDir);
  const seed = readManifest(site);
  if (!seed) return out;

  const isLocal = (spec: string) =>
    spec.startsWith("link:") || spec.startsWith("workspace:") || spec.startsWith("file:");

  const queue: Array<[string, string]> = [];
  for (const [name, spec] of Object.entries({
    ...(seed.dependencies ?? {}),
    ...(seed.devDependencies ?? {}),
  })) {
    if (isLocal(spec)) queue.push([name, site]);
  }

  while (queue.length > 0) {
    const [name, fromDir] = queue.shift()!;
    if (out.has(name)) continue;
    const dir = resolveDirFrom(fromDir, name);
    if (!dir) continue;
    out.set(name, dir);
    const m = readManifest(dir);
    if (!m) continue;
    for (const [child, spec] of Object.entries(m.dependencies ?? {})) {
      if (isLocal(spec) && !out.has(child)) queue.push([child, dir]);
    }
  }
  return out;
}

/**
 * Assert the site declares everything its linked packages require.
 *
 * THE PREDICATE IS `resolvesFrom(SITE, dep)` — NOT `resolvesFrom(target, dep)`.
 *
 * Asking the link target is what the previous guard did, and it is true for
 * every real-world violation: pnpm's symlink farm puts the dependency inside
 * the target's own node_modules, so the target can always see it. Vercel's
 * `pnpm deploy --node-linker=hoisted` step copies only the SITE's graph, so
 * only the site's view predicts production. See the design spec, section 6.1.
 */
export function assertDeclaredDeps(siteDir: string): void {
  // A siteDir that doesn't exist at all (as opposed to one with a missing or
  // unreadable package.json, which readManifest already treats as a no-op)
  // must be a silent no-op too — realpathSync throws ENOENT on it, and this
  // is called with process.cwd() by consumers that shouldn't need to prove
  // the directory exists first.
  const site = realpathOrUndefined(siteDir);
  if (!site) return;
  const manifest = readManifest(site);
  if (!manifest) return;

  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ]);

  const missing: Array<{ owner: string; dep: string; kind: string }> = [];

  for (const [owner, dir] of linkClosure(site)) {
    const m = readManifest(dir);
    if (!m) continue;

    const required: Array<[string, string]> = [
      ...Object.keys(m.dependencies ?? {}).map((d) => [d, "dependency"] as [string, string]),
      ...Object.keys(m.peerDependencies ?? {})
        .filter((d) => !m.peerDependenciesMeta?.[d]?.optional)
        .map((d) => [d, "peerDependency"] as [string, string]),
    ];

    for (const [dep, kind] of required) {
      if (declared.has(dep)) continue;
      // A dependency pnpm installed into the site's own tree from the registry
      // is copied by the isolate step, so it is fine even if undeclared here.
      if (kind === "dependency" && resolvesFrom(site, dep)) continue;
      if (kind === "peerDependency" && resolvesFrom(site, dep)) continue;
      missing.push({ owner, dep, kind });
    }
  }

  if (missing.length === 0) return;

  const siteName = manifest.name ?? site;
  const lines = missing.map(
    ({ owner, dep, kind }) => `  ${owner}  requires ${kind}  ${dep}`,
  );
  throw new Error(
    [
      "",
      `Undeclared dependencies for site "${siteName}".`,
      "",
      ...lines,
      "",
      "These resolve locally through pnpm's symlink farm but will NOT exist in",
      "Vercel's hoisted tree, so this site builds here and fails there.",
      "",
      `Fix: add each package above to ${siteName}'s package.json "dependencies",`,
      "then run `pnpm install`.",
      "",
    ].join("\n"),
  );
}
