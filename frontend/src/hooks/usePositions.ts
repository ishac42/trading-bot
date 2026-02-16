import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { Position } from '@/types'
import { mockPositions } from '@/mocks/dashboardData'

const USE_MOCK = true // Toggle to false when backend is available

export interface PositionFilters {
  botId?: string
  symbol?: string
  sortBy?: 'symbol' | 'unrealized_pnl' | 'entry_price' | 'current_price' | 'opened_at'
  sortOrder?: 'asc' | 'desc'
}

/**
 * Hook to fetch all open positions with optional filters
 */
export const usePositions = (filters?: PositionFilters) => {
  return useQuery<Position[]>({
    queryKey: ['positions', filters],
    queryFn: async () => {
      if (USE_MOCK) {
        await new Promise((resolve) => setTimeout(resolve, 400))
        let positions = [...mockPositions].filter((p) => p.is_open)

        // Apply filters
        if (filters?.botId) {
          positions = positions.filter((p) => p.bot_id === filters.botId)
        }
        if (filters?.symbol) {
          positions = positions.filter((p) => p.symbol === filters.symbol)
        }

        // Apply sorting
        if (filters?.sortBy) {
          const sortOrder = filters.sortOrder === 'desc' ? -1 : 1
          positions.sort((a, b) => {
            const aVal = a[filters.sortBy!]
            const bVal = b[filters.sortBy!]
            if (typeof aVal === 'string' && typeof bVal === 'string') {
              return aVal.localeCompare(bVal) * sortOrder
            }
            return ((aVal as number) - (bVal as number)) * sortOrder
          })
        }

        return positions
      }
      const response = await api.getPositions(filters)
      return response.data
    },
    staleTime: 1000 * 10, // 10 seconds - positions update frequently
    refetchInterval: 1000 * 30, // Auto-refresh every 30s
  })
}

/**
 * Hook to fetch a single position by ID
 */
export const usePosition = (positionId: string | undefined) => {
  return useQuery<Position>({
    queryKey: ['position', positionId],
    enabled: !!positionId,
    queryFn: async () => {
      if (USE_MOCK) {
        await new Promise((resolve) => setTimeout(resolve, 200))
        const position = mockPositions.find((p) => p.id === positionId)
        if (!position) throw new Error('Position not found')
        return position
      }
      const response = await api.getPosition(positionId!)
      return response.data
    },
    staleTime: 1000 * 5,
  })
}

/**
 * Hook to close a position
 */
export const useClosePosition = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (positionId: string) => {
      if (USE_MOCK) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        const position = mockPositions.find((p) => p.id === positionId)
        if (position) {
          position.is_open = false
          position.closed_at = new Date().toISOString()
          position.realized_pnl = position.unrealized_pnl
          position.unrealized_pnl = 0
        }
        return { success: true }
      }
      const response = await api.closePosition(positionId)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      queryClient.invalidateQueries({ queryKey: ['summaryStats'] })
    },
  })
}
