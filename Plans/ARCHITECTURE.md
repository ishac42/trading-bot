# Auto Trading Bot - Architecture & Technology Stack

> **📌 Maintenance Note**: This document must stay synchronized with `ARCHITECTURE_DIAGRAMS.html` and `SYSTEM_ARCHITECTURE_DIAGRAMS.md`. See `ARCHITECTURE_MAINTENANCE.md` for sync guidelines.

## Overview
A multi-bot stock trading system that uses technical indicators to execute trades during the first few hours of market open. Each bot can be independently configured with different indicators, trading frequency, capital allocation, and risk management parameters.

## Technology Stack

### Backend
- **Framework**: FastAPI (Python 3.11+)
  - High performance async framework
  - Automatic API documentation (Swagger/OpenAPI)
  - WebSocket support for real-time updates
  - Type validation with Pydantic

- **Database**: PostgreSQL
  - Relational database for bot configurations, trade history
  - ACID compliance for financial data integrity
  - JSON columns for flexible indicator/risk config storage

- **ORM**: SQLAlchemy
  - Database abstraction layer
  - Migration support with Alembic

- **Trading API**: Alpaca Trade API
  - Commission-free stock trading
  - Paper trading for testing
  - Real-time market data via WebSocket
  - REST API for order execution

- **Technical Indicators**: pandas-ta
  - Comprehensive indicator library (RSI, MACD, Bollinger Bands, etc.)
  - Built on pandas/numpy for performance
  - Easy to extend with custom indicators

- **Real-time Data**: Alpaca WebSocket Streams
  - Live price updates
  - Trade execution confirmations
  - Account updates

- **Caching/Queue**: Redis (optional)
  - Real-time data caching
  - Pub/sub for distributed systems
  - Rate limiting

### Frontend
- **Framework**: React 18+ with TypeScript
  - Component-based UI
  - Type safety
  - Modern hooks API

- **UI Library**: Material-UI (MUI) or Tailwind CSS
  - Pre-built components
  - Responsive design
  - Professional look

- **Charts**: TradingView Lightweight Charts or Recharts
  - Real-time price charts
  - Technical indicator overlays
  - Performance optimized

- **State Management**: React Query / TanStack Query
  - Server state management
  - Automatic caching and refetching
  - Optimistic updates

- **WebSocket Client**: socket.io-client
  - Real-time dashboard updates
  - Live trade notifications
  - Position updates
  - Bot status changes
  - Market status updates

### Infrastructure & Deployment
- **Containerization**: Docker & Docker Compose
  - Consistent development/production environments
  - Easy deployment
  - Separate containers for frontend, backend, database, and cache

- **Deployment Architecture**:
  - **Frontend Container**: React app (Vite build) served via Nginx
  - **Backend Container**: FastAPI app running on Uvicorn
  - **Database Container**: PostgreSQL with persistent volumes
  - **Cache Container**: Redis (optional but recommended)
  - **External Services**: Alpaca API (cloud-hosted)

- **Cloud Platform**: AWS / GCP / Azure
  - EC2/Compute Engine for application server
  - RDS/Cloud SQL for PostgreSQL
  - ElastiCache/Cloud Memorystore for Redis (optional)
  - Load balancer for horizontal scaling

- **Process Management**: 
  - Systemd (Linux) for service management
  - PM2 (Node.js process manager for frontend if needed)
  - Container orchestration (Kubernetes/ECS) for production
  - Health checks and auto-restart on failure

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Dashboard   │  │ Bot Config   │  │  Trade Log   │      │
│  │   (Charts)   │  │     UI       │  │   Viewer     │      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Bot Router  │  │ Trade Router │  │ Market Data  │      │
│  │  (CRUD)      │  │  (History)   │  │   Router     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                              │                              │
│                    ┌─────────┴─────────┐                   │
│                    │  Trading Engine   │                   │
│                    │  (Core Logic)     │                   │
│                    └─────────┬─────────┘                   │
└──────────────────────────────┼──────────────────────────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
        ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
        │  PostgreSQL │ │   Alpaca    │ │    Redis    │
        │  Database   │ │     API     │ │   (Cache)   │
        └─────────────┘ └─────────────┘ └─────────────┘
