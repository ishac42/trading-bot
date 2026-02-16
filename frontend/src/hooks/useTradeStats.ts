import { useQuery } from '@tanstack/react-query'
import type { Trade, TradeFilters, TradeStats } from '@/types'
import { mockTrades, getBotName } from '@/mocks/dashboardData'

const USE_MOCK = true

/**
 * Compute trade statistics from a set of trades
 */
function computeTradeStats(trades: Trade[]): TradeStats {
  // Only look at trades that have P&L (closed trades)
  const closedTrades = trades.filter((t) => t.profit_loss !== undefined)
  const winningTrades = closedTrades.filter((t) => (t.profit_loss ?? 0) > 0)
  const losingTrades = closedTrades.filter((t) => (t.profit_loss ?? 0) < 0)

  const totalPnL = closedTrades.reduce(
    (sum, t) => sum + (t.profit_loss ?? 0),
    0
  )
  const avgPnL =
    closedTrades.length > 0 ? totalPnL / closedTrades.length : 0
  const winRate =
    closedTrades.length > 0
      ? (winningTrades.length / closedTrades.length) * 100
      : 0

  const pnlValues = closedTrades.map((t) => t.profit_loss ?? 0)
  const bestTrade = pnlValues.length > 0 ? Math.max(...pnlValues) : 0
  const worstTrade = pnlValues.length > 0 ? Math.min(...pnlValues) : 0

  const avgWin =
    winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (t.profit_loss ?? 0), 0) /
        winningTrades.length
      : 0
  const avgLoss =
    losingTrades.length > 0
      ? Math.abs(
          losingTrades.reduce((sum, t) => sum + (t.profit_loss ?? 0), 0) /
            losingTrades.length
        )
      : 0

  const totalWins = winningTrades.reduce(
    (sum, t) => sum + (t.profit_loss ?? 0),
    0
  )
  const totalLosses = Math.abs(
    losingTrades.reduce((sum, t) => sum + (t.profit_loss ?? 0), 0)
  )
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0

  // P&L by date (cumulative)
  const tradesByDate = new Map<string, number>()
  const sortedClosed = [...closedTrades].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
  for (const trade of sortedClosed) {
    const date = new Date(trade.timestamp).toISOString().split('T')[0]
    tradesByDate.set(date, (tradesByDate.get(date) || 0) + (trade.profit_loss ?? 0))
  }
  let cumulative = 0
  const pnlByDate = Array.from(tradesByDate.entries()).map(([date, pnl]) => {
    cumulative += pnl
    return { date, pnl: Math.round(pnl * 100) / 100, cumulativePnl: Math.round(cumulative * 100) / 100 }
  })

  // P&L by symbol
  const symbolMap = new Map<string, { pnl: number; trades: number; wins: number }>()
  for (const trade of closedTrades) {
    const entry = symbolMap.get(trade.symbol) || {
      pnl: 0,
      trades: 0,
      wins: 0,
    }
    entry.pnl += trade.profit_loss ?? 0
    entry.trades += 1
    if ((trade.profit_loss ?? 0) > 0) entry.wins += 1
    symbolMap.set(trade.symbol, entry)
  }
  const pnlBySymbol = Array.from(symbolMap.entries()).map(([symbol, data]) => ({
    symbol,
    pnl: Math.round(data.pnl * 100) / 100,
    trades: data.trades,
    winRate: data.trades > 0 ? Math.round((data.wins / data.trades) * 100) : 0,
  }))

  // P&L by bot
  const botMap = new Map<string, { pnl: number; trades: number; wins: number }>()
  for (const trade of closedTrades) {
    const entry = botMap.get(trade.bot_id) || { pnl: 0, trades: 0, wins: 0 }
    entry.pnl += trade.profit_loss ?? 0
    entry.trades += 1
    if ((trade.profit_loss ?? 0) > 0) entry.wins += 1
    botMap.set(trade.bot_id, entry)
  }
  const pnlByBot = Array.from(botMap.entries()).map(([botId, data]) => ({
    botId,
    botName: getBotName(botId),
    pnl: Math.round(data.pnl * 100) / 100,
    trades: data.trades,
    winRate: data.trades > 0 ? Math.round((data.wins / data.trades) * 100) : 0,
  }))

  return {
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: Math.round(winRate * 10) / 10,
    totalPnL: Math.round(totalPnL * 100) / 100,
    avgPnL: Math.round(avgPnL * 100) / 100,
    bestTrade: Math.round(bestTrade * 100) / 100,
    worstTrade: Math.round(worstTrade * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    profitFactor: profitFactor === Infinity ? 999.99 : Math.round(profitFactor * 100) / 100,
    pnlByDate,
    pnlBySymbol,
    pnlByBot,
  }
}

/**
 * Apply the same filters as useTrades to get matching set of trades
 */
function applyFilters(allTrades: Trade[], filters: TradeFilters): Trade[] {
  let filtered = [...allTrades]

  const now = new Date()
  if (filters.dateRange !== 'all') {
    let startDate: Date
    switch (filters.dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        startDate = new Date(now)
        startDate.setDate(now.getDate() - 7)
        break
      case 'month':
        startDate = new Date(now)
        startDate.setMonth(now.getMonth() - 1)
        break
      case 'custom':
        startDate = filters.customStartDate
          ? new Date(filters.customStartDate)
          : new Date(0)
        break
      default:
        startDate = new Date(0)
    }
    const endDate =
      filters.dateRange === 'custom' && filters.customEndDate
        ? new Date(filters.customEndDate + 'T23:59:59Z')
        : now

    filtered = filtered.filter((trade) => {
      const tradeDate = new Date(trade.timestamp)
      return tradeDate >= startDate && tradeDate <= endDate
    })
  }

  if (filters.botId) {
    filtered = filtered.filter((trade) => trade.bot_id === filters.botId)
  }
  if (filters.symbol) {
    filtered = filtered.filter((trade) => trade.symbol === filters.symbol)
  }
  if (filters.type !== 'all') {
    filtered = filtered.filter((trade) => trade.type === filters.type)
  }

  return filtered
}

/**
 * Hook to fetch trade statistics with filters
 */
export const useTradeStats = (filters: TradeFilters) => {
  return useQuery<TradeStats>({
    queryKey: ['tradeStats', filters],
    queryFn: async () => {
      if (USE_MOCK) {
        await new Promise((resolve) => setTimeout(resolve, 200))
        const filtered = applyFilters(mockTrades, filters)
        return computeTradeStats(filtered)
      }
      // When backend is available, replace with API call
      const response = await fetch('/api/trades/stats')
      return response.json()
    },
    staleTime: 1000 * 30,
  })
}
