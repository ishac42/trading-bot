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

from pydantic import BaseModel, ConfigDict, Field, model_validator


# =============================================================================
# Auth Schemas — matches frontend User interface and auth flow
# =============================================================================

class GoogleAuthRequest(BaseModel):
    """Request body for Google OAuth login."""
    credential: str


class UserResponse(BaseModel):
    """User profile returned after authentication."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str
    avatar_url: str | None = None
    provider: str
    created_at: str


class AuthResponse(BaseModel):
    """Response after successful authentication."""
    token: str
    user: UserResponse


# =============================================================================
# Error Response — consistent error shape for all endpoints
# =============================================================================

class ErrorDetailSchema(BaseModel):
    """Inner error payload returned by all error responses."""
    code: str
    message: str
    details: dict[str, Any] | None = None
    request_id: str | None = None


class ErrorResponseSchema(BaseModel):
    """Top-level error wrapper."""
    error: ErrorDetailSchema


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
    realized_gains: float = 0.0
    trades_today: int = 0
    win_rate: float = 0.0
    today_pnl: float = 0.0
    total_pnl: float = 0.0


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
    bot_id: str | None = None
    symbol: str
    type: Literal["buy", "sell"]
    quantity: int
    price: float
    timestamp: str  # ISO 8601 string
    indicators_snapshot: dict[str, Any] | None = None
    profit_loss: float | None = None
    order_id: str | None = None
    status: Literal[
        "pending", "filled", "cancelled", "failed",
        "accepted", "partially_filled", "pending_new",
        "new", "done_for_day", "expired", "replaced",
        "stopped", "rejected", "suspended", "calculated",
    ]
    profit_loss_pct: float | None = None
    commission: float | None = None
    slippage: float | None = None
    client_order_id: str | None = None
    reason: str | None = None
    reason_code: str | None = None
    shortfall: float | None = None
    regime: str | None = None
    session: str | None = None


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
    bot_id: str | None = None
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
    score: float | None = None
    veto_code: str | None = None
    regime: str | None = None
    expected_cost: float | None = None
    realized_cost: float | None = None
    hold_minutes: float | None = None
    atr_stop: float | None = None
    target_price: float | None = None
    open_stop_risk: float | None = None


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
    error: str | None = None


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


# =============================================================================
# Settings Schemas — matches frontend Settings* interfaces
# =============================================================================

class BrokerSettingsSchema(BaseModel):
    """Broker connection settings."""
    alpaca_api_key: str = ""
    alpaca_secret_key: str = ""
    base_url: str = "https://paper-api.alpaca.markets"
    is_paper: bool = True


class BrokerSettingsResponse(BaseModel):
    """Broker settings with keys masked."""
    alpaca_api_key_masked: str = ""
    alpaca_secret_key_masked: str = ""
    base_url: str = "https://paper-api.alpaca.markets"
    is_paper: bool = True
    is_connected: bool = False
    last_verified: str | None = None


class NotificationSettingsSchema(BaseModel):
    """Notification preference settings."""
    email_enabled: bool = False
    email_address: str = ""
    notify_trade_executed: bool = True
    notify_bot_error: bool = True
    notify_daily_summary: bool = False
    notify_stop_loss_hit: bool = True
    notify_market_hours: bool = False


class DisplaySettingsSchema(BaseModel):
    """Display preference settings."""
    timezone: str = "America/New_York"
    currency: str = "USD"
    decimal_places: int = 2
    date_format: str = "MM/DD/YYYY"
    refresh_interval: int = 30


class SettingsCategoryResponse(BaseModel):
    """Single settings category response."""
    category: str
    settings: dict[str, Any]
    updated_at: str | None = None


class AllSettingsResponse(BaseModel):
    """All settings for the current user."""
    broker: BrokerSettingsResponse
    notifications: NotificationSettingsSchema
    display: DisplaySettingsSchema
    universe: "UniverseFiltersSchema"
    session: "SessionSettingsSchema"
    feed: "FeedSettingsSchema"
    risk: "RiskCapsSchema"
    mode: "ModeSettingsSchema"
    fees: "FeeTierSchema"


class BrokerTestResponse(BaseModel):
    """Result of testing broker connection."""
    success: bool
    message: str
    account_id: str | None = None
    equity: float | None = None
    buying_power: float | None = None


class DataStatsResponse(BaseModel):
    """Storage usage stats for data management section."""
    total_bots: int
    total_trades: int
    total_positions: int
    open_positions: int


# =============================================================================
# Activity Log Schemas
# =============================================================================

class ActivityLogResponseSchema(BaseModel):
    """Response schema for a single activity log entry."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    timestamp: str
    level: str
    category: str
    message: str
    details: dict[str, Any] | None = None
    bot_id: str | None = None
    user_id: str | None = None


