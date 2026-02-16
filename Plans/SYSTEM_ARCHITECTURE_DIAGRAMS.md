# Trading Bot System Architecture - Visual Diagrams

This document provides visual representations of how all system components relate to each other according to the architecture design.

---

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[React Frontend<br/>TypeScript + MUI]
        Pages[Dashboard<br/>Bot Config<br/>Trade History<br/>Analytics]
        WSClient[WebSocket Client<br/>socket.io-client]
    end

    subgraph "Backend Layer"
        API[FastAPI Backend<br/>Python 3.11+]
        Routers[API Routers<br/>Bots, Trades, Market Data]
        Engine[Trading Engine<br/>Core Logic]
        Calc[Indicator Calculator<br/>pandas-ta]
        Signal[Signal Generator]
        Risk[Risk Manager]
        Exec[Order Executor]
    end

    subgraph "Data Layer"
        DB[(PostgreSQL<br/>Database)]
        Redis[(Redis<br/>Cache/Queue)]
    end

    subgraph "External Services"
        Alpaca[Alpaca Trade API<br/>REST + WebSocket]
        Market[Market Data<br/>Real-time Streams]
    end

    UI -->|HTTP REST| API
    UI -->|WebSocket| WSClient
    WSClient <-->|socket.io| API
    Pages --> UI
    
    API --> Routers
    Routers --> Engine
    Engine --> Calc
    Engine --> Signal
    Engine --> Risk
    Engine --> Exec
    
    API -->|SQLAlchemy| DB
    API -->|Cache| Redis
    Exec -->|REST API| Alpaca
    Engine -->|WebSocket| Market
    Market -->|Price Updates| Alpaca
    Alpaca -->|Trade Confirmations| Engine
    
    Engine -->|Real-time Events| WSClient
    Exec -->|Log Trades| DB
    Engine -->|Cache Data| Redis
```

---

## 2. Component Interaction Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant FastAPI
    participant TradingEngine
    participant AlpacaAPI
    participant PostgreSQL
    participant WebSocket

    Note over User,WebSocket: Bot Configuration Flow
    User->>Frontend: Create/Edit Bot
    Frontend->>FastAPI: POST /api/bots
    FastAPI->>PostgreSQL: Save Bot Config
    PostgreSQL-->>FastAPI: Confirmation
    FastAPI-->>Frontend: Bot Created
    Frontend-->>User: Success Message

    Note over User,WebSocket: Start Bot Flow
    User->>Frontend: Start Bot
    Frontend->>FastAPI: POST /api/bots/{id}/start
    FastAPI->>TradingEngine: Initialize Bot
    TradingEngine->>PostgreSQL: Load Bot Config
    TradingEngine->>AlpacaAPI: Subscribe to Market Data
    FastAPI-->>Frontend: Bot Started
    FastAPI->>WebSocket: Emit bot_status_changed
    WebSocket-->>Frontend: Real-time Update

    Note over User,WebSocket: Trading Flow (Every trading_frequency seconds)
    AlpacaAPI->>TradingEngine: Price Update
    TradingEngine->>TradingEngine: Calculate Indicators
    TradingEngine->>TradingEngine: Generate Signal
    TradingEngine->>TradingEngine: Risk Check
    TradingEngine->>AlpacaAPI: Execute Order
    AlpacaAPI-->>TradingEngine: Order Confirmation
    TradingEngine->>PostgreSQL: Log Trade
    TradingEngine->>WebSocket: Emit trade_executed
    WebSocket-->>Frontend: Real-time Update
    Frontend-->>User: Dashboard Updates

    Note over User,WebSocket: View Data Flow
    User->>Frontend: View Dashboard/Trades
    Frontend->>FastAPI: GET /api/trades
    FastAPI->>PostgreSQL: Query Trades
    PostgreSQL-->>FastAPI: Trade Data
    FastAPI-->>Frontend: JSON Response
    Frontend-->>User: Display Data
```

---

## 3. Trading Engine Internal Architecture

