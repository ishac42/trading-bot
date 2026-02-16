import { useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useWebSocket } from './useWebSocket'
import type { Trade, Bot } from '@/types'

/**
 * Hook to subscribe to real-time dashboard updates via WebSocket.
 *
 * Listens for:
 * - trade_executed: Prepends new trade to the recent trades cache
 * - bot_status_changed: Updates the bots cache
 * - position_updated: Invalidates summary stats
 *
 * Automatically updates React Query caches so the Dashboard re-renders.
 */
export const useRealtimeDashboard = () => {
  const { isConnected, subscribe } = useWebSocket()
  const queryClient = useQueryClient()

  // Handle incoming trade events
  const handleTradeExecuted = useCallback(
    (trade: Trade) => {
      // Add new trade to the beginning of recent trades cache
      queryClient.setQueryData<Trade[]>(['recentTrades', 10], (old) => {
        if (!old) return [trade]
        return [trade, ...old].slice(0, 10)
      })
      // Invalidate summary stats so they refresh
      queryClient.invalidateQueries({ queryKey: ['summaryStats'] })
    },
    [queryClient]
  )

  // Handle bot status change events
  const handleBotStatusChanged = useCallback(
    (updatedBot: Partial<Bot> & { id: string }) => {
      queryClient.setQueryData<Bot[]>(['bots'], (old) => {
        if (!old) return old
        return old.map((bot) =>
          bot.id === updatedBot.id ? { ...bot, ...updatedBot } : bot
        )
      })
      queryClient.invalidateQueries({ queryKey: ['summaryStats'] })
    },
    [queryClient]
  )

  // Handle position updates
  const handlePositionUpdated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['summaryStats'] })
  }, [queryClient])

  // Subscribe to WebSocket events
  useEffect(() => {
    const unsubTrade = subscribe('trade_executed', handleTradeExecuted)
    const unsubBot = subscribe('bot_status_changed', handleBotStatusChanged)
    const unsubPosition = subscribe('position_updated', handlePositionUpdated)

    return () => {
      unsubTrade()
      unsubBot()
      unsubPosition()
    }
  }, [subscribe, handleTradeExecuted, handleBotStatusChanged, handlePositionUpdated])

  return { isConnected }
}
