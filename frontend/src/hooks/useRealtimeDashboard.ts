import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { applyBookSocketEvent } from '@/mocks/bookStore'
import { subscribeBookEvent } from '@/services/bookEvents'
import type { BookSocketEvent } from '@/types'
import { useWebSocket } from './useWebSocket'

const BOOK_EVENTS: BookSocketEvent[] = [
  'trade_executed',
  'position_updated',
  'price_update',
  'risk_event',
  'regime_changed',
  'data_health',
  'universe_updated',
]

/**
 * Applies book socket events to the store the screens render.
 * Bot status is not a product event.
 */
export const useRealtimeDashboard = () => {
  const { isConnected, subscribe } = useWebSocket()
  const queryClient = useQueryClient()

  useEffect(() => {
    const apply = (event: BookSocketEvent) => (payload: unknown) => {
      applyBookSocketEvent(event, payload)
      queryClient.invalidateQueries({ queryKey: ['book-summary'] })
      if (event === 'universe_updated') queryClient.invalidateQueries({ queryKey: ['universe'] })
      if (event === 'trade_executed') queryClient.invalidateQueries({ queryKey: ['trades'] })
      if (event === 'position_updated' || event === 'price_update') {
        queryClient.invalidateQueries({ queryKey: ['positions'] })
      }
    }

    const unsubs = BOOK_EVENTS.flatMap((event) => [subscribe(event, apply(event)), subscribeBookEvent(event, apply(event))])
    return () => {
      unsubs.forEach((unsub) => unsub())
    }
  }, [subscribe, queryClient])

  return { isConnected }
}