```mermaid
graph LR
    subgraph "Trading Engine Core"
        Main[TradingEngine<br/>Main Orchestrator]
        Scheduler[Market Hours<br/>Monitor]
        Subscriber[Data Subscriber<br/>Alpaca WebSocket]
    end

    subgraph "Signal Processing"
        Calc[IndicatorCalculator<br/>pandas-ta]
        Signal[SignalGenerator<br/>Buy/Sell Logic]
    end

    subgraph "Risk Management"
        Risk[RiskManager]
        Position[Position Sizing]
        StopLoss[Stop-Loss Check]
        DailyLoss[Daily Loss Limit]
    end

    subgraph "Execution"
        Exec[OrderExecutor<br/>Alpaca API]
        Logger[Trade Logger]
    end

    subgraph "Data Storage"
        DB[(PostgreSQL)]
        Cache[(Redis)]
    end

    subgraph "Real-time Updates"
        WS[WebSocket<br/>Broadcaster]
    end

    Main --> Scheduler
    Scheduler --> Subscriber
    Subscriber --> Calc
    Calc --> Signal
    Signal --> Risk
    Risk --> Position
    Risk --> StopLoss
    Risk --> DailyLoss
    Risk --> Exec
    Exec --> Logger
    Exec --> WS
    Logger --> DB
    Main --> Cache
    WS --> Frontend[Frontend UI]
```

---

## 4. Data Flow Diagram

```mermaid
flowchart TD
    subgraph "User Actions"
        Create[Create Bot]
        Start[Start Bot]
        View[View Dashboard]
    end

    subgraph "Frontend (React)"
        UI[React Components]
        Query[TanStack Query]
        WS[WebSocket Client]
    end

    subgraph "Backend API (FastAPI)"
        BotRouter[/api/bots]
        TradeRouter[/api/trades]
        MarketRouter[/api/market-data]
        WSEndpoint[/ws]
    end

    subgraph "Trading Engine"
        Engine[Trading Engine]
        Indicators[Calculate Indicators]
        Signals[Generate Signals]
        RiskCheck[Risk Management]
    end

    subgraph "External"
        AlpacaREST[Alpaca REST API]
        AlpacaWS[Alpaca WebSocket]
    end

    subgraph "Storage"
        Postgres[(PostgreSQL)]
        RedisCache[(Redis)]
    end

    Create --> UI
    Start --> UI
    View --> UI
    
    UI --> Query
    UI --> WS
    
    Query -->|HTTP| BotRouter
    Query -->|HTTP| TradeRouter
    Query -->|HTTP| MarketRouter
    
    WS -->|socket.io| WSEndpoint
    
    BotRouter --> Postgres
    TradeRouter --> Postgres
    MarketRouter --> RedisCache
    
    BotRouter -->|Start Command| Engine
    Engine -->|Subscribe| AlpacaWS
    AlpacaWS -->|Price Data| Engine
    Engine --> Indicators
    Indicators --> Signals
    Signals --> RiskCheck
    RiskCheck -->|Execute| AlpacaREST
    AlpacaREST -->|Confirmation| Engine
    Engine -->|Log| Postgres
    Engine -->|Cache| RedisCache
    Engine -->|Broadcast| WSEndpoint
    WSEndpoint -->|Real-time| WS
    WS -->|Update| UI
```

---

## 5. Database Schema Relationships

```mermaid
erDiagram
    BOTS ||--o{ TRADES : "has"
    BOTS ||--o{ POSITIONS : "has"
    
    BOTS {
        string id PK
        string name
        string status
        decimal capital
        int trading_frequency
        json indicators
        json risk_management
        json symbols
        int start_hour
        int start_minute
        int end_hour
        int end_minute
        timestamp created_at
        timestamp updated_at
    }
    
    TRADES {
        string id PK
        string bot_id FK
        string symbol
        string type
        int quantity
        decimal price
        timestamp timestamp
        json indicators_snapshot
        decimal profit_loss
    }
    
    POSITIONS {
        string id PK
        string bot_id FK
        string symbol
        int quantity
        decimal entry_price
        decimal current_price
        decimal stop_loss_price
        decimal take_profit_price
        decimal unrealized_pnl
        decimal realized_pnl
        timestamp opened_at
        timestamp closed_at
        boolean is_open
    }
```