```

## Core Components

### 1. Trading Engine
**Purpose**: Core logic that processes market data, calculates indicators, and executes trades

**Responsibilities**:
- Monitor market hours (9:30 AM - 12:00 PM EST)
- Subscribe to real-time price data for configured symbols
- Calculate technical indicators for each symbol
- Evaluate trading signals based on indicator configurations
- Execute buy/sell orders via Alpaca API
- Apply risk management rules (stop-loss, take-profit, position sizing)
- Log all trades to database
- Emit real-time updates via WebSocket

**Key Classes**:
- `TradingEngine`: Main orchestrator
- `IndicatorCalculator`: Technical indicator computations
- `SignalGenerator`: Trading signal logic
- `RiskManager`: Risk management enforcement
- `OrderExecutor`: Alpaca API interaction

### 2. Bot Management API
**Purpose**: CRUD operations for trading bots

**Endpoints**:
- `GET /api/bots` - List all bots
- `POST /api/bots` - Create new bot
- `GET /api/bots/{id}` - Get bot details
- `PUT /api/bots/{id}` - Update bot configuration
- `DELETE /api/bots/{id}` - Delete bot
- `POST /api/bots/{id}/start` - Start bot
- `POST /api/bots/{id}/stop` - Stop bot
- `POST /api/bots/{id}/pause` - Pause bot

### 2.1 Trade Management API
**Purpose**: Trade history and statistics

**Endpoints**:
- `GET /api/trades` - List trades (with filters: date range, bot, symbol, type)
- `GET /api/trades/{id}` - Get trade details
- `GET /api/trades/stats` - Get trade statistics (win rate, P&L, etc.)

### 2.2 Position Management API
**Purpose**: Open positions management

**Endpoints**:
- `GET /api/positions` - List open positions (with filters: bot, symbol)
- `GET /api/positions/{id}` - Get position details
- `POST /api/positions/{id}/close` - Close a position

### 2.3 Market Data API
**Purpose**: Market status and data

**Endpoints**:
- `GET /api/market-status` - Get current market status
- `GET /api/market-data/{symbol}` - Get market data for symbol
- `GET /api/summary` - Get dashboard summary statistics

### 2.4 WebSocket Endpoints
**Purpose**: Real-time updates

**Endpoints**:
- `WS /ws` - WebSocket connection (socket.io protocol)
  - Events: `trade_executed`, `position_updated`, `bot_status_changed`, `price_update`, `market_status_changed`

**Bot Configuration Schema**:
```json
{
  "name": "Momentum Bot",
  "capital": 10000,
  "trading_frequency": 60,
  "symbols": ["AAPL", "MSFT", "GOOGL"],
  "indicators": {
    "RSI": {"period": 14, "oversold": 30, "overbought": 70},
    "MACD": {"fast": 12, "slow": 26, "signal": 9},
    "SMA": {"period": 50}
  },
  "risk_management": {
    "stop_loss": 0.02,
    "take_profit": 0.05,
    "max_position_size": 0.1,
    "max_daily_loss": 0.1
  },
  "start_hour": 9,
  "start_minute": 30,
  "end_hour": 12,
  "end_minute": 0
}
```

### 3. Database Schema

**Bots Table**:
- `id`: Primary key
- `name`: Bot name
- `status`: stopped/running/paused/error
- `capital`: Allocated capital
- `trading_frequency`: Seconds between checks
- `indicators`: JSON configuration
- `risk_management`: JSON configuration
- `symbols`: JSON array of stock symbols
- `start_hour`, `start_minute`, `end_hour`, `end_minute`: Trading window
- `created_at`, `updated_at`: Timestamps

**Trades Table**:
- `id`: Primary key
- `bot_id`: Foreign key to bots
- `symbol`: Stock symbol
- `type`: buy/sell
- `quantity`: Number of shares
- `price`: Execution price
- `timestamp`: Trade time
- `indicators_snapshot`: Indicator values at trade time
- `profit_loss`: P&L for closed positions
- `order_id`: Alpaca order ID (optional)
- `status`: pending/filled/cancelled/failed
- `commission`: Trade commission (optional)
- `slippage`: Execution slippage (optional)

**Positions Table**:
- `id`: Primary key
- `bot_id`: Foreign key to bots
- `symbol`: Stock symbol
- `quantity`: Number of shares
- `entry_price`: Average entry price
- `current_price`: Current market price (updated in real-time)
- `stop_loss_price`: Stop-loss price level
- `take_profit_price`: Take-profit price level
- `unrealized_pnl`: Current unrealized profit/loss
- `realized_pnl`: Realized profit/loss (for closed positions)
- `opened_at`: Position open timestamp
- `closed_at`: Position close timestamp (null if open)
- `is_open`: Boolean flag for open/closed status

### 4. Frontend Components

**Dashboard**:
- Real-time price charts with indicator overlays
- Active bots status cards
- Recent trades table
- P&L summary
- Market status indicator

**Bot Configuration UI**:
- Form to create/edit bots
- Indicator selector with parameters
- Risk management settings
- Symbol picker
- Trading window configuration
- Capital allocation input

**Trade History**:
- Filterable trade log (by date range, bot, symbol, type)
- Sortable and paginated trade table
- Trade detail modal with full information
- P&L analysis with charts
- Trade statistics (win rate, profit factor, etc.)
- CSV export functionality
- URL query params for shareable filter states

**Positions Page**:
- Summary bar (total positions, value, unrealized P&L)
- Filterable positions table (by bot, symbol, sort order)
- Responsive design (table on desktop, cards on mobile)
- Position detail modal with price chart
- Real-time position updates via WebSocket
- Position closing functionality
- TradingView Lightweight Charts integration

**Analytics Page**:
- Performance overview with key metrics
- Cumulative P&L chart (daily/cumulative toggle)
- Bot performance comparison (chart + table)
- Symbol performance breakdown (chart + table)
- Time range filtering (1W, 1M, 3M, 6M, 1Y, ALL)
- Advanced metrics (Sharpe ratio, profit factor, max drawdown)

## Technical Indicators Supported

### Momentum Indicators
- **RSI (Relative Strength Index)**: Overbought/oversold conditions
- **MACD (Moving Average Convergence Divergence)**: Trend changes
- **Stochastic Oscillator**: Momentum indicator

### Trend Indicators
- **SMA (Simple Moving Average)**: Trend direction
- **EMA (Exponential Moving Average)**: Weighted trend
- **Bollinger Bands**: Volatility and support/resistance

### Volume Indicators
- **Volume SMA**: Volume trends
- **On-Balance Volume (OBV)**: Volume-price relationship

### Custom Indicators
- Easy to extend with new indicators via pandas-ta

## Trading Logic Flow

```
1. Market Open Check (9:30 AM EST)
   ↓
