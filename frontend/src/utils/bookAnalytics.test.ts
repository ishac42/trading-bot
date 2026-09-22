import { beforeEach, describe, expect, it } from 'vitest'
import { getBookState, setBookScenario } from '@/mocks/bookStore'
import { buildBookAnalytics } from './bookAnalytics'

const now = new Date('2026-09-22T16:00:00.000Z')

beforeEach(() => {
  setBookScenario('empty')
  setBookScenario('normal')
})

function analytics(timeRange: 'ALL' | '1W' = 'ALL') {
  const state = getBookState()
  return buildBookAnalytics(state.trades, {
    equity: state.summary.equity,
    bots: state.bots.map((bot) => ({ id: bot.id, name: bot.name })),
    timeRange,
    now,
  })
}

describe('book analytics', () => {
  it('measures expectancy, turnover, tail loss, and cost drag', () => {
    const result = analytics()
    expect(result.metrics.expectancy).toBe(18.1)
    expect(result.metrics.turnover).toBeCloseTo(5327 / 5000, 2)
    expect(result.metrics.cvar95).toBe(-6.2)
    expect(result.metrics.cost).toBe(0.21)
    expect(result.metrics.costToGrossAlphaPct).toBeCloseTo((0.21 / 36.41) * 100, 1)
    expect(result.byBot.map((row) => row.name).sort()).toEqual(['Liquid leaders', 'Tight spreads'])
    expect(result.byRegime.map((row) => row.name).sort()).toEqual(['range', 'transition', 'trend'])
    expect(result.symbolPerformance.map((row) => row.symbol).sort()).toEqual(['AAPL', 'AMD', 'MSFT', 'NVDA'])
  })

  it('drops trades outside the selected range', () => {
    const later = buildBookAnalytics(getBookState().trades, {
      equity: 5000,
      bots: [],
      timeRange: '1W',
      now: new Date('2026-10-15T16:00:00.000Z'),
    })
    expect(later.overview.totalTrades).toBe(0)
    expect(later.metrics.expectancy).toBe(0)
    expect(later.metrics.costToGrossAlphaPct).toBeNull()
  })
})
