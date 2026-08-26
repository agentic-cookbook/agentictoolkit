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
//
// There are TWO throws, because there are two ways to miss. The config-load one
// above covers a package NAME that does not resolve from the consumer at all.
// The per-import one in `customResolver` covers a name that resolves while a
// particular SUBPATH does not — a version skew the first check cannot see. Both
// exist for the same reason: the only alternative answer is null, and null here
// means "resolve it from the toolkit's store instead", silently.

interface PluginContextLike {
  resolve(
    source: string,
    importer: string,
    options: { skipSelf: boolean },
  ): Promise<{ id: string } | null>
}

/**
 * The resolver a pinned entry carries. Async, and it REJECTS rather than
 * returning null — see `customResolver` below for why null is the one answer
 * this file cannot afford to give.
 */
type PinnedResolver = (this: unknown, source: string) => Promise<{ id: string }>

/** One vitest `resolve.alias` array entry, plus the package name it pins. */
export interface AliasEntry {
  /** The bare package name this entry pins. Not read by vitest; read by the
   *  coverage tests that assert the derived set is complete. */
  name: string
  find: RegExp
  replacement: string
  customResolver: PinnedResolver
}

function escapeForRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Inline the linked toolkit so its modules go through vite's resolver at all. */
export const adtInline = [/[\\/]agenticdevelopertoolkit[\\/]/]

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
}

/**
 * The `@agenticdevelopertoolkit/*` packages `packageDir` links via `link:`/`file:`,
 * each with the path to its own `package.json`. Shared by `adtAlias` below and by
 * every coverage test that needs to walk the same linked set — one place that
 * knows how a link is discovered, so it can't drift between callers.
 */
export function linkedAdtPackages(packageDir: string): { name: string; manifestPath: string }[] {
  const manifest = readJson(join(packageDir, 'package.json'))
  const found: { name: string; manifestPath: string }[] = []
  const seen = new Set<string>()
  // Each field in turn, first `link:`/`file:` spec wins — NOT a single merged
  // object. One name legitimately appears in two fields: `bitbag` and `registry`
  // declare their toolkit packages as PEERS at `"*"` (the consumer supplies the
  // copy, so a bundle holds one instance) and repeat them as devDependencies at
  // `link:` so they can still build and test themselves. Merging with
  // peerDependencies last let `"*"` overwrite the link and those two packages
  // read as linking nothing at all — `adtAlias` then pinned react/react-dom and
  // nothing else for exactly the two packages that cross into the toolkit most.
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
    const declared = (manifest[field] as Record<string, string>) ?? {}
    for (const [name, spec] of Object.entries(declared)) {
      if (seen.has(name)) continue
      if (!name.startsWith('@agenticdevelopertoolkit/')) continue
      if (typeof spec !== 'string') continue
      if (!spec.startsWith('link:') && !spec.startsWith('file:')) continue
      const manifestPath = join(packageDir, spec.replace(/^(link|file):/, ''), 'package.json')
      if (!existsSync(manifestPath)) continue
      seen.add(name)
      found.push({ name, manifestPath })
    }
  }
  return found
}

/**
 * Alias every dependency of the `@agenticdevelopertoolkit/*` packages this
 * package links, plus react/react-dom, to THIS package's own copy.
 *
 * Returns vitest's ARRAY alias form, one entry per pinned package, each matching
 * the bare name AND its subpaths and re-resolving the whole specifier from this
 * package. Mapping a name straight onto a directory — the obvious shape, and the
 * one this returned at first — cannot express that: an alias string matches by
 * prefix, so `@shikijs/rehype/core` was rewritten to `<dir>/core`, a path with no
 * extension that resolves to nothing, because the subpath the package's `exports`
 * publishes is `./dist/core.mjs`. Re-resolving instead of rewriting means the
 * package's own `exports` map decides, exactly as it would for an unaliased
 * import; the only thing being overridden is WHERE resolution starts.
 *
 * @param packageDir absolute path to the consuming package (pass
 *   `fileURLToPath(new URL('.', import.meta.url))` from its vitest.config.ts).
 */
