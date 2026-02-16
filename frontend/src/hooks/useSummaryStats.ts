import { useQuery } from '@tanstack/react-query'
import type { SummaryStats } from '@/types'
import { mockSummaryStats } from '@/mocks/dashboardData'

const USE_MOCK = true // Toggle to false when backend is available

/**
 * Hook to fetch dashboard summary statistics
 */
export const useSummaryStats = () => {
  return useQuery<SummaryStats>({
    queryKey: ['summaryStats'],
    queryFn: async () => {
      if (USE_MOCK) {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 300))
        return mockSummaryStats
      }
      // When backend is ready, use: const response = await api.getSummaryStats()
      throw new Error('Backend not yet implemented')
    },
    staleTime: 1000 * 15, // 15 seconds
  })
}
