import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { SITES } from '../sites/registry'
import { SITE_TOUR_NEXT } from '../sites/story'

/**
 * `story.ts` carries a generated region. The generator lives in another repo
 * (`adh-tools/landing`) and cannot run TypeScript; this package can, and owns
 * the file, so the question "does a spliced region still compile?" is answered
 * here — against the real file, with the real compiler, not a fixture.
 *
 * It is worth answering because the first version of this emitter could not
 * have compiled ONCE. It targeted `SITE_STORIES: Record<SiteId, SiteStory>`
 * and emitted `{ label, nextStep }` — two fields that record does not have and
 * three it requires — into a table of fifty hand-written rows it would have
 * replaced wholesale. Every test it had passed: they all read the emitted
 * string, and a string is not a program.
 *
 * So the assertions below run region bodies through `ts.createProgram` with
 * this package's own `tsconfig.json`, substituting the file's text in memory
 * and resolving every import off disk. The positive case is the committed
 * file; the negatives are the mistakes the generator is one edit away from
 * making, each asserted to produce a diagnostic rather than merely "not the
 * expected output".
 */
const HERE = dirname(fileURLToPath(import.meta.url))
const STORY = resolve(join(HERE, '..', 'sites', 'story.ts'))
const OPEN = '// <gen:tour> managed by landing — do not edit by hand'
const CLOSE = '// </gen:tour>'

/** The committed file with its `<gen:tour>` region replaced by `body`. */
function withRegion(body: string): string {
  const text = readFileSync(STORY, 'utf8')
  const open = text.indexOf(OPEN)
  const close = text.indexOf(CLOSE, open)
  expect(open, 'no <gen:tour> open marker in story.ts').toBeGreaterThan(-1)
  expect(close, 'no <gen:tour> close marker in story.ts').toBeGreaterThan(open)
  // Cut back to the start of the close marker's LINE so its indentation
  // survives the splice — the marker is indented inside an object literal.
  const closeLine = text.lastIndexOf('\n', close) + 1
  return text.slice(0, open + OPEN.length + 1) + body + text.slice(closeLine)
}

function compilerOptions(): ts.CompilerOptions {
  const configPath = join(HERE, '..', '..', 'tsconfig.json')
  const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile)
  if (error) throw new Error(ts.flattenDiagnosticMessageText(error.messageText, ' '))
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, dirname(configPath))
  return { ...parsed.options, noEmit: true }
}

const OPTIONS = compilerOptions()

/** Every syntactic and semantic diagnostic `text` produces as `story.ts`. */
function diagnose(text: string): string[] {
  const host = ts.createCompilerHost(OPTIONS, true)
  const readFromDisk = host.getSourceFile.bind(host)
  host.getSourceFile = (name, languageVersion, onError, shouldCreate) =>
    resolve(name) === STORY
      ? ts.createSourceFile(name, text, languageVersion, true, ts.ScriptKind.TS)
      : readFromDisk(name, languageVersion, onError, shouldCreate)

  const program = ts.createProgram([STORY], OPTIONS, host)
  const file = program.getSourceFile(STORY)
  expect(file, 'story.ts is not in the program').toBeDefined()
  return [
    ...program.getSyntacticDiagnostics(file),
    ...program.getSemanticDiagnostics(file),
  ].map((d) => `TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`)
}

describe('the generated <gen:tour> region', () => {
  it('leaves the committed story.ts type-checking clean', () => {
    expect(diagnose(readFileSync(STORY, 'utf8'))).toEqual([])
  })

  it('is a walk that is actually turned on', () => {
    // Vacuity guard for everything above and below: an empty region compiles
    // perfectly, and so would a `check` that regenerated nothing. At least
    // one real edge has to be in the committed file for "it compiles" to be
    // a statement about the emitter rather than about an empty object.
    expect(Object.keys(SITE_TOUR_NEXT).length).toBeGreaterThan(0)
  })

  it('names only registered sites, on both ends of every edge', () => {
    // The compiler already refuses an unregistered id (asserted below), so
    // this is the runtime half: the region is data other code will index
    // `SITES` with, and a `SiteId` that type-checks is not automatically a
    // site the registry still lists.
    const registered = new Set(SITES.map((s) => s.id))
    for (const [from, to] of Object.entries(SITE_TOUR_NEXT)) {
      expect(registered.has(from as never), `${from} (source)`).toBe(true)
      expect(registered.has(to as never), `${from} -> ${to} (target)`).toBe(true)
    }
  })

  it('never points a site at its own tour', () => {
    // What the tour strip shipped with, one layer down: a back/next control
    // that navigates to the page you are already on. The terminal site is
    // absent from this record rather than pointing at itself, which is what
    // `Partial<Record<...>>` exists to allow.
    for (const [from, to] of Object.entries(SITE_TOUR_NEXT)) {
      expect(to, `${from} points at itself`).not.toBe(from)
    }
  })

  it('refuses a key that is not a SiteId', () => {
    // The generator emits whatever `id:` the markdown declares. A typo in
    // frontmatter has to stop at the compiler, not become a dead edge.
    const errors = diagnose(withRegion("  nosuchsite: 'hub',\n"))
    expect(errors.join('\n')).toMatch(/nosuchsite/)
  })

  it('refuses a value that is not a SiteId', () => {
    const errors = diagnose(withRegion("  storage: 'nosuchsite',\n"))
    expect(errors.join('\n')).toMatch(/nosuchsite/)
  })

  it('refuses the same key twice', () => {
    // TS1117. The reason `SITE_STORIES` is not the splice target and never
    // will be: the moment a hand-written entry and a generated one name the
    // same site, the file stops compiling — and a region that is spliced by
    // a tool cannot see the hand-written half to avoid it. Two objects, one
    // owner each, is the arrangement that makes the collision impossible
    // rather than merely unlikely.
    const errors = diagnose(withRegion("  storage: 'hub',\n  storage: 'hub',\n"))
    expect(errors.join('\n')).toMatch(/TS1117/)
  })

  it('refuses a brand-story record in the tour graph', () => {
    // The shape the first emitter produced, verbatim. It never compiled and
    // nothing said so, because the only thing asserting on it was a string
    // comparison in another repo.
    const errors = diagnose(withRegion("  storage: { label: 'Storage', nextStep: 'hub' },\n"))
    expect(errors).not.toEqual([])
  })

  it('refuses a hand edit inside the region that TypeScript alone would allow', () => {
    // Not every wrong region is a type error — `storage: 'hub'` compiles and
    // is simply the wrong walk. That one is caught by `landing sites check`,
    // which regenerates the region and diffs it, not here. Stated so the
    // gap is a known division of labour rather than a hole: this file
    // answers "does it compile", `check` answers "is it what the content
    // says", and neither answers the other.
    expect(diagnose(withRegion("  storage: 'hub',\n"))).toEqual([])
  })
})
