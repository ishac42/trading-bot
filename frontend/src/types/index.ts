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
  realized_gains: number
  trades_today: number
  win_rate: number
  today_pnl: number
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
    | 'accepted' | 'partially_filled' | 'pending_new'
    | 'new' | 'done_for_day' | 'expired' | 'replaced'
    | 'stopped' | 'rejected' | 'suspended' | 'calculated'
  commission?: number
  slippage?: number
  client_order_id?: string
  reason?: string
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
  entry_indicator?: string
}

export interface SummaryStats {
  total_pnl: number
  pnl_percentage: number
  active_bots: number
  paused_bots?: number
  stopped_bots?: number
  open_positions: number
  positions_value: number
  total_trades_today?: number
  win_rate?: number
}

export interface BotMetrics {
  trades_today: number
  win_rate: number
  daily_pnl: number
  daily_pnl_percentage: number
}

export interface MarketStatus {
  is_open: boolean
  next_open?: string
  next_close?: string
  time_until_close?: string
}

/**
 * Form data shape for creating/editing a bot.
 * All fields that the user can edit in the bot form.
 */
export interface BotFormData {
  name: string
  capital: number
  trading_frequency: number
  symbols: string[]
  start_hour: number
  start_minute: number
  end_hour: number
  end_minute: number
  indicators: Record<string, Record<string, number>>
  risk_management: RiskManagement
}

/**
 * Available indicator definitions for the form
 */
export interface IndicatorDefinition {
  key: string
  label: string
  description: string
  params: IndicatorParam[]
}

export interface IndicatorParam {
  key: string
  label: string
  defaultValue: number
  min?: number
  max?: number
  step?: number
}

// =====================
// Trade History Types (Sprint 5)
// =====================

export type TradeTypeFilter = 'all' | 'buy' | 'sell'
export type DateRangePreset = 'today' | 'week' | 'month' | 'all' | 'custom'
export type TradeSortField = 'timestamp' | 'symbol' | 'type' | 'quantity' | 'price' | 'profit_loss'
export type SortDirection = 'asc' | 'desc'

export interface TradeFilters {
  dateRange: DateRangePreset
  customStartDate?: string
  customEndDate?: string
  botId: string         // '' means all bots
  symbol: string        // '' means all symbols
  type: TradeTypeFilter
}

export interface TradeSort {
  field: TradeSortField
  direction: SortDirection
}

export interface TradePagination {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface TradeStats {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  totalPnL: number
  avgPnL: number
  bestTrade: number
  worstTrade: number
  avgWin: number
  avgLoss: number
  profitFactor: number
  pnlByDate: { date: string; pnl: number; cumulativePnl: number }[]
  pnlBySymbol: { symbol: string; pnl: number; trades: number; winRate: number }[]
  pnlByBot: { botId: string; botName: string; pnl: number; trades: number; winRate: number }[]
}

// =====================
// Analytics Types (Sprint 6)
// =====================

export type AnalyticsTimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL'

export interface AnalyticsOverview {
  totalPnL: number
  totalPnLPercentage: number
  winRate: number
  totalTrades: number
  winningTrades: number
  losingTrades: number
  sharpeRatio: number
  profitFactor: number
  maxDrawdown: number
  maxDrawdownPercentage: number
  avgTradeReturn: number
  avgWin: number
  avgLoss: number
  bestTrade: number
  worstTrade: number
  totalCapitalDeployed: number
}

export interface AnalyticsPnLDataPoint {
  date: string
  pnl: number
  cumulativePnl: number
  tradeCount: number
}

export interface BotPerformanceData {
  botId: string
  botName: string
  status: string
  totalPnL: number
  winRate: number
  totalTrades: number
  winningTrades: number
  losingTrades: number
  avgPnL: number
  bestTrade: number
  worstTrade: number
  profitFactor: number
  capital: number
  returnOnCapital: number
}

export interface SymbolPerformanceData {
  symbol: string
  totalPnL: number
  winRate: number
  totalTrades: number
  winningTrades: number
  losingTrades: number
  avgPnL: number
  totalVolume: number
  avgTradeSize: number
}

export interface AnalyticsData {
  overview: AnalyticsOverview
  pnlTimeSeries: AnalyticsPnLDataPoint[]
  botPerformance: BotPerformanceData[]
  symbolPerformance: SymbolPerformanceData[]
}

// =====================
// Account Types (Sprint F)
// =====================

export interface AccountInfo {
  account_number: string | null
  equity: number
  cash: number
  buying_power: number
  portfolio_value: number
  allocated_capital: number
  available_capital: number
  total_realized_gains: number
}