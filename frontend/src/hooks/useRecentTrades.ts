import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { Trade } from '@/types'
import { mockTrades } from '@/mocks/dashboardData'

const USE_MOCK = true // Toggle to false when backend is available

/**
 * Hook to fetch recent trades (for Dashboard)
 * @param limit - Number of recent trades to fetch (default: 10)
 */
export const useRecentTrades = (limit: number = 10) => {
  return useQuery<Trade[]>({
    queryKey: ['recentTrades', limit],
    queryFn: async () => {
      if (USE_MOCK) {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 400))
        // Sort by timestamp descending and limit
        return [...mockTrades]
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
          .slice(0, limit)
      }
      const response = await api.getTrades({ limit, sort: '-timestamp' })
      return response.data
    },
    staleTime: 1000 * 15, // 15 seconds for trade data
  })
}
