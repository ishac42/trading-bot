import { beforeEach, describe, expect, it } from 'vitest'
import { getBookState, setBookScenario } from '@/mocks/bookStore'
import { tradesToCsv } from './csvExport'
import { filterBookTrades, summarizeBookTrades } from './bookTrades'
import type { TradeFilters } from '@/types'

const now = new Date('2026-09-22T16:00:00.000Z')
const all: TradeFilters = { dateRange: 'all', botId: '', symbol: '', type: 'all' }

beforeEach(() => {
  setBookScenario('empty')
  setBookScenario('normal')
})

describe('book trades', () => {
  it('keeps the bot profile and filters vetoes by bot', () => {
    const trades = getBookState().trades
    const tight = filterBookTrades(trades, { ...all, botId: 'bot-tight' }, now)
    expect(tight.map((trade) => trade.symbol)).toEqual(['AMD'])
    expect(tight[0]?.reason_code).toBe('NO_TRADE_STALE_DATA')
  })

  it('applies the date range and summarizes regime and session', () => {
    const trades = getBookState().trades
    expect(filterBookTrades(trades, { ...all, dateRange: 'today' }, now)).toHaveLength(0)
    const week = filterBookTrades(trades, { ...all, dateRange: 'week' }, now)
    expect(week).toHaveLength(3)

    const stats = summarizeBookTrades(week)
    expect(stats.pnlByBot).toEqual([])
    expect(stats.pnlByRegime?.map((row) => row.regime).sort()).toEqual(['transition', 'trend'])
    expect(stats.pnlBySession).toEqual([{ session: 'rth', trades: 3, pnl: 42.4 }])
    expect(stats.pnlBySymbol.map((row) => row.symbol)).toEqual(['NVDA'])
  })

  it('includes reason, shortfall, regime, and session in the CSV', () => {
    const csv = tradesToCsv(getBookState().trades, () => 'Liquid leaders')
    expect(csv).toContain('Reason')
    expect(csv).toContain('Shortfall')
    expect(csv).toContain('TARGET_HIT')
    expect(csv).toContain('NO_TRADE_STALE_DATA')
    expect(csv).toContain('transition')
  })
})