export function adtAlias(packageDir: string): AliasEntry[] {
  // react/react-dom are peers of every toolkit package; pin them whether or not
  // a linked manifest happens to name them.
  const wanted = new Set(['react', 'react-dom'])

  const require = createRequire(join(packageDir, 'package.json'))
  // A file path inside the consumer, used only as the "importer" every pinned
  // specifier is resolved from. It does not need to exist — only its directory is
  // read, to root the node-resolution walk here instead of at the toolkit's
  // REAL path.
  const pinnedTo = join(packageDir, '__adt-pin__.js')
  // `packageDir` arrives from `fileURLToPath(new URL('.', …))` with a trailing
  // separator; only the error messages below care, and there it reads as a typo.
  const consumerDir = join(packageDir, '.')
  for (const { manifestPath } of linkedAdtPackages(packageDir)) {
    const linked = readJson(manifestPath)
    for (const dep of Object.keys((linked.dependencies as Record<string, string>) ?? {})) {
      // A toolkit package depending on ANOTHER toolkit package (markdown on ui,
      // search on markdown) is not a second copy and there is nothing to pin: both
      // sides already resolve to the same directory inside that one workspace,
      // whichever end the import starts from. Pinning it anyway would re-root those
      // imports at the CONSUMER, which is a different question with a different
      // answer, and the failure would name the consumer's own source file.
      if (dep.startsWith('@agenticdevelopertoolkit/')) continue
      wanted.add(dep)
    }
  }

  const alias: AliasEntry[] = []
  for (const name of wanted) {
    // Resolve through the consumer, so the alias points at the copy this package
    // would have got anyway. The check is a precondition, not the mechanism —
    // resolution itself happens per import in `pinnedTo` below.
    const resolvable =
      existsSync(join(packageDir, 'node_modules', name)) ||
      (() => {
        try {
          dirname(require.resolve(`${name}/package.json`))
          return true
        } catch {
          return false
        }
      })()
    if (resolvable) {
      alias.push({
        name,
        find: new RegExp(`^${escapeForRegExp(name)}(/.*)?$`),
        // Identity: the customResolver below re-resolves the untouched specifier.
        replacement: '$&',
        async customResolver(source: string) {
          // `this` is rollup's plugin context; `pinnedTo` is a path inside the
          // consumer, so a bare specifier resolves from the consumer's tree.
          // `skipSelf` keeps the alias plugin from matching its own output.
          const resolved = await (this as PluginContextLike).resolve(source, pinnedTo, {
            skipSelf: true,
          })
          // A miss MUST throw, not return null. Vite's alias plugin passes a null
          // straight back, and resolution then falls through to `vite:resolve`,
          // which resolves from the IMPORTER — a file under the toolkit's REAL
          // path, i.e. out of the toolkit's own node_modules. That is the second
          // copy this whole file exists to prevent, arrived at silently.
          //
          // The precondition at config load does NOT cover this. It proves the
          // package NAME resolves from the consumer; it says nothing about a
          // particular SUBPATH, or about whether the consumer's version is new
          // enough to publish the subpath the toolkit asks for. A consumer on
          // 2.0.x of a dependency the toolkit wants at ^2.1 passes that check and
          // misses here, on exactly one import.
          if (resolved == null) {
            throw new Error(
              `adtAlias: "${source}" is pinned to ${consumerDir}'s own copy of ` +
                `"${name}", but that copy cannot satisfy it — the specifier ` +
                `resolves to nothing from there. The package name itself does ` +
                `resolve (that is checked at config load), so this is a missing ` +
                `subpath or a version too old to publish it: reconcile the ` +
                `version in ${join(consumerDir, 'package.json')} with the one the ` +
                `linked @agenticdevelopertoolkit/* package requires and run ` +
                `pnpm install. Returning null here instead would resolve it out ` +
                `of the toolkit's own node_modules — a second copy, silently.`,
            )
          }
          return resolved
        },
      })
      continue
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
