import { beforeEach, describe, expect, it } from 'vitest'
import {
  createBotProfile,
  defaultBotRisk,
  defaultRisk,
  flattenBook,
  getBookState,
  lockBook,
  replaceBookSlice,
  resetBook,
  saveMode,
  saveRisk,
  saveUniverseFilters,
  setBookScenario,
  applyBookSocketEvent,
  closeBookPosition,
  startBotProfile,
  unlockBook,
} from './bookStore'
import { sampleBots, samplePositions } from '@/test-fixtures/bookSample'

beforeEach(() => {
  resetBook()
  saveUniverseFilters({ top_n: 75, min_price: 5, max_spread_bps: 12 })
  saveRisk(defaultRisk)
  saveMode('paper')
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

  it('applies a risk lock and refreshes universe membership', () => {
    expect(getBookState().snapshot.members).toHaveLength(0)
    applyBookSocketEvent('risk_event', {
      throttle_stage: 'locked',
      marked_daily_pnl: -105,
      marked_daily_pnl_pct: -2.1,
      locked: true,
      halted: true,
    })
    expect(getBookState().summary.throttle_stage).toBe('locked')
    expect(getBookState().summary.kill_switch.locked).toBe(true)
    expect(getBookState().positions).toHaveLength(0)

    resetBook()
    applyBookSocketEvent('universe_updated', {
      as_of: '2026-09-22T15:05:00.000Z',
      members: [
        { symbol: 'NVDA', price: 121.4, dollar_volume: 21_000_000_000, spread_bps: 1.8 },
        { symbol: 'AAPL', price: 229.1, dollar_volume: 9_100_000_000, spread_bps: 1.1 },
      ],
    })
    expect(getBookState().snapshot.members.map((member) => member.symbol)).toEqual(['NVDA', 'AAPL'])
  })

  it('closes a book position without stopping its bot', () => {
    replaceBookSlice({
      bots: sampleBots.filter((bot) => bot.id === 'bot-liquid'),
      positions: samplePositions,
      summary: { ...getBookState().summary, equity: 5000 },
    })
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