2. For each active bot:
   ↓
3. Subscribe to real-time data for bot's symbols
   ↓
4. Every [trading_frequency] seconds:
   ↓
5. Calculate configured indicators
   ↓
6. Generate trading signals:
   - Buy: RSI < oversold, MACD bullish crossover, etc.
   - Sell: RSI > overbought, MACD bearish crossover, etc.
   ↓
7. Risk Management Check:
   - Position size within limits
   - Stop-loss/take-profit levels
   - Daily loss limits
   ↓
8. Execute trade via Alpaca API
   ↓
9. Log trade to database
   ↓
10. Emit update via WebSocket
    ↓
11. Continue until market window closes (12:00 PM)
```

## Risk Management Features

1. **Position Sizing**: Maximum percentage of capital per position
2. **Stop-Loss**: Automatic sell at configured loss percentage
3. **Take-Profit**: Automatic sell at configured profit percentage
4. **Daily Loss Limit**: Stop trading if daily loss exceeds threshold
5. **Maximum Positions**: Limit concurrent open positions
6. **Capital Protection**: Never risk more than allocated capital

## Security Considerations

1. **API Keys**: Stored in environment variables, never in code
2. **Authentication**: JWT tokens for API access (future enhancement)
3. **Rate Limiting**: Prevent API abuse
4. **Input Validation**: Pydantic schemas validate all inputs
5. **Error Handling**: Graceful degradation, error logging
6. **Paper Trading**: Test with Alpaca paper trading first

## Scalability Considerations

1. **Horizontal Scaling**: Stateless API, can run multiple instances
2. **Database Connection Pooling**: SQLAlchemy connection pool
3. **Async Processing**: FastAPI async/await for concurrent requests
4. **Caching**: Redis for frequently accessed data
5. **Message Queue**: For high-frequency trading (future: RabbitMQ/Kafka)

## Development Workflow

1. **Local Development**:
   - Docker Compose for services (PostgreSQL, Redis)
   - Hot reload for FastAPI (uvicorn --reload)
   - React dev server with Vite

2. **Testing**:
   - Unit tests for indicator calculations
   - Integration tests for API endpoints
   - Paper trading for live testing

3. **Deployment**:
   - Docker containers
   - CI/CD pipeline (GitHub Actions)
   - Environment-specific configs

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/trading_bot

# Alpaca API
ALPACA_API_KEY=your_api_key
ALPACA_SECRET_KEY=your_secret_key
ALPACA_BASE_URL=https://paper-api.alpaca.markets  # or https://api.alpaca.markets

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Application
ENVIRONMENT=development
LOG_LEVEL=INFO
```