---

## 6. Technology Stack Layers

```mermaid
graph TB
    subgraph "Presentation Layer"
        React[React 18+<br/>TypeScript]
        MUI[Material-UI<br/>Components]
        Charts[TradingView Charts<br/>Recharts]
    end

    subgraph "State & Communication"
        Query[TanStack Query<br/>State Management]
        Router[React Router<br/>Navigation]
        WSClient[socket.io-client<br/>WebSocket]
        Axios[Axios<br/>HTTP Client]
    end

    subgraph "API Layer"
        FastAPI[FastAPI<br/>Python 3.11+]
        Pydantic[Pydantic<br/>Validation]
        Routers[API Routers<br/>REST Endpoints]
    end

    subgraph "Business Logic"
        Engine[Trading Engine]
        Indicators[pandas-ta<br/>Technical Indicators]
        Risk[Risk Manager]
        Signals[Signal Generator]
    end

    subgraph "Data Access"
        SQLAlchemy[SQLAlchemy<br/>ORM]
        Alembic[Alembic<br/>Migrations]
    end

    subgraph "Data Storage"
        PostgreSQL[(PostgreSQL<br/>Database)]
        Redis[(Redis<br/>Cache)]
    end

    subgraph "External APIs"
        AlpacaREST[Alpaca REST API<br/>Order Execution]
        AlpacaWS[Alpaca WebSocket<br/>Market Data]
    end

    React --> MUI
    React --> Charts
    React --> Query
    React --> Router
    Query --> Axios
    Query --> WSClient
    
    Axios --> FastAPI
    WSClient --> FastAPI
    
    FastAPI --> Pydantic
    FastAPI --> Routers
    Routers --> Engine
    Engine --> Indicators
    Engine --> Risk
    Engine --> Signals
    
    Routers --> SQLAlchemy
    SQLAlchemy --> Alembic
    SQLAlchemy --> PostgreSQL
    Engine --> Redis
    
    Engine --> AlpacaREST
    Engine --> AlpacaWS
```

---

## 7. Real-time Data Flow

```mermaid
graph LR
    subgraph "Market Data Source"
        Alpaca[Alpaca Market Data<br/>WebSocket Stream]
    end

    subgraph "Backend Processing"
        Subscriber[WebSocket Subscriber]
        Engine[Trading Engine]
        Calculator[Indicator Calculator]
        SignalGen[Signal Generator]
        Executor[Order Executor]
    end

    subgraph "Backend Storage & Broadcast"
        DB[(PostgreSQL)]
        Cache[(Redis)]
        WSBroadcast[WebSocket Broadcaster]
    end

    subgraph "Frontend Updates"
        WSClient[WebSocket Client]
        Query[React Query]
        UI[React UI]
    end

    Alpaca -->|Price Updates| Subscriber
    Subscriber --> Engine
    Engine --> Calculator
    Calculator --> SignalGen
    SignalGen --> Executor
    Executor -->|Execute Trade| Alpaca
    Executor --> DB
    Executor --> Cache
    Executor --> WSBroadcast
    
    WSBroadcast -->|socket.io| WSClient
    WSClient --> Query
    Query --> UI
    
    Alpaca -->|Trade Confirmation| Executor
    Executor --> WSBroadcast
```

---

## 8. Deployment Architecture

```mermaid
graph TB
    subgraph "Client"
        Browser[Web Browser]
    end

    subgraph "Frontend Container"
        ReactApp[React App<br/>Vite Build]
        Nginx[Nginx<br/>Static Server]
    end

    subgraph "Backend Container"
        FastAPIApp[FastAPI App<br/>Uvicorn]
    end

    subgraph "Database Container"
        PostgresDB[(PostgreSQL<br/>Database)]
    end

    subgraph "Cache Container"
        RedisCache[(Redis<br/>Cache)]
    end

    subgraph "External Services"
        AlpacaAPI[Alpaca API<br/>Cloud Service]
    end

    Browser -->|HTTPS| Nginx
    Nginx --> ReactApp
    ReactApp -->|HTTP/WS| FastAPIApp
    FastAPIApp --> PostgresDB
    FastAPIApp --> RedisCache
    FastAPIApp -->|REST/WS| AlpacaAPI
```