class ActivityLogListResponseSchema(BaseModel):
    """Paginated activity log response."""
    logs: list[ActivityLogResponseSchema]
    pagination: PaginationSchema


# =============================================================================
# Book control-plane schemas
# =============================================================================

class UniverseFiltersSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    top_n: int = Field(ge=50, le=100)
    min_price: float = Field(ge=5)
    max_spread_bps: float = Field(ge=10, le=15)


class UniverseMemberSchema(BaseModel):
    symbol: str
    price: float
    dollar_volume: float
    spread_bps: float


class UniverseSnapshotSchema(BaseModel):
    as_of: str | None = None
    filters: UniverseFiltersSchema
    members: list[UniverseMemberSchema] = Field(default_factory=list)


class UniverseSettingsResponse(BaseModel):
    filters: UniverseFiltersSchema
    snapshot: UniverseSnapshotSchema


class SessionSettingsSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rth_enabled: bool = True
    extended_hours: bool = False

    @model_validator(mode="after")
    def equity_session_is_rth(self) -> "SessionSettingsSchema":
        if self.extended_hours:
            raise ValueError("Extended hours is not the equity session")
        if not self.rth_enabled:
            raise ValueError("Regular trading hours stay on")
        return self


class FeedSettingsSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    primary: Literal["sip"] = "sip"
    iex_diagnostic: bool = False


class RiskCapsSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    risk_per_trade_pct: float = Field(gt=0, le=0.25)
    max_open_stop_risk_pct: float = Field(gt=0, le=0.75)
    soft_throttle_pct: float = Field(ge=-1, le=-0.1)
    stop_new_risk_pct: float = Field(ge=-1.5, le=-0.2)
    hard_daily_lock_pct: float = Field(ge=-2, le=-0.3)
    max_positions: int = Field(ge=1, le=3)
    single_name_notional_pct: float = Field(ge=1, le=25)
    min_score: int = Field(ge=70, le=100)
    min_target_r: float = Field(ge=1.5)
    cost_multiple: float = Field(ge=3)

    @model_validator(mode="after")
    def ladder_order(self) -> "RiskCapsSchema":
        if not (self.soft_throttle_pct > self.stop_new_risk_pct > self.hard_daily_lock_pct):
            raise ValueError("Throttle ladder must tighten from soft throttle to stop-new to the daily lock")
        if self.risk_per_trade_pct > self.max_open_stop_risk_pct:
            raise ValueError("Risk per trade cannot exceed max open stop-risk")
        return self


class ModeSettingsSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: Literal["paper", "shadow", "min_size_live"]


class FeeTierSchema(BaseModel):
    version: str = ""
    refreshed_at: str = ""
    source: str = ""
    account_id: str | None = None


class BotRiskSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    risk_per_trade_pct: float = Field(gt=0, le=0.25)
    max_open_stop_risk_pct: float = Field(gt=0, le=0.75)
    max_positions: int = Field(ge=1, le=3)
    single_name_notional_pct: float = Field(ge=1, le=25)
    min_score: int = Field(ge=70, le=100)
    min_target_r: float = Field(ge=1.5)
    cost_multiple: float = Field(ge=3)
    sleeve_loss_limit_pct: float = Field(ge=-2, le=-0.1)


class BotStatsSchema(BaseModel):
    marked_pnl: float = 0
    marked_pnl_pct: float = 0
    trade_count: int = 0
    win_rate: float = 0
    expectancy: float = 0
    veto_count: int = 0


class BotProfileWriteSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=255)
    universe: UniverseFiltersSchema
    risk: BotRiskSchema


class BotProfileResponseSchema(BaseModel):
    id: str
    name: str
    status: Literal["running", "stopped"]
    universe: UniverseFiltersSchema
    snapshot: UniverseSnapshotSchema
    risk: BotRiskSchema
    stats: BotStatsSchema


class ConfirmBody(BaseModel):
    confirm: bool


class BookSummarySchema(BaseModel):
    equity: float
    marked_daily_pnl: float
    marked_daily_pnl_pct: float
    daily_lock_pct: float
    throttle_stage: Literal["normal", "half", "stop_new", "locked"]
    open_stop_risk: float
    open_stop_risk_pct: float
    position_count: int
    max_positions: int
    regime: str | None = None
    data_freshness: dict[str, Any]
    kill_switch: dict[str, bool]


class RiskEventSchema(BaseModel):
    id: str
    kind: str
    reason_code: str
    payload: dict[str, Any]
    created_at: str
