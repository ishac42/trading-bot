"""
Pydantic v2 schemas for request/response validation.

CRITICAL: These schemas must match the frontend TypeScript interfaces
exactly (field names, types, optionality) so that flipping USE_MOCK = false
in the frontend hooks works immediately.

Field naming convention (matches frontend):
- Entity fields: snake_case (bot_id, profit_loss, entry_price, is_open)
- Pagination/stats: camelCase (pageSize, totalItems, totalPnL, winRate)
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


# =============================================================================
# Risk Management — shared sub-schema
# =============================================================================

class RiskManagementSchema(BaseModel):
    """Matches frontend RiskManagement interface."""
    stop_loss: float
    take_profit: float
    max_position_size: float
    max_daily_loss: float
    max_concurrent_positions: int | None = None


# =============================================================================
# Bot Schemas — matches frontend Bot, BotFormData interfaces
# =============================================================================

class BotCreateSchema(BaseModel):
    """
    Request body for creating a bot.
    Matches frontend BotFormData interface.
    """
    name: str
    capital: float
    trading_frequency: int
    symbols: list[str]
    start_hour: int
    start_minute: int
    end_hour: int
    end_minute: int
    indicators: dict[str, dict[str, Any]]
    risk_management: RiskManagementSchema


class BotUpdateSchema(BotCreateSchema):
    """
    Request body for updating a bot.
    Same as create — frontend sends the full object on update.
    """
    pass


class BotResponseSchema(BaseModel):
    """
    Response schema for a single bot.
    Matches frontend Bot interface field-for-field.
    """
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    status: Literal["running", "paused", "stopped", "error"]
    capital: float
    trading_frequency: int
    indicators: dict[str, Any]
    risk_management: dict[str, Any]  # Stored as JSON in DB, returned as dict
    symbols: list[str]
    start_hour: int
    start_minute: int
    end_hour: int
    end_minute: int
    created_at: str  # ISO 8601 string
    updated_at: str  # ISO 8601 string
    last_run_at: str | None = None
    is_active: bool
    error_count: int


# =============================================================================
# Trade Schemas — matches frontend Trade, TradePagination interfaces
# =============================================================================

class TradeResponseSchema(BaseModel):
    """
    Response schema for a single trade.
    Matches frontend Trade interface field-for-field.
    """
    model_config = ConfigDict(from_attributes=True)

    id: str
    bot_id: str
    symbol: str
    type: Literal["buy", "sell"]
    quantity: int
    price: float
    timestamp: str  # ISO 8601 string
    indicators_snapshot: dict[str, Any] | None = None
    profit_loss: float | None = None
    order_id: str | None = None
    status: Literal["pending", "filled", "cancelled", "failed"]
    commission: float | None = None
    slippage: float | None = None


class PaginationSchema(BaseModel):
    """
    Pagination metadata.
    Matches frontend TradePagination interface.
    NOTE: Uses camelCase to match frontend convention.
    """
    page: int
    pageSize: int
    totalItems: int
    totalPages: int


class TradeListResponseSchema(BaseModel):
    """
    Paginated trade response.
    Matches the shape returned by useTrades hook.
    """
    trades: list[TradeResponseSchema]
    pagination: PaginationSchema


# =============================================================================
# Position Schemas — matches frontend Position interface
# =============================================================================

class PositionResponseSchema(BaseModel):
    """
    Response schema for a single position.
    Matches frontend Position interface field-for-field.
    """
    model_config = ConfigDict(from_attributes=True)

    id: str
    bot_id: str
    symbol: str
    quantity: int
    entry_price: float
    current_price: float
    stop_loss_price: float | None = None
    take_profit_price: float | None = None
    unrealized_pnl: float
    realized_pnl: float
    opened_at: str  # ISO 8601 string
    closed_at: str | None = None
    is_open: bool
    entry_indicator: str | None = None


# =============================================================================
# Summary Stats Schema — matches frontend SummaryStats interface
# =============================================================================

class SummaryStatsSchema(BaseModel):
    """
    Dashboard summary statistics.
    Matches frontend SummaryStats interface.
    """
    total_pnl: float
    pnl_percentage: float
    active_bots: int
    paused_bots: int | None = None
    stopped_bots: int | None = None
    open_positions: int
    positions_value: float
    total_trades_today: int | None = None
    win_rate: float | None = None


# =============================================================================
# Market Status Schema — matches frontend MarketStatus interface
# =============================================================================

class MarketStatusSchema(BaseModel):
    """
    Market open/close status.
    Matches frontend MarketStatus interface.
    """
    is_open: bool
    next_open: str | None = None
    next_close: str | None = None
    time_until_close: str | None = None


# =============================================================================
# Trade Stats Schema — matches frontend TradeStats interface
# NOTE: Uses camelCase to match frontend convention.
# =============================================================================

class PnLByDateSchema(BaseModel):
    """Single date entry in P&L by date breakdown."""
    date: str
    pnl: float
    cumulativePnl: float


class PnLBySymbolSchema(BaseModel):
    """Single symbol entry in P&L by symbol breakdown."""
    symbol: str
    pnl: float
    trades: int
    winRate: float


class PnLByBotSchema(BaseModel):
    """Single bot entry in P&L by bot breakdown."""
    botId: str
    botName: str
    pnl: float
    trades: int
    winRate: float


class TradeStatsSchema(BaseModel):
    """
    Computed trade statistics.
    Matches frontend TradeStats interface.
    NOTE: Uses camelCase to match frontend convention.
    """
    totalTrades: int
    winningTrades: int
    losingTrades: int
    winRate: float
    totalPnL: float
    avgPnL: float
    bestTrade: float
    worstTrade: float
    avgWin: float
    avgLoss: float
    profitFactor: float
    pnlByDate: list[PnLByDateSchema]
    pnlBySymbol: list[PnLBySymbolSchema]
    pnlByBot: list[PnLByBotSchema]


# =============================================================================
# Analytics Schemas — matches frontend Analytics* interfaces
# NOTE: Uses camelCase to match frontend convention.
# =============================================================================

class AnalyticsOverviewSchema(BaseModel):
    """Matches frontend AnalyticsOverview interface."""
    totalPnL: float
    totalPnLPercentage: float
    winRate: float
    totalTrades: int
    winningTrades: int
    losingTrades: int
    sharpeRatio: float
    profitFactor: float
    maxDrawdown: float
    maxDrawdownPercentage: float
    avgTradeReturn: float
    avgWin: float
    avgLoss: float
    bestTrade: float
    worstTrade: float
    totalCapitalDeployed: float


class AnalyticsPnLDataPointSchema(BaseModel):
    """Matches frontend AnalyticsPnLDataPoint interface."""
    date: str
    pnl: float
    cumulativePnl: float
    tradeCount: int


class BotPerformanceDataSchema(BaseModel):
    """Matches frontend BotPerformanceData interface."""
    botId: str
    botName: str
    status: str
    totalPnL: float
    winRate: float
    totalTrades: int
    winningTrades: int
    losingTrades: int
    avgPnL: float
    bestTrade: float
    worstTrade: float
    profitFactor: float
    capital: float
    returnOnCapital: float


class SymbolPerformanceDataSchema(BaseModel):
    """Matches frontend SymbolPerformanceData interface."""
    symbol: str
    totalPnL: float
    winRate: float
    totalTrades: int
    winningTrades: int
    losingTrades: int
    avgPnL: float
    totalVolume: float
    avgTradeSize: float


class AnalyticsDataSchema(BaseModel):
    """
    Full analytics response.
    Matches frontend AnalyticsData interface.
    """
    overview: AnalyticsOverviewSchema
    pnlTimeSeries: list[AnalyticsPnLDataPointSchema]
    botPerformance: list[BotPerformanceDataSchema]
    symbolPerformance: list[SymbolPerformanceDataSchema]