---

## 9. Trading Logic Flow (Detailed)

```mermaid
flowchart TD
    Start([Market Opens<br/>9:30 AM EST]) --> CheckBots{Active<br/>Bots?}
    
    CheckBots -->|No| Wait[Wait for<br/>Active Bots]
    CheckBots -->|Yes| Loop[For Each Bot]
    
    Wait --> CheckBots
    
    Loop --> LoadConfig[Load Bot Config<br/>from Database]
    LoadConfig --> Subscribe[Subscribe to<br/>Market Data]
    
    Subscribe --> Timer{Every<br/>trading_frequency<br/>seconds}
    
    Timer --> GetPrice[Get Current<br/>Price Data]
    GetPrice --> CalcIndicators[Calculate<br/>Indicators<br/>RSI, MACD, SMA, etc.]
    
    CalcIndicators --> GenerateSignal{Generate<br/>Trading<br/>Signal?}
    
    GenerateSignal -->|Buy Signal| CheckRiskBuy[Risk Management<br/>Check]
    GenerateSignal -->|Sell Signal| CheckRiskSell[Risk Management<br/>Check]
    GenerateSignal -->|No Signal| Timer
    
    CheckRiskBuy --> RiskBuy{Pass<br/>Risk Check?}
    CheckRiskSell --> RiskSell{Pass<br/>Risk Check?}
    
    RiskBuy -->|No| Timer
    RiskBuy -->|Yes| ExecuteBuy[Execute Buy<br/>Order via Alpaca]
    
    RiskSell -->|No| Timer
    RiskSell -->|Yes| ExecuteSell[Execute Sell<br/>Order via Alpaca]
    
    ExecuteBuy --> LogTrade[Log Trade<br/>to Database]
    ExecuteSell --> LogTrade
    
    LogTrade --> Broadcast[Broadcast Update<br/>via WebSocket]
    Broadcast --> CheckTime{Market<br/>Window<br/>Closed?}
    
    CheckTime -->|No| Timer
    CheckTime -->|Yes 12:00 PM| Stop[Stop Trading]
    
    Stop --> End([End])
```

---

## 10. Component Communication Matrix

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

---

## 11. Key Data Flows

### Bot Creation Flow
```
User → Frontend Form → POST /api/bots → FastAPI → PostgreSQL → Response → Frontend → Success
```

### Trading Flow
```
Alpaca WebSocket → Trading Engine → Calculate Indicators → Generate Signal → 
Risk Check → Execute Order → Alpaca REST → Log to DB → Broadcast WebSocket → 
Frontend Update
```

### Dashboard Update Flow
```
User Opens Dashboard → Frontend → GET /api/summary → FastAPI → PostgreSQL → 
Response → Frontend Display
+
WebSocket Connection → Real-time Events → Frontend Auto-Update
```

### Position Monitoring Flow
```
Trading Engine → Position Opened → Log to DB → Broadcast WebSocket → 
Frontend Positions Page → Real-time Price Updates → Calculate Unrealized P&L → 
Display in UI
```

---

## Legend

- **Solid Lines**: Direct communication/data flow
- **Dashed Lines**: Optional or conditional flow
- **Arrows**: Direction of data/request flow
- **Boxes**: Components/services
- **Cylinders**: Data storage
- **Diamonds**: Decision points

---

## Notes

- All WebSocket connections use **socket.io** protocol
- Database operations use **SQLAlchemy ORM** with connection pooling
- Redis is **optional** but recommended for production
- All external API calls to Alpaca use **HTTPS**
- Frontend uses **TanStack Query** for automatic caching and refetching
- Trading Engine runs **asynchronously** and can handle multiple bots concurrently
