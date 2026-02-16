# Trading Bot Frontend

React + TypeScript frontend for the Trading Bot application.

## Tech Stack

- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Material-UI (MUI)** - UI component library
- **React Router** - Routing
- **TanStack Query** - Server state management
- **Axios** - HTTP client
- **Socket.io Client** - WebSocket client
- **TradingView Lightweight Charts** - Price charts

## Project Structure

```
frontend/
├── src/
│   ├── components/      # Reusable components
│   │   ├── common/     # Common UI components
│   │   └── layout/     # Layout components
│   ├── pages/          # Page components
│   ├── hooks/          # Custom React hooks
│   ├── services/       # API and WebSocket services
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions
│   └── styles/         # Theme and styles
├── public/             # Static assets
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

### Linting

```bash
# Check for linting errors
npm run lint

# Auto-fix linting errors
npm run lint:fix
```

### Formatting

```bash
# Format code
npm run format

# Check formatting
npm run format:check
```

### Type Checking

```bash
npm run type-check
```

## Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:8000/api
VITE_WS_URL=ws://localhost:8000/ws
VITE_ENV=development
```

## Path Aliases

The project uses path aliases for cleaner imports:

- `@/components` - Components
- `@/pages` - Pages
- `@/hooks` - Hooks
- `@/services` - Services
- `@/types` - Types
- `@/utils` - Utils
- `@/styles` - Styles

Example:
```typescript
import Layout from '@/components/layout/Layout'
import { useWebSocket } from '@/hooks/useWebSocket'
```

## Development Workflow

1. **Sprint 0** (Current): Foundation & Setup ✅
2. **Sprint 1**: Design System & Common Components
3. **Sprint 2**: Dashboard Screen
4. **Sprint 3**: Bots Management Pages
5. **Sprint 4**: Positions Page
6. **Sprint 5**: Trade History Page
7. **Sprint 6**: Analytics Page
8. **Sprint 7**: Real-time Updates & WebSocket
9. **Sprint 8**: Charts & Visualizations
10. **Sprint 9**: Polish & UX Enhancements
11. **Sprint 10**: Responsive Design & Mobile
12. **Sprint 11-12**: Testing & Deployment Prep

## API Integration

The API client is configured in `src/services/api.ts`. All API calls should use the exported `api` object:

```typescript
import { api } from '@/services/api'

// Example
const bots = await api.getBots()
```

## WebSocket Integration

WebSocket service is configured in `src/services/websocket.ts`. Use the `useWebSocket` hook:

```typescript
import { useWebSocket } from '@/hooks/useWebSocket'

const { isConnected, subscribe } = useWebSocket()

useEffect(() => {
  const unsubscribe = subscribe('trade_executed', (data) => {
    console.log('New trade:', data)
  })
  return unsubscribe
}, [subscribe])
```

## Contributing

1. Follow the existing code style
2. Run linting and formatting before committing
3. Write tests for new components
4. Update documentation as needed

## License

Private project
