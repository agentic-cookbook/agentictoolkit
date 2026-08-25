import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

// One dependency tree in the test process, when a test renders
// @agenticdevelopertoolkit/* source.
//
// That toolkit is a SEPARATE pnpm workspace, reached by `link:` into this repo's
// own submodule. `install.sh` installs that workspace too (so its own build can
// run), which means it now HAS a node_modules of its own — and that is exactly
// the trap. Vite resolves a symlinked file by its REAL path, so a bare `react` or
// `clsx` inside its source is looked up from THAT directory, not this package's.
// If the two stores hold different copies, the import still resolves — silently,
// out of the second store — and the test process ends up with two Reacts. The
// failure then reads `Cannot read properties of null (reading 'useId')` from
// inside React, which points nowhere near the cause. Nothing about a bare
// specifier failing to resolve can be relied on to catch this anymore.
//
// So the consumer supplies the tree, exactly as it does in production: Next.js
// pins react for every module it compiles, which is why the app works and only
// the test runner ever saw this. `alias`, not `resolve.dedupe` — dedupe does not
// reach files rooted outside the project, and the toolkit lives several
// directories up and across. Aliases DO reach them, because those files are
// inlined (see `adtInline`) and therefore travel through vite's resolver.
//
// The list is DERIVED from the linked packages' own manifests rather than
// written out, so it cannot drift when that toolkit adds a dependency. And
// because a second, real store now exists to resolve from, `adtAlias` THROWS at
// config load when it cannot resolve a wanted dependency from the consumer,
// instead of leaving it unaliased — an omitted key used to surface as an honest
// "Failed to resolve import" naming the missing package, but now it would just
// as quietly resolve out of the toolkit's own node_modules and reintroduce the
// two-copies failure this file exists to prevent.

/** Inline the linked toolkit so its modules go through vite's resolver at all. */
export const adtInline = [/[\\/]agenticdevelopertoolkit[\\/]/]

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
}

/**
 * Alias every dependency of the `@agenticdevelopertoolkit/*` packages this
 * package links, plus react/react-dom, to THIS package's own copy.
 *
 * @param packageDir absolute path to the consuming package (pass
 *   `fileURLToPath(new URL('.', import.meta.url))` from its vitest.config.ts).
 */
export function adtAlias(packageDir: string): Record<string, string> {
  const manifest = readJson(join(packageDir, 'package.json'))
  const declared = {
    ...((manifest.dependencies as Record<string, string>) ?? {}),
    ...((manifest.devDependencies as Record<string, string>) ?? {}),
    ...((manifest.peerDependencies as Record<string, string>) ?? {}),
  }

  // react/react-dom are peers of every toolkit package; pin them whether or not
  // a linked manifest happens to name them.
  const wanted = new Set(['react', 'react-dom'])

  const require = createRequire(join(packageDir, 'package.json'))
  for (const [name, spec] of Object.entries(declared)) {
    if (!name.startsWith('@agenticdevelopertoolkit/')) continue
    if (!spec.startsWith('link:') && !spec.startsWith('file:')) continue
    const target = join(packageDir, spec.replace(/^(link|file):/, ''), 'package.json')
    if (!existsSync(target)) continue
    const linked = readJson(target)
    for (const dep of Object.keys((linked.dependencies as Record<string, string>) ?? {})) {
      wanted.add(dep)
    }
  }

  const alias: Record<string, string> = {}
  for (const name of wanted) {
    // Resolve through the consumer, so the alias points at the copy this package
    // would have got anyway.
    const local = join(packageDir, 'node_modules', name)
    if (existsSync(local)) {
      alias[name] = local
      continue
    }
    try {
      alias[name] = dirname(require.resolve(`${name}/package.json`))
      continue
    } catch {
      // falls through to the throw below
    }
    // Not resolvable from the consumer. Leaving this unaliased used to be safe —
    // the linked toolkit had no node_modules of its own, so the bare specifier
    // simply failed to resolve, naming the package. It now does have one (see
    // the header comment), so an omitted alias resolves silently out of THAT
    // store instead: a second copy, not an error. Fail loud, here, before any
    // test runs.
    throw new Error(
      `adtAlias: "${name}" is required by a linked @agenticdevelopertoolkit/* ` +
        `package but is not resolvable from ${packageDir}. Add it to that ` +
        `package's own package.json (dependencies/devDependencies) and run ` +
        `pnpm install, so this alias can pin it to the consumer's copy instead ` +
        `of letting it resolve out of the toolkit's own node_modules.`,
    )
  }
  return alias
}
