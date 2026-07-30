import { describe, it, expect } from 'vitest'
import { SITES } from '../sites/registry'
import { SITE_STORIES, type FunnelStage } from '../sites/story'

// Governance for the brand-story layer (docs/planning/brand-story-plan.md §7):
// the compiler already forces a story per SiteId; these pin the semantic
// invariants a type can't express.

describe('SITE_STORIES', () => {
  it('covers every registered site (and nothing else)', () => {
    const registered = SITES.map((s) => s.id).sort()
    expect(Object.keys(SITE_STORIES).sort()).toEqual(registered)
  })

  it('has exactly one masterbrand, and it is the hub', () => {
    const masterbrands = Object.entries(SITE_STORIES)
      .filter(([, s]) => s.tier === 'masterbrand')
      .map(([id]) => id)
    expect(masterbrands).toEqual(['hub'])
  })

  it('pins the proof layer to the ratified own-named products', () => {
    // The From/Of rule is a judgment, not derivable from hosts — adding a
    // proof-tier site is a deliberate brand decision, so it must land here too.
    const proofs = Object.entries(SITE_STORIES)
      .filter(([, s]) => s.tier === 'proof')
      .map(([id]) => id)
      .sort()
    expect(proofs).toEqual(['bitbag', 'learntruefacts', 'myagenticteams'])
  })

  it('pins the endorsed satellites', () => {
    const satellites = Object.entries(SITE_STORIES)
      .filter(([, s]) => s.tier === 'satellite')
      .map(([id]) => id)
      .sort()
    expect(satellites).toEqual([
      'cookbook',
      'fishlamp',
      'fishlampdesign',
      'personaregistry',
      'toolkit',
    ])
  })

  it('never points a next step at the site itself', () => {
    for (const [id, s] of Object.entries(SITE_STORIES)) {
      expect(s.nextStep, `${id} nextStep`).not.toBe(id)
    }
  })

  it('every next-step chain converges on the hub', () => {
    const ids = Object.keys(SITE_STORIES) as (keyof typeof SITE_STORIES)[]
    for (const start of ids) {
      if (start === 'hub') continue
      let cursor: keyof typeof SITE_STORIES = start
      let reachedHub = false
      for (let hop = 0; hop < ids.length; hop++) {
        cursor = SITE_STORIES[cursor].nextStep
        if (cursor === 'hub') {
          reachedHub = true
          break
        }
      }
      expect(reachedHub, `${start} never reaches the hub`).toBe(true)
    }
  })

  it('leaves no funnel stage empty', () => {
    const stages: FunnelStage[] = ['discover', 'learn', 'build', 'ship', 'adopt']
    const present = new Set(Object.values(SITE_STORIES).map((s) => s.funnelStage))
    for (const stage of stages) expect(present.has(stage), `stage ${stage}`).toBe(true)
  })
})
