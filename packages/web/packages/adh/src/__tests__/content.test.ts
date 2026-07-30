import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// The authoritative structure/content validator is the pure-stdlib Python script
// (so it also runs in prebuild/CI/Vercel without the JS toolchain). The test run
// exercises that same single implementation against the committed JSON.
const here = dirname(fileURLToPath(import.meta.url))
const script = resolve(here, '../../../../tools/validate-content.py')

describe('content/structure JSON source', () => {
  it('passes validate-content.py', () => {
    const out = execFileSync('python3', [script], { encoding: 'utf8' })
    expect(out).toMatch(/content validation OK/)
  })
})
