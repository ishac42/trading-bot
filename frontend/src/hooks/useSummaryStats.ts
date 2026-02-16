import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { SummaryStats } from '@/types'

/**
 * Hook to fetch dashboard summary statistics
 */
export const useSummaryStats = () => {
  return useQuery<SummaryStats>({
    queryKey: ['summaryStats'],
    queryFn: async () => {
      const response = await api.getSummaryStats()
      return response.data
    },
    staleTime: 1000 * 15, // 15 seconds
  })
}