## Future Enhancements

1. **Machine Learning**: ML-based signal generation
2. **Backtesting**: Historical strategy testing
3. **Multi-Exchange**: Support for other brokers
4. **Advanced Risk Models**: VaR, portfolio optimization
5. **Mobile App**: React Native mobile app
6. **Notifications**: Email/SMS alerts
7. **Strategy Templates**: Pre-configured bot templates
8. **Social Trading**: Share bot configurations

## Component Communication

### Communication Matrix

| Component | Communicates With | Protocol | Purpose |
|-----------|-------------------|----------|---------|
| **React Frontend** | FastAPI Backend | HTTP REST | CRUD operations, data fetching |
| **React Frontend** | FastAPI Backend | WebSocket (socket.io) | Real-time updates |
| **FastAPI Backend** | PostgreSQL | SQL (via SQLAlchemy) | Data persistence |
| **FastAPI Backend** | Redis | Redis Protocol | Caching, pub/sub |
| **Trading Engine** | Alpaca API | REST API | Order execution |
| **Trading Engine** | Alpaca API | WebSocket | Market data subscription |
| **Trading Engine** | PostgreSQL | SQL (via SQLAlchemy) | Trade logging |
| **Trading Engine** | WebSocket Broadcaster | Internal | Real-time event emission |
| **Indicator Calculator** | Trading Engine | Internal (Python) | Indicator computation |
| **Risk Manager** | Trading Engine | Internal (Python) | Risk validation |
| **Signal Generator** | Trading Engine | Internal (Python) | Signal generation |

### Key Data Flows

**Bot Creation Flow**:
```
User → Frontend Form → POST /api/bots → FastAPI → PostgreSQL → Response → Frontend → Success
```

**Trading Flow**:
```
Alpaca WebSocket → Trading Engine → Calculate Indicators → Generate Signal → 
Risk Check → Execute Order → Alpaca REST → Log to DB → Broadcast WebSocket → 
Frontend Update
```

**Dashboard Update Flow**:
```
User Opens Dashboard → Frontend → GET /api/summary → FastAPI → PostgreSQL → 
Response → Frontend Display
+
WebSocket Connection → Real-time Events → Frontend Auto-Update
```

**Position Monitoring Flow**:
```
Trading Engine → Position Opened → Log to DB → Broadcast WebSocket → 
Frontend Positions Page → Real-time Price Updates → Calculate Unrealized P&L → 
Display in UI
```

## Technology Stack Layers

### Presentation Layer
- **React 18+** with TypeScript
- **Material-UI (MUI)** - Component library
- **TradingView Lightweight Charts** - Real-time price charts
- **Recharts** - Analytics and performance charts

### State & Communication Layer
- **TanStack Query** - Server state management, caching, refetching
- **React Router** - Client-side routing and navigation
- **socket.io-client** - WebSocket client for real-time updates
- **Axios** - HTTP client for REST API calls

