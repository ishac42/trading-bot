import { io, Socket } from 'socket.io-client'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws'

// Set to true once the backend socket.io server is implemented (Phase 8)
const WS_ENABLED = false

export type WebSocketEvent =
  | 'trade_executed'
  | 'position_updated'
  | 'bot_status_changed'
  | 'price_update'
  | 'market_status_changed'

export type WebSocketEventHandler = (data: any) => void

class WebSocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  connect(): void {
    if (!WS_ENABLED) {
      return
    }

    // Don't create a new socket if one already exists (even if disconnected —
    // socket.io-client handles reconnection internally).
    if (this.socket) {
      return
    }

    this.socket = io(WS_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionAttempts: this.maxReconnectAttempts,
    })

    this.socket.on('connect', () => {
      console.log('WebSocket connected')
      this.reconnectAttempts = 0
      this.notifyConnectionStatus(true)
    })

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected')
      this.notifyConnectionStatus(false)
    })

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      this.reconnectAttempts++
    })
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  on(event: WebSocketEvent, handler: WebSocketEventHandler): void {
    if (this.socket) {
      this.socket.on(event, handler)
    }
  }

  off(event: WebSocketEvent, handler?: WebSocketEventHandler): void {
    if (this.socket) {
      if (handler) {
        this.socket.off(event, handler)
      } else {
        this.socket.off(event)
      }
    }
  }

  emit(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false
  }

  // Event emitters for connection status (used by hooks)
  private connectionStatusHandlers: Set<(connected: boolean) => void> = new Set()

  onConnectionStatusChange(handler: (connected: boolean) => void): () => void {
    this.connectionStatusHandlers.add(handler)
    return () => {
      this.connectionStatusHandlers.delete(handler)
    }
  }

  private notifyConnectionStatus(connected: boolean): void {
    this.connectionStatusHandlers.forEach((handler) => handler(connected))
  }
}

// Export singleton instance
export const websocketService = new WebSocketService()
