import { beforeEach, describe, expect, it } from 'vitest'
import {
  defaultRisk,
  flattenBook,
  getBookState,
  lockBook,
  saveMode,
  saveRisk,
  saveUniverseFilters,
  setBookScenario,
  unlockBook,
} from './bookStore'

beforeEach(() => {
  saveUniverseFilters({ top_n: 75, min_price: 5, max_spread_bps: 12 })
  saveRisk(defaultRisk)
  saveMode('paper')
  setBookScenario('normal')
})

describe('book store', () => {
  it('clamps universe filters inside the architecture limits', () => {
    saveUniverseFilters({ top_n: 10, min_price: 1, max_spread_bps: 40 })
    expect(getBookState().universe).toEqual({
      top_n: 50,
      min_price: 5,
      max_spread_bps: 15,
    })
  })

  it('locks a normal book and allows unlock while the daily loss is inside the cap', () => {
    expect(lockBook().ok).toBe(true)
    expect(getBookState().summary.kill_switch.locked).toBe(true)
    flattenBook()
    expect(getBookState().summary.position_count).toBe(0)
    expect(unlockBook().ok).toBe(true)
    expect(getBookState().summary.kill_switch.locked).toBe(false)
  })

  it('refuses unlock while marked daily loss is at the lock', () => {
    setBookScenario('locked')
    const result = unlockBook()
    expect(result.ok).toBe(false)
    expect(getBookState().summary.kill_switch.locked).toBe(true)
  })
})
