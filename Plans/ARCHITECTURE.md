# Auto Trading Bot - Architecture & Technology Stack

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

- **WebSocket Client**: Native WebSocket API or socket.io-client
  - Real-time dashboard updates
  - Live trade notifications

### Infrastructure & Deployment
- **Containerization**: Docker & Docker Compose
  - Consistent development/production environments
  - Easy deployment

- **Cloud Platform**: AWS / GCP / Azure
  - EC2/Compute Engine for application server
  - RDS/Cloud SQL for PostgreSQL
  - ElastiCache/Cloud Memorystore for Redis (optional)

- **Process Management**: 
  - Systemd (Linux)
  - PM2 (Node.js process manager for frontend if needed)
  - Or container orchestration (Kubernetes/ECS)

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
- Filterable trade log
- P&L analysis
- Export functionality

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
│   │       └── market_data.py
│   ├── alembic/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   ├── package.json
│   ├── Dockerfile
│   └── vite.config.ts
├── docker-compose.yml
├── ARCHITECTURE.md
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

---

This architecture provides a solid foundation for a scalable, maintainable trading bot system with clear separation of concerns and modern best practices.
