import { defineConfig } from 'vitest/config'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const VIRTUAL_ID = 'virtual:reference-site-content'
const RESOLVED_ID = '\0' + VIRTUAL_ID

const PACKAGES_DIR = resolve(__dirname, 'packages')
const OWN_CONFIG_FILES = ['vitest.config.ts', 'vitest.config.mts', 'vitest.config.js', 'vitest.config.mjs']

/**
 * Packages under packages/web/packages/* that own their own vitest.config.ts (any of the
 * extensions vitest will discover). Each such package's config carries aliases, an
 * environment, and setup files this ROOT config knows nothing about — derived by scanning
 * the filesystem so the set can't go stale as a package adds or drops its own config.
 */
export function packagesWithOwnConfig(packagesDir: string = PACKAGES_DIR): string[] {
  if (!existsSync(packagesDir)) return []
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => OWN_CONFIG_FILES.some((f) => existsSync(join(packagesDir, entry.name, f))))
    .map((entry) => entry.name)
    .sort()
}

function packageNameFor(packagesDir: string, dirName: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(packagesDir, dirName, 'package.json'), 'utf8')) as {
      name?: string
    }
    return pkg.name ?? dirName
  } catch {
    return dirName
  }
}

/**
 * Vitest loads exactly one config per run, chosen by where the process starts, never by
 * what `--dir` narrows it to scan. `pnpm vitest run --dir packages/<name>` run from this
 * workspace root therefore loads THIS file for every `<name>`, including one that owns its
 * own vitest.config.ts — `--dir` only picks which test files run under it, not which config
 * runs them. For `adh-ui` that meant no package-local aliases and `Cannot read properties of
 * null (reading 'useId')`: a wrong command whose output reads exactly like a product
 * regression, not a command mistake. Fail here instead, before any test runs, and name the
 * command that actually loads the right config.
 */
export function checkDirTarget(argv: string[], cwd: string, packagesDir: string = PACKAGES_DIR): void {
  const flagIndex = argv.findIndex((arg) => arg === '--dir' || arg.startsWith('--dir='))
  if (flagIndex === -1) return
  const flag = argv[flagIndex]
  const value = flag.startsWith('--dir=') ? flag.slice('--dir='.length) : argv[flagIndex + 1]
  if (!value) return

  const target = resolve(cwd, value)
  for (const dirName of packagesWithOwnConfig(packagesDir)) {
    const pkgRoot = join(packagesDir, dirName)
    if (target === pkgRoot || target.startsWith(pkgRoot + '/')) {
      const name = packageNameFor(packagesDir, dirName)
      throw new Error(
        `vitest.config.ts (workspace root): "--dir ${value}" targets "${dirName}", which owns its ` +
          `own vitest.config.ts. Loading this root config there skips that package's aliases, ` +
          `environment, and setup files, and its failures will read like a product regression ` +
          `rather than a wrong command. Run \`pnpm --filter ${name} run test\` instead.`,
      )
    }
  }
}

checkDirTarget(process.argv, process.cwd())

export default defineConfig({
  plugins: [
    {
      name: 'stub-reference-site-content',
      resolveId(id: string) {
        if (id === VIRTUAL_ID) return RESOLVED_ID
      },
      load(id: string) {
        if (id === RESOLVED_ID) return 'export default []'
      },
    },
  ],
  server: {
    fs: {
      allow: ['..'],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    dir: '../packages',
  },
})
