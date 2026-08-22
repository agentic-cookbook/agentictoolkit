/** The settings rail is ordered for a READER — alphabetically — which is a different
 *  question from where Settings opens. These cases hold those two apart, because the
 *  cheap way to write the default (`SETTINGS_TOPICS[0].id`) silently re-answers the
 *  second question every time someone renames a section. */
import { describe, it, expect } from 'vitest'

import {
  SETTINGS_TOPICS,
  DEFAULT_SETTINGS_TOPIC,
  resolveSettingsTopic,
} from '../topics'

describe('SETTINGS_TOPICS', () => {
  it('is ordered alphabetically by label, the way the rail reads', () => {
    const labels = SETTINGS_TOPICS.map((t) => t.label)
    // Case-insensitive, because the rail is scanned by eye and "API tokens" sits between
    // "Addresses" and "Appearance" to a reader, not before all three the way ASCII sorts.
    const sorted = [...labels].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    )
    expect(labels).toEqual(sorted)
  })

  it('gives every section a distinct id, since the id is what the URL carries', () => {
    const ids = SETTINGS_TOPICS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('includes Hub Preferences, where the site-menu chord is set', () => {
    expect(SETTINGS_TOPICS).toContainEqual({ id: 'preferences', label: 'Hub Preferences' })
  })

  it('labels and ids are all non-empty', () => {
    for (const topic of SETTINGS_TOPICS) {
      expect(topic.id, JSON.stringify(topic)).not.toBe('')
      expect(topic.label, JSON.stringify(topic)).not.toBe('')
    }
  })
})

describe('DEFAULT_SETTINGS_TOPIC', () => {
  it('is Appearance', () => {
    expect(DEFAULT_SETTINGS_TOPIC).toBe('appearance')
  })

  it('is NOT whatever sorts first — the two coincided until the rail was alphabetized', () => {
    // Before the rail was sorted, Appearance was first and the default could be read off
    // the array without anyone noticing the conflation. Alphabetizing moved Account to the
    // front, so this is the assertion that fails if the shortcut is ever reintroduced.
    expect(SETTINGS_TOPICS[0].id).toBe('account')
    expect(DEFAULT_SETTINGS_TOPIC).not.toBe(SETTINGS_TOPICS[0].id)
  })

  it('names a section that actually exists', () => {
    expect(SETTINGS_TOPICS.map((t) => t.id)).toContain(DEFAULT_SETTINGS_TOPIC)
  })
})

describe('resolveSettingsTopic', () => {
  it('passes a known topic through untouched', () => {
    for (const topic of SETTINGS_TOPICS) {
      expect(resolveSettingsTopic(topic.id)).toBe(topic.id)
    }
  })

  it('clamps anything it does not recognize to the default', () => {
    // '' and undefined are the two shapes a missing query param arrives as; the rest are
    // a stale bookmark, a renamed section, and a hand-typed URL.
    for (const bad of ['', undefined, 'notebook', 'Appearance', 'preferences ']) {
      expect(resolveSettingsTopic(bad), JSON.stringify(bad)).toBe(DEFAULT_SETTINGS_TOPIC)
    }
  })

  it('takes no argument at all, which is how the overlay opens cold', () => {
    expect(resolveSettingsTopic()).toBe(DEFAULT_SETTINGS_TOPIC)
  })
})
