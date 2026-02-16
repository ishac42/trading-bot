import { useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useWebSocket } from './useWebSocket'
import type { Position } from '@/types'

/**
 * Hook to subscribe to real-time position updates via WebSocket.
 *
 * Listens for:
 * - position_updated: Updates position data in the cache (price, P&L)
 * - price_update: Updates current_price and recalculates unrealized P&L
 *
 * Automatically updates React Query caches so the Positions page re-renders.
 */
export const useRealtimePositions = () => {
  const { isConnected, subscribe } = useWebSocket()
  const queryClient = useQueryClient()

  // Handle incoming position update events
  const handlePositionUpdated = useCallback(
    (updatedPosition: Partial<Position> & { id: string }) => {
      // Update position in all position query caches
      queryClient.setQueriesData<Position[]>(
        { queryKey: ['positions'] },
        (old) => {
          if (!old) return old
          return old.map((pos) =>
            pos.id === updatedPosition.id
              ? { ...pos, ...updatedPosition }
              : pos
          )
        }
      )
      // Also update single position cache if exists
      queryClient.setQueryData<Position>(
        ['position', updatedPosition.id],
        (old) => {
          if (!old) return old
          return { ...old, ...updatedPosition }
        }
      )
      // Invalidate summary stats
      queryClient.invalidateQueries({ queryKey: ['summaryStats'] })
    },
    [queryClient]
  )

  // Handle price updates (symbol-level updates that affect multiple positions)
  const handlePriceUpdate = useCallback(
    (data: { symbol: string; price: number }) => {
      queryClient.setQueriesData<Position[]>(
        { queryKey: ['positions'] },
        (old) => {
          if (!old) return old
          return old.map((pos) => {
            if (pos.symbol === data.symbol && pos.is_open) {
              const unrealized_pnl =
                (data.price - pos.entry_price) * pos.quantity
              return {
                ...pos,
                current_price: data.price,
                unrealized_pnl,
              }
            }
            return pos
          })
        }
      )
    },
    [queryClient]
  )

  // Subscribe to WebSocket events
  useEffect(() => {
    const unsubPosition = subscribe('position_updated', handlePositionUpdated)
    const unsubPrice = subscribe('price_update', handlePriceUpdate)

    return () => {
      unsubPosition()
      unsubPrice()
    }
  }, [subscribe, handlePositionUpdated, handlePriceUpdate])

  return { isConnected }
}
