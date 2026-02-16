// Common types for the application

export interface Bot {
  id: string
  name: string
  status: 'running' | 'paused' | 'stopped' | 'error'
  capital: number
  trading_frequency: number
  indicators: Record<string, any>
  risk_management: RiskManagement
  symbols: string[]
  start_hour: number
  start_minute: number
  end_hour: number
  end_minute: number
  created_at: string
  updated_at: string
  last_run_at?: string
  is_active: boolean
  error_count: number
}

export interface RiskManagement {
  stop_loss: number
  take_profit: number
  max_position_size: number
  max_daily_loss: number
  max_concurrent_positions?: number
}

export interface Trade {
  id: string
  bot_id: string
  symbol: string
  type: 'buy' | 'sell'
  quantity: number
  price: number
  timestamp: string
  indicators_snapshot?: Record<string, any>
  profit_loss?: number
  order_id?: string
  status: 'pending' | 'filled' | 'cancelled' | 'failed'
  commission?: number
  slippage?: number
}

export interface Position {
  id: string
  bot_id: string
  symbol: string
  quantity: number
  entry_price: number
  current_price: number
  stop_loss_price?: number
  take_profit_price?: number
  unrealized_pnl: number
  realized_pnl: number
  opened_at: string
  closed_at?: string
  is_open: boolean
}

export interface SummaryStats {
  total_pnl: number
  pnl_percentage: number
  active_bots: number
  open_positions: number
  positions_value: number
}

export interface MarketStatus {
  is_open: boolean
  next_open?: string
  next_close?: string
  time_until_close?: string
}