### API Layer
- **FastAPI** (Python 3.11+) - High-performance async web framework
- **Pydantic** - Data validation and serialization
- **API Routers** - REST endpoints (Bots, Trades, Positions, Market Data)
- **WebSocket Endpoints** - Real-time event broadcasting

### Business Logic Layer
- **Trading Engine** - Core trading orchestration
- **pandas-ta** - Technical indicator calculations
- **Risk Manager** - Risk management enforcement
- **Signal Generator** - Trading signal generation logic

### Data Access Layer
- **SQLAlchemy** - ORM for database operations
- **Alembic** - Database migration management
- **Connection Pooling** - Efficient database connection management

### Data Storage Layer
- **PostgreSQL** - Primary relational database
- **Redis** - Caching and pub/sub (optional but recommended)

### External APIs
- **Alpaca REST API** - Order execution and account management
- **Alpaca WebSocket** - Real-time market data streams

## File Structure

```
trading-bot/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── alpaca_client.py
│   │   ├── trading_engine.py
│   │   ├── indicators.py
│   │   ├── risk_manager.py
│   │   └── routers/
│   │       ├── bots.py
│   │       ├── trades.py
│   │       ├── positions.py
│   │       └── market_data.py
│   ├── alembic/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard/
│   │   │   ├── bots/
│   │   │   ├── trades/
│   │   │   ├── positions/
│   │   │   ├── analytics/
│   │   │   ├── common/
│   │   │   └── layout/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Bots.tsx
│   │   │   ├── CreateBot.tsx
│   │   │   ├── EditBot.tsx
│   │   │   ├── Trades.tsx
│   │   │   ├── Positions.tsx
│   │   │   └── Analytics.tsx
│   │   ├── hooks/
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   └── websocket.ts
│   │   └── types/
│   ├── package.json
│   ├── Dockerfile
│   └── vite.config.ts
├── docker-compose.yml
├── Plans/
│   ├── ARCHITECTURE.md
│   ├── BACKEND_IMPLEMENTATION_PLAN.md
│   ├── SYSTEM_ARCHITECTURE_DIAGRAMS.md
│   └── ARCHITECTURE_DIAGRAMS.html
└── README.md
```

## Performance Targets

- **API Response Time**: < 100ms for CRUD operations
- **Real-time Data Latency**: < 500ms from market to dashboard
- **Trade Execution**: < 1 second from signal to order
- **Concurrent Bots**: Support 10+ bots simultaneously
- **Database Queries**: Optimized with indexes

## Monitoring & Logging

1. **Application Logs**: Structured logging (JSON format)
2. **Metrics**: Trade execution times, API response times
3. **Alerts**: Error notifications, unusual trading patterns
4. **Health Checks**: `/health` endpoint for monitoring

## Implementation Notes

### WebSocket Protocol
- All WebSocket connections use **socket.io** protocol for bidirectional communication
- Events emitted: `trade_executed`, `position_updated`, `bot_status_changed`, `price_update`, `market_status_changed`
- Automatic reconnection on connection loss

### Database Operations
- **SQLAlchemy ORM** with connection pooling for efficient database access
- **Alembic** for database migrations
- JSON columns for flexible indicator and risk management configurations
- Indexes on frequently queried fields (bot_id, symbol, timestamp)

### Caching Strategy
- **Redis** is optional but highly recommended for production
- Used for real-time data caching, pub/sub messaging, and rate limiting
- Reduces database load and improves response times

### Security
- All external API calls to Alpaca use **HTTPS**
- API keys stored in environment variables, never in code
- JWT tokens for API authentication (future enhancement)
- Input validation via Pydantic schemas

### Performance
- **TanStack Query** for automatic caching and refetching on frontend
- Trading Engine runs **asynchronously** and can handle multiple bots concurrently
- Database connection pooling for efficient resource usage
- Async/await throughout FastAPI for concurrent request handling

### Real-time Updates
- WebSocket broadcasts trade executions, position updates, and bot status changes
- Frontend automatically updates via React Query cache invalidation
- Sub-second latency from event to UI update

---

This architecture provides a solid foundation for a scalable, maintainable trading bot system with clear separation of concerns and modern best practices.
