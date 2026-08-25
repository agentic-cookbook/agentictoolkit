import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

// One dependency tree in the test process, when a test renders
// @agenticdevelopertoolkit/* source.
//
// That toolkit is a SEPARATE pnpm workspace, reached by `link:` into this repo's
// own submodule, and it is deliberately NOT installed: it has no node_modules of
// its own. Vite resolves a symlinked file by its REAL path, so a bare `react` or
// `clsx` inside its source is looked up from a directory with nothing under it —
// the import fails, naming the specifier rather than the workspace boundary that
// caused it. Installing that workspace is the obvious-looking fix and is worse:
// it resolves, out of a SECOND store, and the test process ends up with two
// Reacts. The failure then reads `Cannot read properties of null (reading
// 'useId')` from inside React, which points nowhere near the cause.
//
// So the consumer supplies the tree, exactly as it does in production: Next.js
// pins react for every module it compiles, which is why the app works and only
// the test runner ever saw this. `alias`, not `resolve.dedupe` — dedupe does not
// reach files rooted outside the project, and the toolkit lives several
// directories up and across. Aliases DO reach them, because those files are
// inlined (see `adtInline`) and therefore travel through vite's resolver.
//
// The list is DERIVED from the linked packages' own manifests rather than
// written out, so it cannot drift when that toolkit adds a dependency. A
// dependency the consumer has not declared is left unaliased on purpose: the
// resulting "Failed to resolve import" names the missing package, which is the
// honest fix (declare it) rather than a silent second copy.

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
    // would have got anyway. Skip what the consumer has not declared — see above.
    const local = join(packageDir, 'node_modules', name)
    if (existsSync(local)) {
      alias[name] = local
      continue
    }
    try {
      alias[name] = dirname(require.resolve(`${name}/package.json`))
    } catch {
      // Undeclared. Leave it out; the resolve error names it.
    }
  }
  return alias
}
