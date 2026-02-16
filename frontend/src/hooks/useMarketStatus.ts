import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { MarketStatus } from '@/types'
import { useWebSocket } from './useWebSocket'

/**
 * Hook to fetch and subscribe to market status updates
 */
export const useMarketStatus = () => {
  const { subscribe } = useWebSocket()
  const [marketStatus, setMarketStatus] = useState<MarketStatus | undefined>()

  // Fetch initial market status
  const { data, isLoading, refetch } = useQuery<MarketStatus | undefined>({
    queryKey: ['marketStatus'],
    queryFn: async () => {
      try {
        const response = await api.getMarketStatus()
        return response.data
      } catch (error) {
        // If API fails, return undefined (market status will be unknown)
        console.warn('Failed to fetch market status:', error)
        return undefined
      }
    },
    refetchInterval: 60000, // Refetch every minute
    retry: false, // Don't retry on failure to avoid spamming
    enabled: true, // Always enabled, but will handle errors gracefully
  })

  // Subscribe to real-time market status updates
  useEffect(() => {
    if (data) {
      setMarketStatus(data)
    }
  }, [data])

  useEffect(() => {
    const unsubscribe = subscribe('market_status_changed', (newStatus: MarketStatus) => {
      setMarketStatus(newStatus)
      // Invalidate query to refetch
      refetch()
    })

    return unsubscribe
  }, [subscribe, refetch])

  return {
    marketStatus: marketStatus || data,
    isLoading,
  }
}
