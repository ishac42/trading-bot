import { useEffect, useState, useCallback } from 'react'
import { websocketService } from '@/services/websocket'
import type { WebSocketEvent, WebSocketEventHandler } from '@/services/websocket'

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    websocketService.connect()

    const unsubscribe = websocketService.onConnectionStatusChange(setIsConnected)
    setIsConnected(websocketService.isConnected())

    return () => {
      unsubscribe()
      websocketService.disconnect()
    }
  }, [])

  const subscribe = useCallback((event: WebSocketEvent, handler: WebSocketEventHandler) => {
    websocketService.on(event, handler)
    return () => {
      websocketService.off(event, handler)
    }
  }, [])

  return {
    isConnected,
    subscribe,
  }
}
