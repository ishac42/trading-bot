import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import type {
  AnalyticsData,
  AnalyticsOverview,
  AnalyticsPnLDataPoint,
  AnalyticsTimeRange,
  BotPerformanceData,
  SymbolPerformanceData,
  Trade,
} from '@/types'
import { mockTrades, mockBots, getBotName } from '@/mocks/dashboardData'

const USE_MOCK = false // Backend is available

/**
 * Compute comprehensive analytics from trades and bots
 */
function computeAnalytics(
  trades: Trade[],
  timeRange: AnalyticsTimeRange
): AnalyticsData {
  // Filter trades by time range
  const filtered = filterByTimeRange(trades, timeRange)

  // Closed trades have profit_loss
  const closedTrades = filtered.filter((t) => t.profit_loss !== undefined)
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
  const profitFactor =
    totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999.99 : 0

  // Sharpe Ratio approximation (daily returns stddev)
  const dailyReturnsMap = new Map<string, number>()
  for (const trade of closedTrades) {
    const date = new Date(trade.timestamp).toISOString().split('T')[0]
    dailyReturnsMap.set(
      date,
      (dailyReturnsMap.get(date) || 0) + (trade.profit_loss ?? 0)
    )
  }
  const dailyReturns = Array.from(dailyReturnsMap.values())
  const avgDailyReturn =
    dailyReturns.length > 0
      ? dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length
      : 0
  const stdDev =
    dailyReturns.length > 1
      ? Math.sqrt(
          dailyReturns.reduce(
            (sum, r) => sum + Math.pow(r - avgDailyReturn, 2),
            0
          ) /
            (dailyReturns.length - 1)
        )
      : 0
  const sharpeRatio =
    stdDev > 0 ? (avgDailyReturn / stdDev) * Math.sqrt(252) : 0

  // Max Drawdown
  let maxDrawdown = 0
  let peak = 0
  let cumPnL = 0
  const sortedClosed = [...closedTrades].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
  for (const trade of sortedClosed) {
    cumPnL += trade.profit_loss ?? 0
    if (cumPnL > peak) peak = cumPnL
    const drawdown = peak - cumPnL
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }

  // Total capital deployed
  const totalCapitalDeployed = mockBots.reduce(
    (sum, bot) => sum + bot.capital,
    0
  )
  const totalPnLPercentage =
    totalCapitalDeployed > 0 ? (totalPnL / totalCapitalDeployed) * 100 : 0
  const maxDrawdownPercentage =
    totalCapitalDeployed > 0 ? (maxDrawdown / totalCapitalDeployed) * 100 : 0

  const overview: AnalyticsOverview = {
    totalPnL: round(totalPnL),
    totalPnLPercentage: round(totalPnLPercentage),
    winRate: round(winRate, 1),
    totalTrades: filtered.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    sharpeRatio: round(sharpeRatio),
    profitFactor: round(profitFactor),
    maxDrawdown: round(maxDrawdown),
    maxDrawdownPercentage: round(maxDrawdownPercentage),
    avgTradeReturn: round(avgPnL),
    avgWin: round(avgWin),
    avgLoss: round(avgLoss),
    bestTrade: round(bestTrade),
    worstTrade: round(worstTrade),
    totalCapitalDeployed,
  }

  // P&L Time Series
  const pnlTimeSeries = computePnLTimeSeries(closedTrades)

  // Bot Performance
  const botPerformance = computeBotPerformance(closedTrades, filtered)

  // Symbol Performance
  const symbolPerformance = computeSymbolPerformance(closedTrades, filtered)

  return {
    overview,
    pnlTimeSeries,
    botPerformance,
    symbolPerformance,
  }
}

function filterByTimeRange(
  trades: Trade[],
  timeRange: AnalyticsTimeRange
): Trade[] {
  if (timeRange === 'ALL') return [...trades]

  const now = new Date()
  let startDate: Date

  switch (timeRange) {
    case '1W':
      startDate = new Date(now)
      startDate.setDate(now.getDate() - 7)
      break
    case '1M':
      startDate = new Date(now)
      startDate.setMonth(now.getMonth() - 1)
      break
    case '3M':
      startDate = new Date(now)
      startDate.setMonth(now.getMonth() - 3)
      break
    case '6M':
      startDate = new Date(now)
      startDate.setMonth(now.getMonth() - 6)
      break
    case '1Y':
      startDate = new Date(now)
      startDate.setFullYear(now.getFullYear() - 1)
      break
    default:
      return [...trades]
  }

  return trades.filter(
    (trade) => new Date(trade.timestamp) >= startDate
  )
}

function computePnLTimeSeries(
  closedTrades: Trade[]
): AnalyticsPnLDataPoint[] {
  const sorted = [...closedTrades].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  const dateMap = new Map<string, { pnl: number; count: number }>()
  for (const trade of sorted) {
    const date = new Date(trade.timestamp).toISOString().split('T')[0]
    const existing = dateMap.get(date) || { pnl: 0, count: 0 }
    existing.pnl += trade.profit_loss ?? 0
    existing.count += 1
    dateMap.set(date, existing)
  }

  let cumulative = 0
  return Array.from(dateMap.entries()).map(([date, data]) => {
    cumulative += data.pnl
    return {
      date,
      pnl: round(data.pnl),
      cumulativePnl: round(cumulative),
      tradeCount: data.count,
    }
  })
}

