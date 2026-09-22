import type { Trade, TradeFilters, TradePagination, TradeSort, TradeStats } from '@/types'

function rangeStart(filters: TradeFilters, now: Date): Date | null {
  if (filters.dateRange === 'all') return null
  if (filters.dateRange === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }
  if (filters.dateRange === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - 7)
    return start
  }
  if (filters.dateRange === 'month') {
    const start = new Date(now)
    start.setMonth(now.getMonth() - 1)
    return start
  }
  if (filters.dateRange === 'custom') {
    return filters.customStartDate ? new Date(filters.customStartDate) : new Date(0)
  }
  return null
}

export function filterBookTrades(
  trades: Trade[],
  filters: TradeFilters,
  now = new Date()
): Trade[] {
  const start = rangeStart(filters, now)
  const end =
    filters.dateRange === 'custom' && filters.customEndDate
      ? new Date(`${filters.customEndDate}T23:59:59`)
      : now

  return trades.filter((trade) => {
    if (start) {
      const stamp = new Date(trade.timestamp)
      if (stamp < start || stamp > end) return false
    }
    if (filters.botId && trade.bot_id !== filters.botId) return false
    if (filters.symbol && trade.symbol !== filters.symbol) return false
    if (filters.type !== 'all' && trade.type !== filters.type) return false
    return true
  })
}

function compareTrades(left: Trade, right: Trade, field: TradeSort['field']): number {
  if (field === 'timestamp') {
    return new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
  }
  const a = left[field]
  const b = right[field]
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b)
  const aNum = typeof a === 'number' ? a : null
  const bNum = typeof b === 'number' ? b : null
  if (aNum == null && bNum == null) return 0
  if (aNum == null) return 1
  if (bNum == null) return -1
  return aNum - bNum
}

export function sortBookTrades(trades: Trade[], sort: TradeSort): Trade[] {
  const direction = sort.direction === 'asc' ? 1 : -1
  return [...trades].sort((left, right) => compareTrades(left, right, sort.field) * direction)
}

export function paginateTrades(
  trades: Trade[],
  page: number,
  pageSize: number
): { trades: Trade[]; pagination: TradePagination } {
  const totalItems = trades.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const start = (safePage - 1) * pageSize
  return {
    trades: trades.slice(start, start + pageSize),
    pagination: { page: safePage, pageSize, totalItems, totalPages },
  }
}

function splitRows(
  trades: Trade[],
  key: (trade: Trade) => string | undefined
): { name: string; trades: number; pnl: number }[] {
  const groups = new Map<string, { trades: number; pnl: number }>()
  for (const trade of trades) {
    const name = key(trade)
    if (!name) continue
    const entry = groups.get(name) ?? { trades: 0, pnl: 0 }
    entry.trades += 1
    entry.pnl += trade.profit_loss ?? 0
    groups.set(name, entry)
  }
  return [...groups.entries()].map(([name, entry]) => ({
    name,
    trades: entry.trades,
    pnl: Math.round(entry.pnl * 100) / 100,
  }))
}

export function summarizeBookTrades(trades: Trade[]): TradeStats {
  const closed = trades.filter((trade) => trade.profit_loss !== undefined)
  const winners = closed.filter((trade) => (trade.profit_loss ?? 0) > 0)
  const losers = closed.filter((trade) => (trade.profit_loss ?? 0) < 0)
  const totalPnL = closed.reduce((sum, trade) => sum + (trade.profit_loss ?? 0), 0)
  const pnlValues = closed.map((trade) => trade.profit_loss ?? 0)
  const totalWins = winners.reduce((sum, trade) => sum + (trade.profit_loss ?? 0), 0)
  const totalLosses = Math.abs(losers.reduce((sum, trade) => sum + (trade.profit_loss ?? 0), 0))
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999.99 : 0

  const byDate = new Map<string, number>()
  for (const trade of [...closed].sort(
    (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
  )) {
    const date = new Date(trade.timestamp).toISOString().split('T')[0]
    byDate.set(date, (byDate.get(date) ?? 0) + (trade.profit_loss ?? 0))
  }
  let cumulative = 0
  const pnlByDate = [...byDate.entries()].map(([date, pnl]) => {
    cumulative += pnl
    return {
      date,
      pnl: Math.round(pnl * 100) / 100,
      cumulativePnl: Math.round(cumulative * 100) / 100,
    }
  })

  const symbolGroups = new Map<string, { pnl: number; trades: number; wins: number }>()
  for (const trade of closed) {
    const entry = symbolGroups.get(trade.symbol) ?? { pnl: 0, trades: 0, wins: 0 }
    entry.pnl += trade.profit_loss ?? 0
    entry.trades += 1
    if ((trade.profit_loss ?? 0) > 0) entry.wins += 1
    symbolGroups.set(trade.symbol, entry)
  }

  return {
    totalTrades: trades.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
    winRate: closed.length > 0 ? Math.round((winners.length / closed.length) * 1000) / 10 : 0,
    totalPnL: Math.round(totalPnL * 100) / 100,
    avgPnL: closed.length > 0 ? Math.round((totalPnL / closed.length) * 100) / 100 : 0,
    bestTrade: pnlValues.length > 0 ? Math.round(Math.max(...pnlValues) * 100) / 100 : 0,
    worstTrade: pnlValues.length > 0 ? Math.round(Math.min(...pnlValues) * 100) / 100 : 0,
    avgWin:
      winners.length > 0
        ? Math.round((winners.reduce((sum, trade) => sum + (trade.profit_loss ?? 0), 0) / winners.length) * 100) / 100
        : 0,
    avgLoss:
      losers.length > 0
        ? Math.round(
            (Math.abs(losers.reduce((sum, trade) => sum + (trade.profit_loss ?? 0), 0)) / losers.length) * 100
          ) / 100
        : 0,
    profitFactor: Math.round(profitFactor * 100) / 100,
    pnlByDate,
    pnlBySymbol: [...symbolGroups.entries()].map(([symbol, entry]) => ({
      symbol,
      pnl: Math.round(entry.pnl * 100) / 100,
      trades: entry.trades,
      winRate: entry.trades > 0 ? Math.round((entry.wins / entry.trades) * 100) : 0,
    })),
    pnlByBot: [],
    pnlByRegime: splitRows(trades, (trade) => trade.regime).map((row) => ({
      regime: row.name,
      trades: row.trades,
      pnl: row.pnl,
    })),
    pnlBySession: splitRows(trades, (trade) => trade.session).map((row) => ({
      session: row.name,
      trades: row.trades,
      pnl: row.pnl,
    })),
  }
}
