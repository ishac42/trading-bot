import { useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useWebSocket } from './useWebSocket'
import type { Trade } from '@/types'

/**
 * Subscribes the dashboard to book events.
 * Product events are risk, regime, and data health. Bot status is not a product event.
 */
export const useRealtimeDashboard = () => {
  const { isConnected, subscribe } = useWebSocket()
  const queryClient = useQueryClient()

  const handleTradeExecuted = useCallback(
    (trade: Trade) => {
      queryClient.setQueryData<Trade[]>(['recentTrades', 10], (old) => {
        if (!old) return [trade]
        return [trade, ...old].slice(0, 10)
      })
      queryClient.invalidateQueries({ queryKey: ['summaryStats'] })
    },
    [queryClient]
  )

  const refreshBook = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['book-summary'] })
  }, [queryClient])

  useEffect(() => {
    const unsubTrade = subscribe('trade_executed', handleTradeExecuted)
    const unsubPosition = subscribe('position_updated', refreshBook)
    const unsubRisk = subscribe('risk_event', refreshBook)
    const unsubRegime = subscribe('regime_changed', refreshBook)
    const unsubHealth = subscribe('data_health', refreshBook)

    return () => {
      unsubTrade()
      unsubPosition()
      unsubRisk()
      unsubRegime()
      unsubHealth()
    }
  }, [subscribe, handleTradeExecuted, refreshBook])

  return { isConnected }
}
