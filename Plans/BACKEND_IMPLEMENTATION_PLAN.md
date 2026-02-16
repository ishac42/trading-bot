# Backend Implementation Plan

> Based on `ARCHITECTURE.md` and the frontend's API contracts (`api.ts`, `types/index.ts`, hooks, and mock data).

---

## Table of Contents

1. [Overview](#overview)
2. [Phase 1: Project Foundation](#phase-1-project-foundation--setup)
3. [Phase 2: Database Layer](#phase-2-database-layer)
4. [Phase 3: Pydantic Schemas](#phase-3-pydantic-schemas--api-contracts)
5. [Phase 4: Bot Management API](#phase-4-bot-management-api)
6. [Phase 5: Trade Management API](#phase-5-trade-management-api)
7. [Phase 6: Position Management API](#phase-6-position-management-api)
8. [Phase 7: Market Data API & Dashboard](#phase-7-market-data-api--dashboard-summary)
9. [Phase 8: WebSocket Real-time Layer](#phase-8-websocket-real-time-layer)
10. [Phase 9: Alpaca Client Integration](#phase-9-alpaca-client-integration)
11. [Phase 10: Trading Engine Core](#phase-10-trading-engine-core)
12. [Phase 11: Indicator Calculator](#phase-11-indicator-calculator)
13. [Phase 12: Signal Generator](#phase-12-signal-generator)
14. [Phase 13: Risk Manager](#phase-13-risk-manager)
15. [Phase 14: Docker & Deployment](#phase-14-docker--deployment)
16. [Phase 15: Testing & Hardening](#phase-15-testing--hardening)
17. [Frontend Integration Checklist](#frontend-integration-checklist)
18. [File Structure Reference](#file-structure-reference)

---

## Overview

The backend must serve as the API layer and business logic engine for the trading bot system. It must:

1. **Match the frontend's API contracts exactly** — the frontend already has hooks, types, and API calls defined
2. **Implement all REST endpoints** the frontend calls (bots, trades, positions, market data, summary)
3. **Provide WebSocket events** the frontend subscribes to (trade_executed, position_updated, bot_status_changed, price_update, market_status_changed)
4. **Integrate with Alpaca** for paper/live trading
5. **Run trading bots** autonomously based on configured indicators and risk rules

### Key Constraint
The frontend is already built with `USE_MOCK = true` flags. The backend must return data in the **exact same shape** as the mock data so that flipping `USE_MOCK = false` works immediately.

### Technology Stack
- **Python 3.11+**
- **FastAPI** (async web framework)
- **SQLAlchemy 2.0** (async ORM)
- **Alembic** (migrations)
- **PostgreSQL** (database)
- **Redis** (optional caching/pub-sub)
- **python-socketio** (WebSocket with socket.io protocol)
- **alpaca-trade-api** / **alpaca-py** (Alpaca SDK)
- **pandas-ta** (technical indicators)
- **Pydantic v2** (data validation)
- **Uvicorn** (ASGI server)

---

## Phase 1: Project Foundation & Setup

**Goal**: Establish the project structure, dependency management, configuration, and basic FastAPI app.

### Tasks

#### 1.1 Create Project Structure
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app entry point
│   ├── config.py             # Settings/configuration (env vars)
│   ├── database.py           # Database engine, session factory
│   ├── models.py             # SQLAlchemy ORM models
│   ├── schemas.py            # Pydantic request/response schemas
│   ├── dependencies.py       # Shared dependencies (get_db, etc.)
│   ├── alpaca_client.py      # Alpaca API wrapper
│   ├── trading_engine.py     # Core trading orchestration
│   ├── indicators.py         # Technical indicator calculations
│   ├── signal_generator.py   # Signal generation logic
│   ├── risk_manager.py       # Risk management enforcement
│   ├── websocket_manager.py  # WebSocket event broadcasting
│   └── routers/
│       ├── __init__.py
│       ├── bots.py           # Bot CRUD + start/stop/pause
│       ├── trades.py         # Trade history + stats
│       ├── positions.py      # Position management
│       └── market_data.py    # Market status + data + summary
├── alembic/
│   ├── env.py
│   ├── versions/
│   └── alembic.ini
├── tests/
│   ├── __init__.py
│   ├── conftest.py           # Fixtures (test DB, client, etc.)
│   ├── test_bots.py
│   ├── test_trades.py
│   ├── test_positions.py
│   ├── test_market_data.py
│   ├── test_indicators.py
│   ├── test_risk_manager.py
│   └── test_trading_engine.py
├── requirements.txt
├── Dockerfile
├── .env.example
└── README.md
```

#### 1.2 Create `requirements.txt`
```
# Core
fastapi==0.115.0
uvicorn[standard]==0.32.0
pydantic==2.9.0
pydantic-settings==2.6.0

# Database
sqlalchemy[asyncio]==2.0.35
asyncpg==0.30.0
alembic==1.14.0

# Redis (optional)
redis[hiredis]==5.2.0

# WebSocket (socket.io)
python-socketio==5.12.0

# Trading
alpaca-py==0.33.0

# Technical Indicators
pandas-ta==0.3.14b
pandas==2.2.0
numpy==1.26.0

# Utilities
python-dotenv==1.0.1
httpx==0.28.0
python-dateutil==2.9.0

# CORS
# (included in FastAPI/Starlette)

# Logging
structlog==24.4.0

# Testing
pytest==8.3.0
pytest-asyncio==0.24.0
httpx==0.28.0
```

#### 1.3 Create `app/config.py`
Settings class using `pydantic-settings` to load environment variables:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Trading Bot API"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    DEBUG: bool = True
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost:5432/trading_bot"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # Alpaca
    ALPACA_API_KEY: str = ""
    ALPACA_SECRET_KEY: str = ""
    ALPACA_BASE_URL: str = "https://paper-api.alpaca.markets"
    
    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    
    # WebSocket
    WS_PING_INTERVAL: int = 25
    WS_PING_TIMEOUT: int = 60

    class Config:
        env_file = ".env"
        case_sensitive = True
```

#### 1.4 Create `app/main.py`
- Initialize FastAPI app
- Add CORS middleware (allow frontend at `localhost:5173`)
- Include all routers under `/api` prefix
- Mount socket.io ASGI app
- Add `/api/health` endpoint
- Add startup/shutdown events (DB connection, trading engine lifecycle)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import Settings
from app.routers import bots, trades, positions, market_data

settings = Settings()
app = FastAPI(title=settings.APP_NAME)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(bots.router, prefix="/api")
app.include_router(trades.router, prefix="/api")
app.include_router(positions.router, prefix="/api")
app.include_router(market_data.router, prefix="/api")

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}
```

#### 1.5 Create `.env.example`
```env
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/trading_bot

# Alpaca API
ALPACA_API_KEY=your_api_key
ALPACA_SECRET_KEY=your_secret_key
ALPACA_BASE_URL=https://paper-api.alpaca.markets

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Application
ENVIRONMENT=development
LOG_LEVEL=INFO
```

### Acceptance Criteria
- [ ] `uvicorn app.main:app --reload` starts without errors
- [ ] `GET /api/health` returns `{"status": "healthy"}`
- [ ] CORS allows requests from `http://localhost:5173`
- [ ] All routers are registered (even if returning placeholder responses)

---

## Phase 2: Database Layer

**Goal**: Define SQLAlchemy models and set up Alembic migrations for all three tables.

### Tasks

#### 2.1 Create `app/database.py`
- Async engine using `asyncpg`
- Async session factory
- Base declarative class
- `get_db` dependency for request-scoped sessions

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import Settings

settings = Settings()
engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

#### 2.2 Create `app/models.py`

Three tables matching `ARCHITECTURE.md` schema + frontend types:

**Bots Table** (matches `Bot` interface in `types/index.ts`):
```python
class Bot(Base):
    __tablename__ = "bots"
    
    id: Mapped[str]                    # Primary key (UUID string)
    name: Mapped[str]                  # Bot name
    status: Mapped[str]                # 'running' | 'paused' | 'stopped' | 'error'
    capital: Mapped[float]             # Allocated capital
    trading_frequency: Mapped[int]     # Seconds between checks
    indicators: Mapped[dict]           # JSON - indicator configurations
    risk_management: Mapped[dict]      # JSON - risk management settings
    symbols: Mapped[list]              # JSON - array of stock symbols
    start_hour: Mapped[int]            # Trading window start hour
    start_minute: Mapped[int]          # Trading window start minute
    end_hour: Mapped[int]              # Trading window end hour
    end_minute: Mapped[int]            # Trading window end minute
    created_at: Mapped[datetime]       # Creation timestamp
    updated_at: Mapped[datetime]       # Last update timestamp
    last_run_at: Mapped[datetime|None] # Last execution timestamp (optional)
    is_active: Mapped[bool]            # Whether bot is active
    error_count: Mapped[int]           # Error counter (default 0)
```

> **Important**: The frontend `Bot` type includes `last_run_at`, `is_active`, and `error_count` fields that aren't in the original ARCHITECTURE.md schema. These must be in the DB model.

**Trades Table** (matches `Trade` interface):
```python
class Trade(Base):
    __tablename__ = "trades"
    
    id: Mapped[str]                       # Primary key (UUID string)
    bot_id: Mapped[str]                   # FK → bots.id
    symbol: Mapped[str]                   # Stock symbol
    type: Mapped[str]                     # 'buy' | 'sell'
    quantity: Mapped[int]                 # Number of shares
    price: Mapped[float]                  # Execution price
    timestamp: Mapped[datetime]           # Trade time
    indicators_snapshot: Mapped[dict|None] # JSON - indicator values at trade time
    profit_loss: Mapped[float|None]       # P&L (null for open buy positions)
    order_id: Mapped[str|None]            # Alpaca order ID
    status: Mapped[str]                   # 'pending' | 'filled' | 'cancelled' | 'failed'
    commission: Mapped[float|None]        # Trade commission
    slippage: Mapped[float|None]          # Execution slippage
```

**Positions Table** (matches `Position` interface):
```python
class Position(Base):
    __tablename__ = "positions"
    
    id: Mapped[str]                       # Primary key (UUID string)
    bot_id: Mapped[str]                   # FK → bots.id
    symbol: Mapped[str]                   # Stock symbol
    quantity: Mapped[int]                 # Number of shares
    entry_price: Mapped[float]            # Average entry price
    current_price: Mapped[float]          # Current market price
    stop_loss_price: Mapped[float|None]   # Stop-loss level
    take_profit_price: Mapped[float|None] # Take-profit level
    unrealized_pnl: Mapped[float]         # Unrealized P&L
    realized_pnl: Mapped[float]           # Realized P&L
    opened_at: Mapped[datetime]           # Open timestamp
    closed_at: Mapped[datetime|None]      # Close timestamp (null if open)
    is_open: Mapped[bool]                 # Open/closed flag
```

**Database Indexes** (per ARCHITECTURE.md Implementation Notes):
- `trades`: Index on `bot_id`, `symbol`, `timestamp`, `status`
- `positions`: Index on `bot_id`, `symbol`, `is_open`
- `bots`: Index on `status`

#### 2.3 Set Up Alembic
```bash
cd backend
alembic init alembic
```
- Configure `alembic.ini` with async driver
- Configure `alembic/env.py` to use async engine and import `Base.metadata`
- Generate initial migration: `alembic revision --autogenerate -m "initial_schema"`
- Apply: `alembic upgrade head`

### Acceptance Criteria
- [ ] All three tables created in PostgreSQL with correct column types
- [ ] JSON columns work for `indicators`, `risk_management`, `symbols`, `indicators_snapshot`
- [ ] Foreign key constraints: `trades.bot_id → bots.id`, `positions.bot_id → bots.id`
- [ ] Indexes created on key fields
- [ ] Alembic migration applies cleanly

---

## Phase 3: Pydantic Schemas & API Contracts

**Goal**: Define Pydantic v2 schemas that exactly match the frontend TypeScript types.

### Tasks

#### 3.1 Create `app/schemas.py`

Must match these frontend types **exactly**:

**Bot Schemas**:
```python
class RiskManagementSchema(BaseModel):
    stop_loss: float
    take_profit: float
    max_position_size: float
    max_daily_loss: float
    max_concurrent_positions: int | None = None

class BotCreateSchema(BaseModel):
    """Matches frontend BotFormData"""
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
    """Same as create — frontend sends full object on update"""
    pass

class BotResponseSchema(BaseModel):
    """Matches frontend Bot interface"""
    id: str
    name: str
    status: Literal['running', 'paused', 'stopped', 'error']
    capital: float
    trading_frequency: int
    indicators: dict[str, Any]
    risk_management: RiskManagementSchema
    symbols: list[str]
    start_hour: int
    start_minute: int
    end_hour: int
    end_minute: int
    created_at: str       # ISO 8601 string
    updated_at: str       # ISO 8601 string
    last_run_at: str | None = None
    is_active: bool
    error_count: int
```

**Trade Schemas**:
```python
class TradeResponseSchema(BaseModel):
    """Matches frontend Trade interface"""
    id: str
    bot_id: str
    symbol: str
    type: Literal['buy', 'sell']
    quantity: int
    price: float
    timestamp: str           # ISO 8601 string
    indicators_snapshot: dict[str, Any] | None = None
    profit_loss: float | None = None
    order_id: str | None = None
    status: Literal['pending', 'filled', 'cancelled', 'failed']
    commission: float | None = None
    slippage: float | None = None

class TradeListResponseSchema(BaseModel):
    """Paginated trade response matching UseTradesResult"""
    trades: list[TradeResponseSchema]
    pagination: PaginationSchema

class PaginationSchema(BaseModel):
    """Matches frontend TradePagination"""
    page: int
    pageSize: int       # Note: camelCase to match frontend
    totalItems: int     # Note: camelCase to match frontend
    totalPages: int     # Note: camelCase to match frontend
```

**Position Schemas**:
```python
class PositionResponseSchema(BaseModel):
    """Matches frontend Position interface"""
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
    opened_at: str           # ISO 8601 string
    closed_at: str | None = None
    is_open: bool
```

**Summary Stats Schema**:
```python
class SummaryStatsSchema(BaseModel):
    """Matches frontend SummaryStats interface"""
    total_pnl: float
    pnl_percentage: float
    active_bots: int
    paused_bots: int | None = None
    stopped_bots: int | None = None
    open_positions: int
    positions_value: float
    total_trades_today: int | None = None
    win_rate: float | None = None
```

**Market Status Schema**:
```python
class MarketStatusSchema(BaseModel):
    """Matches frontend MarketStatus interface"""
    is_open: bool
    next_open: str | None = None
    next_close: str | None = None
    time_until_close: str | None = None
```

**Trade Stats Schema**:
```python
class TradeStatsSchema(BaseModel):
    """Matches frontend TradeStats interface"""
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
```

**Analytics Schemas**:
```python
class AnalyticsOverviewSchema(BaseModel):
    """Matches frontend AnalyticsOverview interface"""
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

class AnalyticsDataSchema(BaseModel):
    """Matches frontend AnalyticsData interface"""
    overview: AnalyticsOverviewSchema
    pnlTimeSeries: list[AnalyticsPnLDataPointSchema]
    botPerformance: list[BotPerformanceDataSchema]
    symbolPerformance: list[SymbolPerformanceDataSchema]
```

> **Critical Note on Field Naming**: The frontend uses **mixed conventions**:
> - Database fields use `snake_case` (`bot_id`, `profit_loss`, `entry_price`)
> - Aggregated/computed stats use `camelCase` (`totalPnL`, `winRate`, `pageSize`)
> 
> The Pydantic schemas must match these exactly. Use `model_config = ConfigDict(populate_by_name=True)` where needed.

### Acceptance Criteria
- [ ] All schemas match frontend TypeScript interfaces field-for-field
- [ ] JSON serialization produces exact same shape as mock data
- [ ] Optional fields default to `None`
- [ ] Datetime fields serialize to ISO 8601 strings

---

## Phase 4: Bot Management API

**Goal**: Full CRUD + lifecycle control for trading bots.

### Frontend API Contract (from `api.ts`):
```typescript
getBots:    () => GET  /api/bots                → Bot[]
getBot:     (id) => GET  /api/bots/{id}          → Bot
createBot:  (data) => POST /api/bots             → Bot
updateBot:  (id, data) => PUT  /api/bots/{id}    → Bot
deleteBot:  (id) => DELETE /api/bots/{id}         → { success: boolean }
startBot:   (id) => POST /api/bots/{id}/start     → { success: boolean }
stopBot:    (id) => POST /api/bots/{id}/stop      → { success: boolean }
pauseBot:   (id) => POST /api/bots/{id}/pause     → { success: boolean }
```

### Tasks

#### 4.1 Create `app/routers/bots.py`

| Endpoint | Method | Request Body | Response | Notes |
|----------|--------|-------------|----------|-------|
| `/api/bots` | GET | — | `list[BotResponseSchema]` | Return all bots, ordered by `created_at` desc |
| `/api/bots` | POST | `BotCreateSchema` | `BotResponseSchema` | Generate UUID, set status='stopped', is_active=false, error_count=0 |
| `/api/bots/{id}` | GET | — | `BotResponseSchema` | 404 if not found |
| `/api/bots/{id}` | PUT | `BotUpdateSchema` | `BotResponseSchema` | 404 if not found; update `updated_at` |
| `/api/bots/{id}` | DELETE | — | `{"success": true}` | 404 if not found; also delete related trades & positions (or cascade) |
| `/api/bots/{id}/start` | POST | — | `{"success": true}` | Set status='running', is_active=true; trigger trading engine start for this bot |
| `/api/bots/{id}/stop` | POST | — | `{"success": true}` | Set status='stopped', is_active=false; stop trading engine for this bot |
| `/api/bots/{id}/pause` | POST | — | `{"success": true}` | Set status='paused'; pause trading engine for this bot |

#### 4.2 Business Logic

- **Start Bot**: 
  - Validate bot has valid configuration (symbols, indicators, risk management)
  - Set `status = 'running'`, `is_active = True`, `updated_at = now()`
  - Register bot with the Trading Engine (Phase 10)
  - Emit `bot_status_changed` WebSocket event
  
- **Stop Bot**:
  - Set `status = 'stopped'`, `is_active = False`, `updated_at = now()`
  - Unregister bot from Trading Engine
  - Emit `bot_status_changed` WebSocket event
  
- **Pause Bot**:
  - Set `status = 'paused'`, `updated_at = now()`
  - Pause bot in Trading Engine (stop processing signals but keep subscriptions)
  - Emit `bot_status_changed` WebSocket event

- **Delete Bot**:
  - Only allow deletion if bot is stopped
  - CASCADE delete trades and positions, or soft-delete

### Acceptance Criteria
- [ ] All 8 endpoints return correct response shapes
- [ ] Frontend can flip `USE_MOCK = false` in `useBots.ts` and all operations work
- [ ] Bot status changes emit WebSocket events
- [ ] Validation errors return 422 with descriptive messages
- [ ] 404 returned for non-existent bot IDs

---

## Phase 5: Trade Management API

**Goal**: Trade history with filtering, sorting, pagination, and statistics.

### Frontend API Contract:
```typescript
getTrades: (params?) => GET /api/trades?...filters... → { trades: Trade[], pagination: {...} }
getTrade:  (id) => GET /api/trades/{id}               → Trade
// Stats called via: GET /api/trades/stats?...filters...
```

### Query Parameters (from `useTrades.ts` hook):
```
dateRange:      'today' | 'week' | 'month' | 'all' | 'custom'
customStartDate: string (ISO date, when dateRange='custom')
customEndDate:   string (ISO date, when dateRange='custom')
botId:           string ('' means all)
symbol:          string ('' means all)
type:            'all' | 'buy' | 'sell'
sortField:       'timestamp' | 'symbol' | 'type' | 'quantity' | 'price' | 'profit_loss'
sortDirection:   'asc' | 'desc'
page:            number (1-based)
pageSize:        number
```

### Tasks

#### 5.1 Create `app/routers/trades.py`

| Endpoint | Method | Query Params | Response | Notes |
|----------|--------|-------------|----------|-------|
| `/api/trades` | GET | All filter/sort/pagination params above | `TradeListResponseSchema` | Server-side filtering, sorting, pagination |
| `/api/trades/{id}` | GET | — | `TradeResponseSchema` | 404 if not found |
| `/api/trades/stats` | GET | Same filter params (no pagination) | `TradeStatsSchema` | Computed statistics |

#### 5.2 Server-side Query Building

Build SQLAlchemy queries with:
- **Date range filtering**: Convert preset ranges to date bounds
- **Bot filter**: `WHERE bot_id = :botId` (skip if empty)
- **Symbol filter**: `WHERE symbol = :symbol` (skip if empty)
- **Type filter**: `WHERE type = :type` (skip if not 'all')
- **Sorting**: `ORDER BY {sortField} {sortDirection}`
- **Pagination**: `OFFSET/LIMIT` with total count query

#### 5.3 Trade Statistics Computation

Compute on the server side (mirroring frontend's `useTradeStats.ts` logic):
- Total trades, winning trades, losing trades
- Win rate percentage
- Total P&L, average P&L
- Best/worst trade
- Average win, average loss
- Profit factor
- P&L by date (with cumulative)
- P&L by symbol (with win rates)
- P&L by bot (with bot names)

### Acceptance Criteria
- [ ] `GET /api/trades` returns paginated, filtered, sorted results
- [ ] Pagination response matches `TradePagination` type exactly (camelCase: `pageSize`, `totalItems`, `totalPages`)
- [ ] `GET /api/trades/stats` computes accurate statistics
- [ ] Frontend can flip `USE_MOCK = false` in `useTrades.ts` and `useTradeStats.ts`
- [ ] CSV export hook (`useAllFilteredTrades`) works with `pageSize=99999`

---

## Phase 6: Position Management API

**Goal**: Open positions listing, filtering, and position closing.

### Frontend API Contract:
```typescript
getPositions:  (params?) => GET  /api/positions?...filters... → Position[]
getPosition:   (id) => GET  /api/positions/{id}                → Position
closePosition: (id) => POST /api/positions/{id}/close           → { success: boolean }
```

### Query Parameters (from `usePositions.ts`):
```
botId:    string (optional)
symbol:   string (optional)
sortBy:   'symbol' | 'unrealized_pnl' | 'entry_price' | 'current_price' | 'opened_at'
sortOrder: 'asc' | 'desc'
```

### Tasks

#### 6.1 Create `app/routers/positions.py`

| Endpoint | Method | Query Params | Response | Notes |
|----------|--------|-------------|----------|-------|
| `/api/positions` | GET | `botId`, `symbol`, `sortBy`, `sortOrder` | `list[PositionResponseSchema]` | Default: open positions only (`is_open=true`) |
| `/api/positions/{id}` | GET | — | `PositionResponseSchema` | 404 if not found |
| `/api/positions/{id}/close` | POST | — | `{"success": true}` | Close position: set `is_open=false`, `closed_at=now()`, move unrealized→realized P&L |

#### 6.2 Position Closing Logic
1. Find position by ID, verify it's open
2. Execute sell order via Alpaca API (in live mode)
3. Set `is_open = False`, `closed_at = now()`
4. Set `realized_pnl = unrealized_pnl`, `unrealized_pnl = 0`
5. Create a corresponding sell `Trade` record
6. Emit `position_updated` WebSocket event
7. Return success

### Acceptance Criteria
- [ ] `GET /api/positions` returns open positions with correct filters
- [ ] Position closing updates DB and emits WebSocket event
- [ ] Frontend can flip `USE_MOCK = false` in `usePositions.ts`
- [ ] Refetch interval (30s auto-refresh) returns fresh data

---

## Phase 7: Market Data API & Dashboard Summary

**Goal**: Market status, per-symbol data, and dashboard summary statistics.

### Frontend API Contract:
```typescript
getMarketStatus: () => GET /api/market-status  → MarketStatus
getMarketData:   (symbol) => GET /api/market-data/{symbol} → MarketData
// Summary (not explicitly in api.ts but used by useSummaryStats):
// GET /api/summary → SummaryStats
```

### Tasks

#### 7.1 Create `app/routers/market_data.py`

| Endpoint | Method | Response | Notes |
|----------|--------|----------|-------|
| `/api/market-status` | GET | `MarketStatusSchema` | Query Alpaca clock API |
| `/api/market-data/{symbol}` | GET | Market data object | Query Alpaca for latest quote/bars |
| `/api/summary` | GET | `SummaryStatsSchema` | Aggregate from DB |

#### 7.2 Summary Statistics Computation (matches `mockSummaryStats`)

Query the database to compute:
```python
{
    "total_pnl": sum(trades.profit_loss) for all time,
    "pnl_percentage": total_pnl / total_capital * 100,
    "active_bots": count(bots WHERE status IN ('running', 'paused')),
    "paused_bots": count(bots WHERE status = 'paused'),
    "stopped_bots": count(bots WHERE status = 'stopped'),
    "open_positions": count(positions WHERE is_open = true),
    "positions_value": sum(positions.current_price * positions.quantity WHERE is_open),
    "total_trades_today": count(trades WHERE date(timestamp) = today),
    "win_rate": winning_trades / total_closed_trades * 100
}
```

#### 7.3 Market Status (Alpaca Integration)
```python
async def get_market_status():
    clock = alpaca_client.get_clock()
    return {
        "is_open": clock.is_open,
        "next_open": clock.next_open.isoformat() if not clock.is_open else None,
        "next_close": clock.next_close.isoformat() if clock.is_open else None,
        "time_until_close": str(clock.next_close - datetime.now()) if clock.is_open else None
    }
```

### Acceptance Criteria
- [ ] `/api/market-status` returns real Alpaca market clock data
- [ ] `/api/summary` computes accurate aggregate stats from DB
- [ ] Frontend `useSummaryStats` and `useMarketStatus` work with `USE_MOCK = false`

---

## Phase 8: WebSocket Real-time Layer

**Goal**: Socket.io server that broadcasts events the frontend subscribes to.

### Frontend Contract (from `websocket.ts`):
- Connects to `ws://localhost:8000/ws` using `socket.io-client`
- Transports: `['websocket']`
- Events subscribed to:
  - `trade_executed` — when a trade is executed
  - `position_updated` — when a position changes
  - `bot_status_changed` — when a bot starts/stops/pauses/errors
  - `price_update` — real-time price changes
  - `market_status_changed` — market open/close status changes

### Tasks

#### 8.1 Create `app/websocket_manager.py`

```python
import socketio

sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    ping_interval=25,
    ping_timeout=60,
)

# Wrap as ASGI app to mount on FastAPI
socket_app = socketio.ASGIApp(sio)

class WebSocketManager:
    """Singleton that broadcasts events to all connected clients"""
    
    async def emit_trade_executed(self, trade: dict):
        await sio.emit('trade_executed', trade)
    
    async def emit_position_updated(self, position: dict):
        await sio.emit('position_updated', position)
    
    async def emit_bot_status_changed(self, bot: dict):
        await sio.emit('bot_status_changed', bot)
    
    async def emit_price_update(self, data: dict):
        await sio.emit('price_update', data)
    
    async def emit_market_status_changed(self, status: dict):
        await sio.emit('market_status_changed', status)

ws_manager = WebSocketManager()
```

#### 8.2 Mount Socket.io in `main.py`
```python
from app.websocket_manager import socket_app

# Mount socket.io at /ws path
app.mount('/ws', socket_app)
```

#### 8.3 Socket.io Event Handlers
```python
@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")
```

### Event Payloads

| Event | Payload | Triggered By |
|-------|---------|-------------|
| `trade_executed` | `TradeResponseSchema` (dict) | Trading Engine after order fill |
| `position_updated` | `PositionResponseSchema` (dict) | Position open/close/price update |
| `bot_status_changed` | `{ id, status, is_active }` | Bot start/stop/pause/error |
| `price_update` | `{ symbol, price, timestamp }` | Alpaca WebSocket market data |
| `market_status_changed` | `MarketStatusSchema` (dict) | Market open/close detection |

### Acceptance Criteria
- [ ] Frontend `useWebSocket` hook connects successfully
- [ ] Events emitted from backend appear in frontend console
- [ ] Auto-reconnection works after disconnect
- [ ] Multiple concurrent clients receive all events

---

## Phase 9: Alpaca Client Integration

**Goal**: Wrapper around Alpaca API for order execution, account data, and market data.

### Tasks

#### 9.1 Create `app/alpaca_client.py`

```python
class AlpacaClient:
    """Wrapper around Alpaca API"""
    
    def __init__(self, api_key: str, secret_key: str, base_url: str):
        # Initialize alpaca-py client
        pass
    
    # === Account ===
    async def get_account(self) -> dict:
        """Get account information (buying power, equity, etc.)"""
    
    # === Orders ===
    async def submit_order(
        self, symbol: str, qty: int, side: str, 
        type: str = 'market', time_in_force: str = 'day'
    ) -> dict:
        """Submit a market/limit order"""
    
    async def get_order(self, order_id: str) -> dict:
        """Get order status"""
    
    async def cancel_order(self, order_id: str) -> dict:
        """Cancel an open order"""
    
    # === Positions ===
    async def get_positions(self) -> list[dict]:
        """Get all open positions from Alpaca"""
    
    async def close_position(self, symbol: str) -> dict:
        """Close a position for a symbol"""
    
    # === Market Data ===
    async def get_clock(self) -> dict:
        """Get market clock (open/close times)"""
    
    async def get_latest_quote(self, symbol: str) -> dict:
        """Get latest quote for a symbol"""
    
    async def get_bars(self, symbol: str, timeframe: str, limit: int) -> list[dict]:
        """Get historical bars for a symbol"""
    
    # === WebSocket (Market Data Stream) ===
    async def subscribe_to_trades(self, symbols: list[str], callback):
        """Subscribe to real-time trade data"""
    
    async def subscribe_to_quotes(self, symbols: list[str], callback):
        """Subscribe to real-time quote data"""
    
    async def unsubscribe(self, symbols: list[str]):
        """Unsubscribe from market data"""
```

#### 9.2 Error Handling
- Wrap all Alpaca calls in try/except
- Handle rate limiting (429 responses)
- Handle market closed errors
- Handle insufficient funds errors
- Log all API interactions

#### 9.3 Paper vs Live Mode
- Controlled by `ALPACA_BASE_URL` environment variable
- `https://paper-api.alpaca.markets` for paper trading
- `https://api.alpaca.markets` for live trading
- Add safety check: refuse live trading unless explicitly configured

### Acceptance Criteria
- [ ] Can submit market orders via Alpaca paper trading
- [ ] Can retrieve account info and positions
- [ ] Market clock returns correct open/close status
- [ ] Real-time market data streams work
- [ ] Error handling prevents crashes on API failures

---

## Phase 10: Trading Engine Core

**Goal**: The main orchestrator that runs bots, processes market data, and executes trades.

### Tasks

#### 10.1 Create `app/trading_engine.py`

```python
class TradingEngine:
    """
    Core trading orchestrator.
    Manages multiple bots running concurrently.
    """
    
    def __init__(
        self, 
        db_session_factory,
        alpaca_client: AlpacaClient,
        ws_manager: WebSocketManager
    ):
        self.bots: dict[str, BotRunner] = {}  # bot_id → BotRunner
        self.alpaca = alpaca_client
        self.ws_manager = ws_manager
        self.indicator_calculator = IndicatorCalculator()
        self.signal_generator = SignalGenerator()
        self.risk_manager = RiskManager()
        self._running = False
    
    async def start(self):
        """Start the engine — begin monitoring market hours"""
        self._running = True
        asyncio.create_task(self._market_monitor_loop())
    
    async def stop(self):
        """Stop the engine — halt all bots"""
        self._running = False
        for bot_id in list(self.bots.keys()):
            await self.stop_bot(bot_id)
    
    async def register_bot(self, bot_id: str):
        """Load bot config from DB and start running it"""
    
    async def unregister_bot(self, bot_id: str):
        """Stop and remove a bot"""
    
    async def pause_bot(self, bot_id: str):
        """Pause a bot (keep subscriptions, stop processing)"""
    
    async def _market_monitor_loop(self):
        """
        Continuously check market status.
        Start bots when market opens, stop when it closes.
        """
        while self._running:
            clock = await self.alpaca.get_clock()
            if clock.is_open:
                await self._activate_eligible_bots()
            else:
                await self._deactivate_all_bots()
            await asyncio.sleep(60)  # Check every minute
```

#### 10.2 Create `BotRunner` (inner class or separate)

```python
class BotRunner:
    """Runs a single bot's trading loop"""
    
    def __init__(self, bot_config: dict, engine: TradingEngine):
        self.config = bot_config
        self.engine = engine
        self.is_running = False
        self.is_paused = False
        self._task: asyncio.Task | None = None
    
    async def start(self):
        """Start the bot's trading loop"""
        self.is_running = True
        self._task = asyncio.create_task(self._trading_loop())
    
    async def stop(self):
        """Stop the bot's trading loop"""
        self.is_running = False
        if self._task:
            self._task.cancel()
    
    async def _trading_loop(self):
        """
        Main loop: runs every [trading_frequency] seconds
        
        For each cycle:
        1. Check if within trading window
        2. Fetch latest market data for symbols
        3. Calculate indicators
        4. Generate signals
        5. Apply risk management
        6. Execute trades if signals pass
        7. Update positions
        8. Broadcast updates via WebSocket
        """
        while self.is_running:
            if not self.is_paused and self._is_within_trading_window():
                try:
                    await self._process_cycle()
                except Exception as e:
                    await self._handle_error(e)
            
            await asyncio.sleep(self.config['trading_frequency'])
    
    async def _process_cycle(self):
        """Single trading cycle"""
        for symbol in self.config['symbols']:
            # 1. Get market data
            bars = await self.engine.alpaca.get_bars(symbol, '1Min', 100)
            
            # 2. Calculate indicators
            indicators = self.engine.indicator_calculator.calculate(
                bars, self.config['indicators']
            )
            
            # 3. Generate signals
            signal = self.engine.signal_generator.evaluate(
                indicators, self.config['indicators']
            )
            
            # 4. Risk check
            if signal and await self.engine.risk_manager.validate(
                signal, self.config, self.engine
            ):
                # 5. Execute trade
                await self._execute_trade(symbol, signal, indicators)
    
    def _is_within_trading_window(self) -> bool:
        """Check if current time is within bot's configured trading window"""
        now = datetime.now(tz=EST)
        start = now.replace(
            hour=self.config['start_hour'], 
            minute=self.config['start_minute']
        )
        end = now.replace(
            hour=self.config['end_hour'], 
            minute=self.config['end_minute']
        )
        return start <= now <= end
```

#### 10.3 Trade Execution Flow

```python
async def _execute_trade(self, symbol, signal, indicators):
    """
    1. Calculate position size based on risk management
    2. Submit order to Alpaca
    3. Wait for fill confirmation
    4. Create Trade record in DB
    5. Create/update Position record in DB
    6. Emit WebSocket events
    """
```

#### 10.4 Engine Lifecycle (in `main.py`)
```python
@app.on_event("startup")
async def startup():
    trading_engine = TradingEngine(...)
    app.state.trading_engine = trading_engine
    await trading_engine.start()
    # Load and register all bots with status='running'

@app.on_event("shutdown")
async def shutdown():
    await app.state.trading_engine.stop()
```

### Acceptance Criteria
- [ ] Engine starts on app startup and stops on shutdown
- [ ] Bots run their trading loops at configured intervals
- [ ] Market hours are respected (only trade during configured windows)
- [ ] Trades are logged to DB and broadcast via WebSocket
- [ ] Multiple bots can run concurrently
- [ ] Bot errors are caught and logged (don't crash the engine)

---

## Phase 11: Indicator Calculator

**Goal**: Calculate technical indicators using `pandas-ta`.

### Tasks

#### 11.1 Create `app/indicators.py`

```python
import pandas as pd
import pandas_ta as ta

class IndicatorCalculator:
    """Calculate technical indicators from price data"""
    
    def calculate(self, bars: list[dict], config: dict) -> dict:
        """
        Args:
            bars: List of OHLCV bars from Alpaca
            config: Bot's indicator configuration, e.g.:
                {
                    "RSI": {"period": 14, "oversold": 30, "overbought": 70},
                    "MACD": {"fast": 12, "slow": 26, "signal": 9},
                    "SMA": {"period": 50}
                }
        
        Returns:
            dict of indicator name → current value(s)
        """
        df = self._bars_to_dataframe(bars)
        results = {}
        
        for indicator_name, params in config.items():
            results[indicator_name] = self._calculate_indicator(
                df, indicator_name, params
            )
        
        return results
    
    def _calculate_indicator(self, df, name, params) -> dict:
        """Route to specific indicator calculation"""
        calculators = {
            'RSI': self._calc_rsi,
            'MACD': self._calc_macd,
            'SMA': self._calc_sma,
            'EMA': self._calc_ema,
            'Bollinger Bands': self._calc_bbands,
            'Stochastic': self._calc_stochastic,
            'OBV': self._calc_obv,
        }
        calc_fn = calculators.get(name)
        if calc_fn:
            return calc_fn(df, params)
        raise ValueError(f"Unknown indicator: {name}")
    
    def _calc_rsi(self, df, params) -> dict:
        period = params.get('period', 14)
        rsi = ta.rsi(df['close'], length=period)
        return {
            'value': float(rsi.iloc[-1]) if not rsi.empty else None,
            'period': period,
            'oversold': params.get('oversold', 30),
            'overbought': params.get('overbought', 70),
        }
    
    def _calc_macd(self, df, params) -> dict:
        fast = params.get('fast', 12)
        slow = params.get('slow', 26)
        signal = params.get('signal', 9)
        macd = ta.macd(df['close'], fast=fast, slow=slow, signal=signal)
        return {
            'macd': float(macd.iloc[-1, 0]) if not macd.empty else None,
            'signal': float(macd.iloc[-1, 1]) if not macd.empty else None,
            'histogram': float(macd.iloc[-1, 2]) if not macd.empty else None,
        }
    
    def _calc_sma(self, df, params) -> dict:
        period = params.get('period', 50)
        sma = ta.sma(df['close'], length=period)
        return {
            'value': float(sma.iloc[-1]) if not sma.empty else None,
            'period': period,
        }
    
    def _calc_ema(self, df, params) -> dict:
        period = params.get('period', 20)
        ema = ta.ema(df['close'], length=period)
        return {
            'value': float(ema.iloc[-1]) if not ema.empty else None,
            'period': period,
        }
    
    def _calc_bbands(self, df, params) -> dict:
        period = params.get('period', 20)
        std_dev = params.get('stdDev', 2)
        bbands = ta.bbands(df['close'], length=period, std=std_dev)
        return {
            'upper': float(bbands.iloc[-1, 0]) if not bbands.empty else None,
            'middle': float(bbands.iloc[-1, 1]) if not bbands.empty else None,
            'lower': float(bbands.iloc[-1, 2]) if not bbands.empty else None,
        }
    
    def _calc_stochastic(self, df, params) -> dict:
        k_period = params.get('kPeriod', 14)
        d_period = params.get('dPeriod', 3)
        stoch = ta.stoch(df['high'], df['low'], df['close'], k=k_period, d=d_period)
        return {
            'k': float(stoch.iloc[-1, 0]) if not stoch.empty else None,
            'd': float(stoch.iloc[-1, 1]) if not stoch.empty else None,
        }
    
    def _calc_obv(self, df, params) -> dict:
        obv = ta.obv(df['close'], df['volume'])
        return {
            'value': float(obv.iloc[-1]) if not obv.empty else None,
        }
```

### Acceptance Criteria
- [ ] All 7 indicators calculate correctly (RSI, MACD, SMA, EMA, Bollinger Bands, Stochastic, OBV)
- [ ] Handles insufficient data gracefully (returns None)
- [ ] Results are JSON-serializable for `indicators_snapshot`
- [ ] Unit tests pass for known datasets

---

## Phase 12: Signal Generator

**Goal**: Evaluate indicator values to produce buy/sell signals.

### Tasks

#### 12.1 Create `app/signal_generator.py`

```python
from enum import Enum

class Signal(Enum):
    BUY = 'buy'
    SELL = 'sell'
    HOLD = 'hold'

class SignalGenerator:
    """Generate trading signals from indicator values"""
    
    def evaluate(self, indicators: dict, config: dict) -> Signal | None:
        """
        Evaluate all indicators and generate a combined signal.
        
        Logic (from ARCHITECTURE.md):
        - Buy: RSI < oversold, MACD bullish crossover, price below lower BB, etc.
        - Sell: RSI > overbought, MACD bearish crossover, price above upper BB, etc.
        - Uses majority voting or configurable strategy
        """
        signals = []
        
        for indicator_name, values in indicators.items():
            signal = self._evaluate_single(indicator_name, values, config.get(indicator_name, {}))
            if signal != Signal.HOLD:
                signals.append(signal)
        
        return self._combine_signals(signals)
    
    def _evaluate_single(self, name: str, values: dict, params: dict) -> Signal:
        """Evaluate a single indicator"""
        if name == 'RSI':
            return self._eval_rsi(values, params)
        elif name == 'MACD':
            return self._eval_macd(values)
        elif name == 'SMA' or name == 'EMA':
            return self._eval_ma(values)
        elif name == 'Bollinger Bands':
            return self._eval_bbands(values)
        elif name == 'Stochastic':
            return self._eval_stochastic(values, params)
        return Signal.HOLD
    
    def _eval_rsi(self, values, params) -> Signal:
        rsi = values.get('value')
        if rsi is None:
            return Signal.HOLD
        if rsi < params.get('oversold', 30):
            return Signal.BUY
        if rsi > params.get('overbought', 70):
            return Signal.SELL
        return Signal.HOLD
    
    def _eval_macd(self, values) -> Signal:
        macd = values.get('macd')
        signal = values.get('signal')
        if macd is None or signal is None:
            return Signal.HOLD
        # Bullish: MACD crosses above signal
        if macd > signal:
            return Signal.BUY
        # Bearish: MACD crosses below signal
        if macd < signal:
            return Signal.SELL
        return Signal.HOLD
    
    def _combine_signals(self, signals: list[Signal]) -> Signal | None:
        """Majority voting — only act if majority agrees"""
        if not signals:
            return None
        buy_count = sum(1 for s in signals if s == Signal.BUY)
        sell_count = sum(1 for s in signals if s == Signal.SELL)
        
        threshold = len(signals) / 2
        if buy_count > threshold:
            return Signal.BUY
        if sell_count > threshold:
            return Signal.SELL
        return None  # No clear signal
```

### Acceptance Criteria
- [ ] RSI signals: buy below oversold, sell above overbought
- [ ] MACD signals: buy on bullish crossover, sell on bearish
- [ ] Combined signal uses majority voting
- [ ] Returns `None` when no clear signal (prevents unnecessary trades)
- [ ] Unit tests for each indicator's signal logic

---

## Phase 13: Risk Manager

**Goal**: Enforce risk management rules before executing trades.

### Tasks

#### 13.1 Create `app/risk_manager.py`

```python
class RiskManager:
    """Enforce risk management rules from ARCHITECTURE.md"""
    
    async def validate(
        self, 
        signal: Signal, 
        bot_config: dict,
        engine: 'TradingEngine',
        symbol: str,
        current_price: float
    ) -> bool:
        """
        Run all risk checks. Returns True if trade is allowed.
        
        Checks (from ARCHITECTURE.md):
        1. Position Sizing: max % of capital per position
        2. Stop-Loss: calculate stop-loss price
        3. Take-Profit: calculate take-profit price
        4. Daily Loss Limit: check if daily loss exceeds threshold
        5. Maximum Positions: check concurrent position count
        6. Capital Protection: verify sufficient capital
        """
        risk_config = bot_config['risk_management']
        
        checks = [
            self._check_position_size(signal, bot_config, current_price),
            await self._check_daily_loss_limit(bot_config, engine),
            await self._check_max_positions(bot_config, engine),
            self._check_capital_available(signal, bot_config, current_price),
        ]
        
        return all(checks)
    
    def _check_position_size(self, signal, config, price) -> bool:
        """Position size must not exceed max_position_size % of capital"""
        if signal != Signal.BUY:
            return True  # Only check for buys
        max_pct = config['risk_management']['max_position_size'] / 100
        max_amount = config['capital'] * max_pct
        # Will be compared against proposed order size
        return True  # Actual check in calculate_position_size
    
    async def _check_daily_loss_limit(self, config, engine) -> bool:
        """Stop trading if daily loss exceeds max_daily_loss %"""
        max_loss_pct = config['risk_management']['max_daily_loss'] / 100
        max_loss = config['capital'] * max_loss_pct
        
        today_pnl = await engine.get_today_pnl(config['id'])
        return today_pnl > -max_loss  # Continue if loss hasn't exceeded limit
    
    async def _check_max_positions(self, config, engine) -> bool:
        """Check concurrent open positions against limit"""
        max_positions = config['risk_management'].get('max_concurrent_positions')
        if max_positions is None:
            return True
        
        open_positions = await engine.get_open_position_count(config['id'])
        return open_positions < max_positions
    
    def _check_capital_available(self, signal, config, price) -> bool:
        """Never risk more than allocated capital"""
        if signal != Signal.BUY:
            return True
        # Check if bot has enough remaining capital for a position
        return True  # Detailed check with actual allocated vs used capital
    
    def calculate_position_size(self, config, current_price) -> int:
        """
        Calculate number of shares to buy based on:
        - max_position_size % of capital
        - current price
        """
        max_pct = config['risk_management']['max_position_size'] / 100
        max_amount = config['capital'] * max_pct
        shares = int(max_amount / current_price)
        return max(1, shares)  # At least 1 share
    
    def calculate_stop_loss(self, entry_price, config) -> float:
        """Calculate stop-loss price"""
        stop_loss_pct = config['risk_management']['stop_loss'] / 100
        return entry_price * (1 - stop_loss_pct)
    
    def calculate_take_profit(self, entry_price, config) -> float:
        """Calculate take-profit price"""
        take_profit_pct = config['risk_management']['take_profit'] / 100
        return entry_price * (1 + take_profit_pct)
```

### Acceptance Criteria
- [ ] Position sizing respects `max_position_size` percentage
- [ ] Daily loss limit stops trading when exceeded
- [ ] Maximum concurrent positions enforced
- [ ] Stop-loss and take-profit prices calculated correctly
- [ ] Capital protection prevents over-allocation
- [ ] Unit tests for each risk check

---

## Phase 14: Docker & Deployment

**Goal**: Containerize the backend and set up Docker Compose for the full stack.

### Tasks

#### 14.1 Create `backend/Dockerfile`
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### 14.2 Create `docker-compose.yml` (project root)
```yaml
version: '3.8'

services:
  # PostgreSQL Database
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: trading_bot
      POSTGRES_PASSWORD: trading_bot_pass
      POSTGRES_DB: trading_bot
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U trading_bot"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Redis Cache (optional)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  # FastAPI Backend
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://trading_bot:trading_bot_pass@db:5432/trading_bot
      REDIS_URL: redis://redis:6379
      ALPACA_API_KEY: ${ALPACA_API_KEY}
      ALPACA_SECRET_KEY: ${ALPACA_SECRET_KEY}
      ALPACA_BASE_URL: ${ALPACA_BASE_URL:-https://paper-api.alpaca.markets}
      ENVIRONMENT: development
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./backend:/app  # Hot reload in development
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  # React Frontend
  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:8000/api
      VITE_WS_URL: ws://localhost:8000/ws
    depends_on:
      - backend
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm run dev -- --host

volumes:
  pgdata:
```

#### 14.3 Create Database Initialization Script
```bash
#!/bin/bash
# scripts/init-db.sh
# Run after docker-compose up

docker-compose exec backend alembic upgrade head
echo "Database migrations applied successfully"
```

### Acceptance Criteria
- [ ] `docker-compose up` starts all 4 services
- [ ] Backend connects to PostgreSQL and Redis
- [ ] Frontend connects to backend API
- [ ] Database migrations run successfully
- [ ] Hot reload works in development mode

---

## Phase 15: Testing & Hardening

**Goal**: Comprehensive testing and production readiness.

### Tasks

#### 15.1 Unit Tests
- **Indicators**: Test each indicator calculation against known values
- **Signal Generator**: Test signal logic for each indicator type
- **Risk Manager**: Test all risk checks (position sizing, daily loss, etc.)
- **Schemas**: Test serialization matches frontend types

#### 15.2 Integration Tests
- **API Endpoints**: Test all CRUD operations, filtering, pagination
- **WebSocket**: Test event emission and reception
- **Database**: Test migrations, queries, indexes

#### 15.3 Error Handling
- Global exception handler in FastAPI
- Structured error responses: `{"detail": "message", "error_code": "CODE"}`
- Alpaca API error handling (rate limits, market closed, insufficient funds)
- Database connection error handling (retry logic)

#### 15.4 Logging
- Structured JSON logging with `structlog`
- Log all: API requests, trade executions, bot state changes, errors
- Separate log levels: DEBUG for development, INFO for production

#### 15.5 Performance
- Database connection pooling (SQLAlchemy pool_size, max_overflow)
- Query optimization: ensure indexes are used
- Async everywhere: no blocking calls in the event loop
- API response time < 100ms for CRUD operations

### Acceptance Criteria
- [ ] >80% test coverage on business logic
- [ ] All API endpoints have integration tests
- [ ] Error responses are structured and informative
- [ ] Logging captures all important events
- [ ] No blocking I/O calls in async code

---

## Frontend Integration Checklist

When the backend is ready, flip `USE_MOCK = false` in each frontend hook:

| Frontend File | Hook | Backend Dependency | Phase |
|---|---|---|---|
| `hooks/useBots.ts` | `useBots`, `useBot`, `useCreateBot`, `useUpdateBot`, `useDeleteBot`, `useStartBot`, `useStopBot`, `usePauseBot` | Bot CRUD API | Phase 4 |
| `hooks/useTrades.ts` | `useTrades`, `useAllFilteredTrades` | Trade List API with filtering/pagination | Phase 5 |
| `hooks/useTradeStats.ts` | `useTradeStats` | Trade Stats API | Phase 5 |
| `hooks/usePositions.ts` | `usePositions`, `usePosition`, `useClosePosition` | Position API | Phase 6 |
| `hooks/useSummaryStats.ts` | `useSummaryStats` | Summary API | Phase 7 |
| `hooks/useMarketStatus.ts` | `useMarketStatus` | Market Status API | Phase 7 |
| `hooks/useWebSocket.ts` | `useWebSocket` | WebSocket Server | Phase 8 |
| `hooks/useRealtimeDashboard.ts` | `useRealtimeDashboard` | WebSocket Events | Phase 8 |
| `hooks/useRealtimePositions.ts` | `useRealtimePositions` | WebSocket Events | Phase 8 |
| `hooks/useRecentTrades.ts` | `useRecentTrades` | Trade List API | Phase 5 |
| `hooks/useAnalytics.ts` | `useAnalytics` | Analytics API (or compute server-side) | Phase 5 + Phase 7 |

### Analytics API Decision

The `useAnalytics` hook currently computes analytics on the frontend from trades. Two options:

**Option A: Server-side computation (Recommended)**
- Add `GET /api/analytics?timeRange=1W|1M|3M|6M|1Y|ALL` endpoint
- Returns `AnalyticsDataSchema` with all computed metrics
- More efficient for large datasets
- Add to `api.ts`: `getAnalytics: (timeRange) => apiClient.get('/analytics', { params: { timeRange } })`

**Option B: Client-side computation (Current)**
- Keep current logic in `useAnalytics.ts`
- Just needs `GET /api/trades` to return all trades
- Simpler but slower with large datasets

**Recommendation**: Start with Option B (no new endpoint needed), migrate to Option A when trade volume grows.

---

## File Structure Reference

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # Phase 1: FastAPI app, CORS, routers, lifecycle
│   ├── config.py               # Phase 1: Settings from env vars
│   ├── database.py             # Phase 2: Async engine, session, Base
│   ├── models.py               # Phase 2: SQLAlchemy ORM models (Bot, Trade, Position)
│   ├── schemas.py              # Phase 3: Pydantic schemas matching frontend types
│   ├── dependencies.py         # Phase 1: Shared deps (get_db, get_engine, etc.)
│   ├── alpaca_client.py        # Phase 9: Alpaca API wrapper
│   ├── trading_engine.py       # Phase 10: Core orchestrator + BotRunner
│   ├── indicators.py           # Phase 11: pandas-ta indicator calculations
│   ├── signal_generator.py     # Phase 12: Signal generation logic
│   ├── risk_manager.py         # Phase 13: Risk management enforcement
│   ├── websocket_manager.py    # Phase 8: Socket.io event broadcasting
│   └── routers/
│       ├── __init__.py
│       ├── bots.py             # Phase 4: Bot CRUD + start/stop/pause
│       ├── trades.py           # Phase 5: Trade history + stats + filters
│       ├── positions.py        # Phase 6: Position management
│       └── market_data.py      # Phase 7: Market status + data + summary
├── alembic/                    # Phase 2: Database migrations
│   ├── env.py
│   ├── versions/
│   └── alembic.ini
├── tests/                      # Phase 15: Tests
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_bots.py
│   ├── test_trades.py
│   ├── test_positions.py
│   ├── test_market_data.py
│   ├── test_indicators.py
│   ├── test_risk_manager.py
│   └── test_trading_engine.py
├── requirements.txt            # Phase 1: Python dependencies
├── Dockerfile                  # Phase 14: Container definition
├── .env.example                # Phase 1: Environment variable template
└── README.md
```

---

## Implementation Order & Dependencies

```
Phase 1: Foundation ─────────────────────────────────┐
    │                                                 │
Phase 2: Database ──┐                                 │
    │               │                                 │
Phase 3: Schemas ───┤                                 │
    │               │                                 │
    ├───────────────┼── Phase 4: Bot API              │
    │               │                                 │
    ├───────────────┼── Phase 5: Trade API            │
    │               │                                 │
    ├───────────────┼── Phase 6: Position API         │
    │               │                                 │
    └───────────────┼── Phase 7: Market Data API      │
                    │                                 │
Phase 8: WebSocket ─┤                                 │
                    │                                 │
Phase 9: Alpaca ────┤                                 │
                    │                                 │
                    └── Phase 10: Trading Engine ─────┤
                            │                         │
                        Phase 11: Indicators          │
                            │                         │
                        Phase 12: Signals             │
                            │                         │
                        Phase 13: Risk Manager        │
                                                      │
                        Phase 14: Docker ─────────────┘
                            │
                        Phase 15: Testing
```

### Recommended Sprint Grouping

| Sprint | Phases | Goal | Est. Effort |
|--------|--------|------|-------------|
| **Sprint 1** | 1, 2, 3 | Foundation: project setup, DB, schemas | 2-3 days |
| **Sprint 2** | 4, 5 | Core APIs: bots and trades | 2-3 days |
| **Sprint 3** | 6, 7, 8 | Remaining APIs + WebSocket | 2-3 days |
| **Sprint 4** | 9, 10 | Alpaca integration + Trading Engine | 3-4 days |
| **Sprint 5** | 11, 12, 13 | Indicators, signals, risk management | 2-3 days |
| **Sprint 6** | 14, 15 | Docker, testing, hardening | 2-3 days |

**Total estimated effort: ~14-19 days**

---

## Critical Notes

### 1. Field Naming Convention
The frontend uses **mixed conventions**. The backend Pydantic schemas must match exactly:
- **Entity fields**: `snake_case` (`bot_id`, `profit_loss`, `entry_price`, `is_open`)
- **Pagination/stats**: `camelCase` (`pageSize`, `totalItems`, `totalPnL`, `winRate`)

### 2. ID Format
The frontend generates IDs like `bot-${Date.now()}` in mock mode. The backend should use **UUID strings** (e.g., `uuid4().hex` or `f"bot-{uuid4().hex[:8]}"`). The frontend only cares that IDs are strings.

### 3. Timestamp Format
All timestamps must be **ISO 8601 strings** (e.g., `"2026-02-15T10:23:00Z"`). The frontend parses them with `new Date(timestamp)`.

### 4. Frontend Base URL
The frontend's `api.ts` calls `http://localhost:8000/api` — so all backend routes must be prefixed with `/api`.

### 5. WebSocket URL
The frontend connects to `ws://localhost:8000/ws` — the socket.io server must be mounted at `/ws`.

### 6. CORS
Must allow `http://localhost:5173` (Vite dev server) and `http://localhost:3000`.

---

*This plan is derived from `Plans/ARCHITECTURE.md` and the existing frontend implementation. Keep both in sync per `Plans/ARCHITECTURE_MAINTENANCE.md`.*
