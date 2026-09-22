import { describe, expect, it } from 'vitest'
import { tradesToCsv } from './csvExport'
import { filterBookTrades, summarizeBookTrades } from './bookTrades'
import { sampleTrades } from '@/test-fixtures/bookSample'
import type { TradeFilters } from '@/types'

const now = new Date('2026-09-22T16:00:00.000Z')
const all: TradeFilters = { dateRange: 'all', botId: '', symbol: '', type: 'all' }

describe('book trades', () => {
  it('keeps the bot profile and filters vetoes by bot', () => {
    const tight = filterBookTrades(sampleTrades, { ...all, botId: 'bot-tight' }, now)
    expect(tight.map((trade) => trade.symbol)).toEqual(['AMD'])
    expect(tight[0]?.reason_code).toBe('NO_TRADE_STALE_DATA')
  })

  it('applies the date range and summarizes regime and session', () => {
    expect(filterBookTrades(sampleTrades, { ...all, dateRange: 'today' }, now)).toHaveLength(0)
    const week = filterBookTrades(sampleTrades, { ...all, dateRange: 'week' }, now)
    expect(week).toHaveLength(4)

    const stats = summarizeBookTrades(week)
    expect(stats.pnlByBot).toEqual([])
    expect(stats.pnlByRegime?.map((row) => row.regime).sort()).toEqual(['range', 'transition', 'trend'])
    expect(stats.pnlBySession).toEqual([{ session: 'rth', trades: 4, pnl: 36.2 }])
    expect(stats.pnlBySymbol.map((row) => row.symbol)).toEqual(['NVDA', 'MSFT'])
  })

  it('includes reason, shortfall, regime, and session in the CSV', () => {
    const csv = tradesToCsv(sampleTrades, () => 'Liquid leaders')
    expect(csv).toContain('Reason')
    expect(csv).toContain('Shortfall')
    expect(csv).toContain('TARGET_HIT')
    expect(csv).toContain('NO_TRADE_STALE_DATA')
    expect(csv).toContain('transition')
  })
})
