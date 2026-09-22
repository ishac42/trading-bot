import type {
  AnalyticsOverview,
  AnalyticsPnLDataPoint,
  AnalyticsTimeRange,
  SymbolPerformanceData,
  Trade,
} from '@/types'

export interface BookAnalyticsMetrics {
  expectancy: number
  turnover: number
  cvar95: number
  cost: number
  grossAlpha: number
  /** Cost divided by gross alpha, as a percent. Null when gross alpha is not positive. */
  costToGrossAlphaPct: number | null
}

export interface BookSplitRow {
  name: string
  trades: number
  pnl: number
  expectancy: number
}

export interface BookAnalytics {
  overview: AnalyticsOverview
  pnlTimeSeries: AnalyticsPnLDataPoint[]
  symbolPerformance: SymbolPerformanceData[]
  metrics: BookAnalyticsMetrics
  byRegime: BookSplitRow[]
  bySession: BookSplitRow[]
  byBot: BookSplitRow[]
}

interface AnalyticsInput {
  equity: number
  bots: { id: string; name: string }[]
  timeRange: AnalyticsTimeRange
  now?: Date
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function rangeStart(timeRange: AnalyticsTimeRange, now: Date): Date | null {
  if (timeRange === 'ALL') return null
  const start = new Date(now)
  if (timeRange === '1W') start.setDate(now.getDate() - 7)
  if (timeRange === '1M') start.setMonth(now.getMonth() - 1)
  if (timeRange === '3M') start.setMonth(now.getMonth() - 3)
  if (timeRange === '6M') start.setMonth(now.getMonth() - 6)
  if (timeRange === '1Y') start.setFullYear(now.getFullYear() - 1)
  return start
}

function expectancyOf(trades: Trade[]): number {
  const closed = trades.filter((trade) => trade.profit_loss !== undefined)
  if (closed.length === 0) return 0
  const winners = closed.filter((trade) => (trade.profit_loss ?? 0) > 0)
  const losers = closed.filter((trade) => (trade.profit_loss ?? 0) < 0)
  const avgWin =
    winners.length > 0
      ? winners.reduce((sum, trade) => sum + (trade.profit_loss ?? 0), 0) / winners.length
      : 0
  const avgLoss =
    losers.length > 0
      ? Math.abs(losers.reduce((sum, trade) => sum + (trade.profit_loss ?? 0), 0) / losers.length)
      : 0
  return (winners.length / closed.length) * avgWin - (losers.length / closed.length) * avgLoss
}

function cvar95(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const tailCount = Math.max(1, Math.ceil(sorted.length * 0.05))
  const tail = sorted.slice(0, tailCount)
  return tail.reduce((sum, value) => sum + value, 0) / tail.length
}

function splitBy(trades: Trade[], key: (trade: Trade) => string | undefined): BookSplitRow[] {
  const groups = new Map<string, Trade[]>()
  for (const trade of trades) {
    const name = key(trade)
    if (!name) continue
    groups.set(name, [...(groups.get(name) ?? []), trade])
  }
  return [...groups.entries()].map(([name, rows]) => ({
    name,
    trades: rows.length,
    pnl: round(rows.reduce((sum, trade) => sum + (trade.profit_loss ?? 0), 0)),
    expectancy: round(expectancyOf(rows)),
  }))
}

export function buildBookAnalytics(trades: Trade[], input: AnalyticsInput): BookAnalytics {
  const now = input.now ?? new Date()
  const start = rangeStart(input.timeRange, now)
  const filtered = trades.filter((trade) => (start ? new Date(trade.timestamp) >= start : true))
  const filled = filtered.filter((trade) => trade.status === 'filled')
  const closed = filled.filter((trade) => trade.profit_loss !== undefined)
  const winners = closed.filter((trade) => (trade.profit_loss ?? 0) > 0)
  const losers = closed.filter((trade) => (trade.profit_loss ?? 0) < 0)
  const totalPnL = closed.reduce((sum, trade) => sum + (trade.profit_loss ?? 0), 0)
  const avgWin =
    winners.length > 0
      ? winners.reduce((sum, trade) => sum + (trade.profit_loss ?? 0), 0) / winners.length
      : 0
  const avgLoss =
    losers.length > 0
      ? Math.abs(losers.reduce((sum, trade) => sum + (trade.profit_loss ?? 0), 0) / losers.length)
      : 0
  const totalWins = winners.reduce((sum, trade) => sum + (trade.profit_loss ?? 0), 0)
  const totalLosses = Math.abs(losers.reduce((sum, trade) => sum + (trade.profit_loss ?? 0), 0))
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999.99 : 0
  const pnlValues = closed.map((trade) => trade.profit_loss ?? 0)
  const equity = input.equity

  const byDay = new Map<string, number>()
  for (const trade of [...closed].sort(
    (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
  )) {
    const date = new Date(trade.timestamp).toISOString().split('T')[0]
    byDay.set(date, (byDay.get(date) ?? 0) + (trade.profit_loss ?? 0))
  }
  const daily = [...byDay.values()]
  const avgDaily = daily.length > 0 ? daily.reduce((sum, value) => sum + value, 0) / daily.length : 0
  const stdDev =
    daily.length > 1
      ? Math.sqrt(daily.reduce((sum, value) => sum + (value - avgDaily) ** 2, 0) / (daily.length - 1))
      : 0
  let peak = 0
  let cursor = 0
  let maxDrawdown = 0
  for (const value of byDay.values()) {
    cursor += value
    if (cursor > peak) peak = cursor
    maxDrawdown = Math.max(maxDrawdown, peak - cursor)
  }
  let cumulative = 0
  const pnlTimeSeries: AnalyticsPnLDataPoint[] = [...byDay.entries()].map(([date, pnl]) => {
    const count = closed.filter((trade) => trade.timestamp.startsWith(date)).length
    cumulative += pnl
    return { date, pnl: round(pnl), cumulativePnl: round(cumulative), tradeCount: count }
  })

  const cost = filled.reduce((sum, trade) => sum + (trade.shortfall ?? 0), 0)
  const grossAlpha = totalPnL + cost
  const notional = filled.reduce((sum, trade) => sum + trade.price * trade.quantity, 0)

  const symbolMap = new Map<string, Trade[]>()
  for (const trade of filtered) {
    symbolMap.set(trade.symbol, [...(symbolMap.get(trade.symbol) ?? []), trade])
  }
  const symbolPerformance: SymbolPerformanceData[] = [...symbolMap.entries()].map(([symbol, rows]) => {
    const closedRows = rows.filter((trade) => trade.profit_loss !== undefined && trade.status === 'filled')
    const sizes = rows
      .filter((trade) => trade.status === 'filled')
      .map((trade) => trade.price * trade.quantity)
    const pnl = closedRows.reduce((sum, trade) => sum + (trade.profit_loss ?? 0), 0)
    const wins = closedRows.filter((trade) => (trade.profit_loss ?? 0) > 0).length
    const losses = closedRows.filter((trade) => (trade.profit_loss ?? 0) < 0).length
    return {
      symbol,
      totalPnL: round(pnl),
      winRate: closedRows.length > 0 ? round((wins / closedRows.length) * 100, 1) : 0,
      totalTrades: rows.length,
      winningTrades: wins,
      losingTrades: losses,
      avgPnL: closedRows.length > 0 ? round(pnl / closedRows.length) : 0,
      totalVolume: round(sizes.reduce((sum, size) => sum + size, 0)),
      avgTradeSize: sizes.length > 0 ? round(sizes.reduce((sum, size) => sum + size, 0) / sizes.length) : 0,
    }
  })

  const botName = (botId: string) => {
    if (!botId) return 'Book'
    return input.bots.find((bot) => bot.id === botId)?.name || 'Unknown bot'
  }

  const overview: AnalyticsOverview = {
    totalPnL: round(totalPnL),
    totalPnLPercentage: equity > 0 ? round((totalPnL / equity) * 100) : 0,
    winRate: closed.length > 0 ? round((winners.length / closed.length) * 100, 1) : 0,
    totalTrades: filtered.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
    sharpeRatio: stdDev > 0 ? round((avgDaily / stdDev) * Math.sqrt(252)) : 0,
    profitFactor: round(profitFactor),
    maxDrawdown: round(maxDrawdown),
    maxDrawdownPercentage: equity > 0 ? round((maxDrawdown / equity) * 100) : 0,
    avgTradeReturn: closed.length > 0 ? round(totalPnL / closed.length) : 0,
    avgWin: round(avgWin),
    avgLoss: round(avgLoss),
    bestTrade: pnlValues.length > 0 ? round(Math.max(...pnlValues)) : 0,
    worstTrade: pnlValues.length > 0 ? round(Math.min(...pnlValues)) : 0,
    totalCapitalDeployed: equity,
  }

  return {
    overview,
    pnlTimeSeries,
    symbolPerformance,
    metrics: {
      expectancy: round(expectancyOf(closed)),
      turnover: equity > 0 ? round(notional / equity) : 0,
      cvar95: round(cvar95(pnlValues)),
      cost: round(cost),
      grossAlpha: round(grossAlpha),
      costToGrossAlphaPct: grossAlpha > 0 ? round((cost / grossAlpha) * 100) : null,
    },
    byRegime: splitBy(filtered, (trade) => trade.regime),
    bySession: splitBy(filtered, (trade) => trade.session),
    byBot: splitBy(filtered, (trade) => botName(trade.bot_id)),
  }
}