function computeBotPerformance(
  closedTrades: Trade[],
  allTrades: Trade[]
): BotPerformanceData[] {
  const botMap = new Map<
    string,
    {
      pnl: number
      trades: number
      wins: number
      losses: number
      pnlValues: number[]
    }
  >()

  for (const trade of closedTrades) {
    const entry = botMap.get(trade.bot_id) || {
      pnl: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      pnlValues: [],
    }
    entry.pnl += trade.profit_loss ?? 0
    entry.trades += 1
    if ((trade.profit_loss ?? 0) > 0) entry.wins += 1
    if ((trade.profit_loss ?? 0) < 0) entry.losses += 1
    entry.pnlValues.push(trade.profit_loss ?? 0)
    botMap.set(trade.bot_id, entry)
  }

  // Also add bots that had trades (even if no closed ones)
  for (const trade of allTrades) {
    if (!botMap.has(trade.bot_id)) {
      botMap.set(trade.bot_id, {
        pnl: 0,
        trades: 0,
        wins: 0,
        losses: 0,
        pnlValues: [],
      })
    }
  }

  return Array.from(botMap.entries()).map(([botId, data]) => {
    const bot = mockBots.find((b) => b.id === botId)
    const totalWins = data.pnlValues
      .filter((v) => v > 0)
      .reduce((s, v) => s + v, 0)
    const totalLosses = Math.abs(
      data.pnlValues.filter((v) => v < 0).reduce((s, v) => s + v, 0)
    )
    const capital = bot?.capital ?? 0

    return {
      botId,
      botName: getBotName(botId),
      status: bot?.status ?? 'unknown',
      totalPnL: round(data.pnl),
      winRate:
        data.trades > 0 ? round((data.wins / data.trades) * 100, 1) : 0,
      totalTrades: data.trades,
      winningTrades: data.wins,
      losingTrades: data.losses,
      avgPnL: data.trades > 0 ? round(data.pnl / data.trades) : 0,
      bestTrade:
        data.pnlValues.length > 0 ? round(Math.max(...data.pnlValues)) : 0,
      worstTrade:
        data.pnlValues.length > 0 ? round(Math.min(...data.pnlValues)) : 0,
      profitFactor:
        totalLosses > 0
          ? round(totalWins / totalLosses)
          : totalWins > 0
            ? 999.99
            : 0,
      capital,
      returnOnCapital: capital > 0 ? round((data.pnl / capital) * 100) : 0,
    }
  })
}

function computeSymbolPerformance(
  closedTrades: Trade[],
  allTrades: Trade[]
): SymbolPerformanceData[] {
  const symbolMap = new Map<
    string,
    {
      pnl: number
      trades: number
      wins: number
      losses: number
      totalVolume: number
      tradeSizes: number[]
    }
  >()

  for (const trade of closedTrades) {
    const entry = symbolMap.get(trade.symbol) || {
      pnl: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      totalVolume: 0,
      tradeSizes: [],
    }
    entry.pnl += trade.profit_loss ?? 0
    entry.trades += 1
    if ((trade.profit_loss ?? 0) > 0) entry.wins += 1
    if ((trade.profit_loss ?? 0) < 0) entry.losses += 1
    entry.totalVolume += trade.quantity * trade.price
    entry.tradeSizes.push(trade.quantity * trade.price)
    symbolMap.set(trade.symbol, entry)
  }

  // Add symbols from all trades (even if no closed ones)
  for (const trade of allTrades) {
    if (!symbolMap.has(trade.symbol)) {
      symbolMap.set(trade.symbol, {
        pnl: 0,
        trades: 0,
        wins: 0,
        losses: 0,
        totalVolume: trade.quantity * trade.price,
        tradeSizes: [trade.quantity * trade.price],
      })
    }
  }

  return Array.from(symbolMap.entries()).map(([symbol, data]) => ({
    symbol,
    totalPnL: round(data.pnl),
    winRate:
      data.trades > 0 ? round((data.wins / data.trades) * 100, 1) : 0,
    totalTrades: data.trades,
    winningTrades: data.wins,
    losingTrades: data.losses,
    avgPnL: data.trades > 0 ? round(data.pnl / data.trades) : 0,
    totalVolume: round(data.totalVolume),
    avgTradeSize:
      data.tradeSizes.length > 0
        ? round(
            data.tradeSizes.reduce((s, v) => s + v, 0) /
              data.tradeSizes.length
          )
        : 0,
  }))
}

function round(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

/**
 * Hook to fetch comprehensive analytics data
 */
export const useAnalytics = (timeRange: AnalyticsTimeRange = 'ALL') => {
  return useQuery<AnalyticsData>({
    queryKey: ['analytics', timeRange],
    queryFn: async () => {
      if (USE_MOCK) {
        await new Promise((resolve) => setTimeout(resolve, 300))
        return computeAnalytics(mockTrades, timeRange)
      }
      // Fetch all trades from backend and compute analytics client-side
      const response = await api.getTrades({ page: 1, pageSize: 99999 })
      const trades: Trade[] = response.data.trades
      return computeAnalytics(trades, timeRange)
    },
    staleTime: 1000 * 30,
  })
}
