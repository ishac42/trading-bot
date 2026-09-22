import { beforeEach, describe, expect, it } from 'vitest'
import {
  createBotProfile,
  defaultBotRisk,
  defaultRisk,
  flattenBook,
  getBookState,
  lockBook,
  saveMode,
  saveRisk,
  saveUniverseFilters,
  setBookScenario,
  closeBookPosition,
  startBotProfile,
  unlockBook,
} from './bookStore'

beforeEach(() => {
  saveUniverseFilters({ top_n: 75, min_price: 5, max_spread_bps: 12 })
  saveRisk(defaultRisk)
  saveMode('paper')
  setBookScenario('empty')
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

  it('clamps a bot risk sleeve to the book ceiling and refuses start while halted', () => {
    const created = createBotProfile({
      name: 'Wide sleeve',
      universe: { top_n: 75, min_price: 5, max_spread_bps: 12 },
      risk: { ...defaultBotRisk, risk_per_trade_pct: 5, sleeve_loss_limit_pct: -10 },
    })
    expect(created.ok).toBe(true)
    const createdBot = getBookState().bots.find((bot) => bot.name === 'Wide sleeve')
    expect(createdBot?.risk.risk_per_trade_pct).toBe(0.25)
    expect(createdBot?.risk.sleeve_loss_limit_pct).toBe(-2)
    setBookScenario('locked')
    expect(startBotProfile(createdBot!.id).ok).toBe(false)
  })

  it('closes a book position without stopping its bot', () => {
    const before = getBookState().positions[0]
    const riskBefore = getBookState().summary.open_stop_risk
    expect(before).toBeDefined()
    const result = closeBookPosition(before.id)
    expect(result.ok).toBe(true)
    expect(getBookState().positions.some((position) => position.id === before.id)).toBe(false)
    expect(getBookState().summary.open_stop_risk).toBeLessThan(riskBefore)
    expect(getBookState().summary.position_count).toBe(1)
    expect(getBookState().bots.find((bot) => bot.id === before.bot_id)?.status).toBe('running')
  })

  it('refuses unlock while marked daily loss is at the lock', () => {
    setBookScenario('locked')
    const result = unlockBook()
    expect(result.ok).toBe(false)
    expect(getBookState().summary.kill_switch.locked).toBe(true)
  })
})
