import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { Trade, TradeFilters, TradeSort, TradePagination } from '@/types'
import { mockTrades } from '@/mocks/dashboardData'

const USE_MOCK = false // Backend is available

interface UseTradesOptions {
  filters: TradeFilters
  sort: TradeSort
  page: number
  pageSize: number
}

interface UseTradesResult {
  trades: Trade[]
  pagination: TradePagination
}

/**
 * Filter and sort trades based on the given options (mock implementation)
 */
function filterAndSortTrades(
  allTrades: Trade[],
  options: UseTradesOptions
): UseTradesResult {
  let filtered = [...allTrades]

  // Date range filter
  const now = new Date()
  if (options.filters.dateRange !== 'all') {
    let startDate: Date

    switch (options.filters.dateRange) {
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
        startDate = options.filters.customStartDate
          ? new Date(options.filters.customStartDate)
          : new Date(0)
        break
      default:
        startDate = new Date(0)
    }

    const endDate =
      options.filters.dateRange === 'custom' && options.filters.customEndDate
        ? new Date(options.filters.customEndDate + 'T23:59:59Z')
        : now

    filtered = filtered.filter((trade) => {
      const tradeDate = new Date(trade.timestamp)
      return tradeDate >= startDate && tradeDate <= endDate
    })
  }

  // Bot filter
  if (options.filters.botId) {
    filtered = filtered.filter((trade) => trade.bot_id === options.filters.botId)
  }

  // Symbol filter
  if (options.filters.symbol) {
    filtered = filtered.filter(
      (trade) => trade.symbol === options.filters.symbol
    )
  }

  // Type filter
  if (options.filters.type !== 'all') {
    filtered = filtered.filter((trade) => trade.type === options.filters.type)
  }

  // Sort
  filtered.sort((a, b) => {
    const dir = options.sort.direction === 'asc' ? 1 : -1
    switch (options.sort.field) {
      case 'timestamp':
        return (
          dir *
          (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        )
      case 'symbol':
        return dir * a.symbol.localeCompare(b.symbol)
      case 'type':
        return dir * a.type.localeCompare(b.type)
      case 'quantity':
        return dir * (a.quantity - b.quantity)
      case 'price':
        return dir * (a.price - b.price)
      case 'profit_loss':
        return dir * ((a.profit_loss ?? 0) - (b.profit_loss ?? 0))
      default:
        return 0
    }
  })

  // Pagination
  const totalItems = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalItems / options.pageSize))
  const start = (options.page - 1) * options.pageSize
  const paginatedTrades = filtered.slice(start, start + options.pageSize)

  return {
    trades: paginatedTrades,
    pagination: {
      page: options.page,
      pageSize: options.pageSize,
      totalItems,
      totalPages,
    },
  }
}

/**
 * Hook to fetch trades with filtering, sorting, and pagination
 */
export const useTrades = (options: UseTradesOptions) => {
  return useQuery<UseTradesResult>({
    queryKey: ['trades', options],
    queryFn: async () => {
      if (USE_MOCK) {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 300))
        return filterAndSortTrades(mockTrades, options)
      }
      const response = await api.getTrades({
        ...options.filters,
        sortField: options.sort.field,
        sortDirection: options.sort.direction,
        page: options.page,
        pageSize: options.pageSize,
      })
      return response.data
    },
    staleTime: 1000 * 15,
  })
}

/**
 * Hook to fetch ALL trades matching the current filters (for CSV export).
 * Does not paginate.
 */
export const useAllFilteredTrades = (filters: TradeFilters) => {
  return useQuery<Trade[]>({
    queryKey: ['allFilteredTrades', filters],
    queryFn: async () => {
      if (USE_MOCK) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        const result = filterAndSortTrades(mockTrades, {
          filters,
          sort: { field: 'timestamp', direction: 'desc' },
          page: 1,
          pageSize: 99999,
        })
        return result.trades
      }
      const response = await api.getTrades({
        ...filters,
        page: 1,
        pageSize: 99999,
      })
      return response.data.trades
    },
    staleTime: 1000 * 30,
    enabled: false, // Only fetch on demand
  })
}
