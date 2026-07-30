/**
 * The theme editor's Save gate — `canSave` shape + save re-entrancy.
 *
 * `canSave` on this branch means exactly "the draft diverges from what was loaded AND the
 * required fields are filled". The busy/saving term belongs at the BUTTON
 * (`SiteThemeBranch.tsx` renders `disabled={!ed.canSave || ed.saving}`), not folded into the
 * predicate — otherwise the two are the same rule expressed twice, and the duplicate stands in
 * for a re-entrancy guard the handler does not actually have.
 *
 * That is the trap these tests pin. `saving` is a RENDER value: two activations inside a single
 * commit (a fast double-click before React paints the disabled button) both read the pre-save
 * `false` and both POST. Only a ref that flips synchronously on the way in stops the second.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../themes/themes-client', () => ({
  listThemes: vi.fn(),
  createTheme: vi.fn(),
  updateTheme: vi.fn(),
  deleteTheme: vi.fn(),
}))

import { useThemeEditor } from '../themes/useThemeEditor'
import { listThemes, createTheme } from '../themes/themes-client'

const list = vi.mocked(listThemes)
const create = vi.mocked(createTheme)

beforeEach(() => {
  vi.clearAllMocks()
  list.mockResolvedValue([])
})

afterEach(() => {
  document.cookie = 'adh-theme=; Max-Age=0; path=/'
  localStorage.clear()
})

/** A loaded editor holding a NEW, savable draft (a fresh theme with a valid key + label). */
async function newDraftEditor() {
  const { result } = renderHook(() => useThemeEditor())
  await waitFor(() => expect(result.current.loading).toBe(false))
  act(() => result.current.newTheme())
  expect(result.current.canSave).toBe(true)
  return result
}

describe('useThemeEditor — canSave carries no busy term', () => {
  it('stays TRUE while a save is in flight — busy is the button’s job, not the gate’s', async () => {
    // Never settles: the hook sits in `saving` for the rest of the test.
    create.mockReturnValue(new Promise(() => {}) as ReturnType<typeof createTheme>)
    const result = await newDraftEditor()

    act(() => {
      void result.current.save()
    })

    await waitFor(() => expect(result.current.saving).toBe(true))
    // The draft still diverges and is still valid, so the GATE is still open; the button is what
    // greys out (`!canSave || saving`). Folding `!saving` in here would flip this to false and
    // express the busy rule twice.
    expect(result.current.canSave).toBe(true)
  })
})

describe('useThemeEditor — save is re-entrancy-latched', () => {
  it('ignores a second save that lands before the disabled state can render', async () => {
    create.mockReturnValue(new Promise(() => {}) as ReturnType<typeof createTheme>)
    const result = await newDraftEditor()

    // Two activations inside ONE commit — a double-click on the footer's Save before React has
    // painted `disabled`. Both closures read the pre-save `saving === false`.
    await act(async () => {
      void result.current.save()
      void result.current.save()
    })

    expect(create).toHaveBeenCalledTimes(1)
  })

  it('releases the latch once the save settles, so the next save still fires', async () => {
    create.mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof createTheme>>)
    const result = await newDraftEditor()

    await act(async () => {
      await result.current.save()
    })
    expect(create).toHaveBeenCalledTimes(1)

    act(() => result.current.newTheme())
    await act(async () => {
      await result.current.save()
    })
    expect(create).toHaveBeenCalledTimes(2)
  })
})
