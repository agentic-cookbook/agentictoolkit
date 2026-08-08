import { describe, expect, it } from 'vitest'
import {
  BAG_KEY_REQUIRED_MESSAGE,
  INVALID_JSON_MESSAGE,
  bagFormBlockedReason,
  duplicateBagKeyMessage,
  isBagFormDirty,
  type BagFormContext,
  type BagFormState,
} from './index'

const INITIAL: BagFormState = { key: '', valueText: '', description: '' }
const CREATE_CTX: BagFormContext = { editingMode: false, existingKeys: ['existing_key'] }
const EDIT_CTX: BagFormContext = { editingMode: true, existingKeys: [] }

/** The dialog's gate, spelled out here the way both components spell it. */
const canSave = (form: BagFormState, initial: BagFormState, ctx: BagFormContext) =>
  isBagFormDirty(form, initial) && bagFormBlockedReason(form, ctx) === null

describe('the bag-dialog Save gate (create mode) — disabled at mount, enabled after a real, valid edit', () => {
  it('is false at the pristine starting point', () => {
    expect(canSave(INITIAL, INITIAL, CREATE_CTX)).toBe(false)
  })

  it('is false once dirty but with invalid (unparseable) JSON in the value field', () => {
    const form = { ...INITIAL, key: 'new_bag', valueText: '{not json' }
    expect(isBagFormDirty(form, INITIAL)).toBe(true)
    expect(bagFormBlockedReason(form, CREATE_CTX)).toBe(INVALID_JSON_MESSAGE)
    expect(canSave(form, INITIAL, CREATE_CTX)).toBe(false)
  })

  it('is true once dirty with a valid key and valid JSON', () => {
    const form = { ...INITIAL, key: 'new_bag', valueText: '42' }
    expect(bagFormBlockedReason(form, CREATE_CTX)).toBeNull()
    expect(canSave(form, INITIAL, CREATE_CTX)).toBe(true)
  })

  it('is false when the key is blank or whitespace-only, even with valid JSON', () => {
    expect(bagFormBlockedReason({ ...INITIAL, valueText: '42' }, CREATE_CTX)).toBe(
      BAG_KEY_REQUIRED_MESSAGE,
    )
    expect(canSave({ ...INITIAL, valueText: '42' }, INITIAL, CREATE_CTX)).toBe(false)
    expect(bagFormBlockedReason({ ...INITIAL, key: '   ', valueText: '42' }, CREATE_CTX)).toBe(
      BAG_KEY_REQUIRED_MESSAGE,
    )
    expect(canSave({ ...INITIAL, key: '   ', valueText: '42' }, INITIAL, CREATE_CTX)).toBe(false)
  })

  it('is false when the key collides with an existing bag, and names the key', () => {
    const form = { ...INITIAL, key: 'existing_key', valueText: '42' }
    expect(bagFormBlockedReason(form, CREATE_CTX)).toBe(duplicateBagKeyMessage('existing_key'))
    expect(canSave(form, INITIAL, CREATE_CTX)).toBe(false)
  })

  // Reason ORDER matters: it is the sentence a click would have produced, and handleSubmit
  // parses the JSON before it ever looks at the key.
  it('reports the JSON problem first when both the value and the key are bad', () => {
    const form = { ...INITIAL, key: 'existing_key', valueText: '{not json' }
    expect(bagFormBlockedReason(form, CREATE_CTX)).toBe(INVALID_JSON_MESSAGE)
  })
})

describe('the bag-dialog Save gate (edit mode) — key collision/blank checks don’t apply', () => {
  const initial: BagFormState = { key: 'onboarding_config', valueText: 'true', description: '' }

  it('is false at mount (loaded, unedited)', () => {
    expect(canSave(initial, initial, EDIT_CTX)).toBe(false)
  })

  it('is true once the value is edited to different, still-valid JSON', () => {
    const form = { ...initial, valueText: 'false' }
    expect(canSave(form, initial, EDIT_CTX)).toBe(true)
  })

  it('is false once edited to invalid JSON, and says so', () => {
    const form = { ...initial, valueText: '{bad' }
    expect(bagFormBlockedReason(form, EDIT_CTX)).toBe(INVALID_JSON_MESSAGE)
    expect(canSave(form, initial, EDIT_CTX)).toBe(false)
  })

  it('a blank key doesn’t block edit mode (key field is disabled there anyway)', () => {
    const form = { ...initial, key: '', valueText: 'false' }
    expect(bagFormBlockedReason(form, EDIT_CTX)).toBeNull()
    expect(canSave(form, initial, EDIT_CTX)).toBe(true)
  })

  /**
   * An edit opens QUIET only when the loaded bag round-trips — the JSON parse runs before the
   * `editingMode` branch on purpose, so edit surfaces are not exempt from it. A bag whose `value`
   * is absent (the field is typed `unknown`) makes both dialogs' seed,
   * `JSON.stringify(bag.value, null, 2)`, evaluate to the non-string `undefined`, which
   * `JSON.parse` rejects. The dialog then speaks on its FIRST frame with nothing touched.
   *
   * Deliberate, not incidental: Save genuinely IS blocked — handleSubmit re-parses the same text
   * and throws the same sentence — so the old `&& dirty` term was hiding a real dead button.
   */
  it('an untouched EDIT on a bag with no value says why, because the parse runs first', () => {
    // Exactly what the dialogs compute for `bag.value === undefined`.
    const valueText = JSON.stringify(undefined, null, 2) as unknown as string
    expect(valueText).toBeUndefined()

    const loaded: BagFormState = { key: 'orphan_bag', valueText, description: 'no value' }
    expect(isBagFormDirty(loaded, loaded)).toBe(false) // nothing touched
    expect(bagFormBlockedReason(loaded, EDIT_CTX)).toBe(INVALID_JSON_MESSAGE)
    expect(canSave(loaded, loaded, EDIT_CTX)).toBe(false)
  })

  it('typing valid JSON over the missing value unblocks that edit', () => {
    const loaded: BagFormState = {
      key: 'orphan_bag',
      valueText: JSON.stringify(undefined, null, 2) as unknown as string,
      description: 'no value',
    }
    const form = { ...loaded, valueText: '{"a": 1}' }
    expect(bagFormBlockedReason(form, EDIT_CTX)).toBeNull()
    expect(canSave(form, loaded, EDIT_CTX)).toBe(true)
  })
})

/**
 * The submit path sends `key.trim()` and `description.trim()`, so whitespace-only differences
 * would produce a byte-identical write — the no-op save this gate exists to prevent.
 */
describe('the bag-dialog dirty check is trim-consistent with what submit sends', () => {
  const initial: BagFormState = {
    key: 'onboarding_config',
    valueText: 'true',
    description: 'Onboarding',
  }

  it('a trailing space in the description is not a change', () => {
    expect(isBagFormDirty({ ...initial, description: 'Onboarding  ' }, initial)).toBe(false)
  })

  it('a trailing space around the key is not a change', () => {
    expect(isBagFormDirty({ ...initial, key: '  onboarding_config ' }, initial)).toBe(false)
  })

  it('but real description text still is', () => {
    expect(isBagFormDirty({ ...initial, description: 'Onboarding v2' }, initial)).toBe(true)
  })

  // The JSON box is compared as TEXT on purpose: `dirty` also drives the unsaved-work guard, and
  // silently discarding a reformat the user typed is worse than an occasional no-op PUT.
  it('re-indenting the JSON value counts as a change', () => {
    expect(isBagFormDirty({ ...initial, valueText: ' true' }, initial)).toBe(true)
  })
})
