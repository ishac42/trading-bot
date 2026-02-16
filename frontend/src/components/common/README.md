# Common Components

This directory contains reusable common components used throughout the application.

## Components

### StatusBadge

Displays a status indicator with color coding for bot states.

**Props:**
- `status`: `'running' | 'paused' | 'stopped' | 'error'` - The status to display
- `variant?`: `'dot' | 'badge' | 'chip'` - Visual variant (default: `'badge'`)
- `size?`: `'small' | 'medium' | 'large'` - Size of the badge (default: `'medium'`)
- `showLabel?`: `boolean` - Whether to show the status label (default: `true`)

**Example:**
```tsx
import { StatusBadge } from '@/components/common'

<StatusBadge status="running" />
<StatusBadge status="paused" variant="chip" showLabel />
```

---

### PnLDisplay

Displays profit and loss with automatic color coding and formatting.

**Props:**
- `amount`: `number` - The P&L amount
- `percentage?`: `number` - Optional percentage to display
- `showSign?`: `boolean` - Whether to show + sign for positive values (default: `false`)
- `size?`: `'small' | 'medium' | 'large'` - Size of the display (default: `'medium'`)
- `bold?`: `boolean` - Whether to use bold font (default: `false`)

**Example:**
```tsx
import { PnLDisplay } from '@/components/common'

<PnLDisplay amount={1234.56} percentage={2.5} />
<PnLDisplay amount={-45.23} percentage={-0.9} showSign />
```

---

### Card

A reusable card component with consistent styling, optional title and actions.

**Props:**
- `title?`: `string` - Optional card title
- `children`: `ReactNode` - Card content
- `actions?`: `ReactNode` - Optional action buttons
- `elevation?`: `number` - Shadow elevation (default: `1`)
- `variant?`: `'outlined' | 'elevated' | 'flat'` - Visual variant (default: `'elevated'`)
- `onClick?`: `() => void` - Optional click handler

**Example:**
```tsx
import { Card, Button } from '@/components/common'

<Card title="Bot Status" actions={<Button>Edit</Button>}>
  Content here
</Card>
```

---

### Button

Extended MUI Button with custom variants and loading state.

**Props:**
- `variant?`: `'primary' | 'secondary' | 'danger' | 'text'` - Button variant (default: `'primary'`)
- `loading?`: `boolean` - Shows loading spinner (default: `false`)
- `fullWidth?`: `boolean` - Full width button
- All standard MUI Button props

**Example:**
```tsx
import { Button } from '@/components/common'

<Button variant="primary" loading={isLoading}>Save</Button>
<Button variant="danger" startIcon={<DeleteIcon />}>Delete</Button>
```

---

### Input

Extended MUI TextField with validation styling and required field indicator.

**Props:**
- `required?`: `boolean` - Whether field is required
- `showRequiredIndicator?`: `boolean` - Show * indicator (default: `true`)
- `error?`: `boolean` - Error state
- `helperText?`: `string` - Helper text below input
- All standard MUI TextField props

**Example:**
```tsx
import { Input } from '@/components/common'

<Input
  label="Bot Name"
  required
  error={!!errors.name}
  helperText={errors.name}
/>
```

---

### Select

Extended MUI Select with consistent styling and error handling.

**Props:**
- `label`: `string` - Select label
- `options`: `SelectOption[]` - Array of options
- `required?`: `boolean` - Whether field is required
- `error?`: `boolean` - Error state
- `helperText?`: `string` - Helper text
- `placeholder?`: `string` - Placeholder text
- All standard MUI Select props

**Example:**
```tsx
import { Select } from '@/components/common'

<Select
  label="Symbol"
  options={[
    { value: 'AAPL', label: 'Apple Inc.' },
    { value: 'GOOGL', label: 'Alphabet Inc.' },
  ]}
  value={selectedSymbol}
  onChange={handleChange}
/>
```

---

### Modal

A reusable modal/dialog component with consistent styling.

**Props:**
- `open`: `boolean` - Whether modal is open
- `onClose`: `() => void` - Close handler
- `title?`: `string` - Optional modal title
- `children`: `ReactNode` - Modal content
- `actions?`: `ReactNode` - Optional action buttons
- `maxWidth?`: `'xs' | 'sm' | 'md' | 'lg' | 'xl'` - Maximum width (default: `'sm'`)
- `fullScreen?`: `boolean` - Full screen on mobile (default: `false`)
- `closeOnBackdropClick?`: `boolean` - Close on backdrop click (default: `true`)
- `closeOnEscape?`: `boolean` - Close on escape key (default: `true`)

**Example:**
```tsx
import { Modal, Button } from '@/components/common'

<Modal
  open={isOpen}
  onClose={handleClose}
  title="Confirm Delete"
  actions={<Button onClick={handleConfirm}>Delete</Button>}
>
  Are you sure you want to delete this bot?
</Modal>
```

---

### LoadingSpinner

A flexible loading indicator with multiple variants.

**Props:**
- `variant?`: `'circular' | 'linear' | 'skeleton'` - Loading variant (default: `'circular'`)
- `size?`: `'small' | 'medium' | 'large'` - Size (default: `'medium'`)
- `fullPage?`: `boolean` - Full page overlay (default: `false`)
- `text?`: `string` - Optional loading text

**Example:**
```tsx
import { LoadingSpinner } from '@/components/common'

<LoadingSpinner />
<LoadingSpinner variant="linear" text="Loading trades..." />
<LoadingSpinner fullPage />
```

---

### EmptyState

Displays an empty state message with optional icon and action button.

**Props:**
- `title`: `string` - Empty state title
- `message?`: `string` - Optional message
- `icon?`: `ReactNode` - Custom icon
- `action?`: `{ label: string; onClick: () => void }` - Optional action button
- `variant?`: `'no-data' | 'error' | 'empty-search'` - Variant (default: `'no-data'`)

**Example:**
```tsx
import { EmptyState } from '@/components/common'

<EmptyState
  title="No bots found"
  message="Create your first bot to get started"
  action={{ label: 'Create Bot', onClick: handleCreate }}
/>
```

---

### MarketStatusIndicator

Displays the current market status (open/closed) with visual indicator.

**Props:**
- `marketStatus?`: `MarketStatus` - Market status object
- `isLoading?`: `boolean` - Loading state (default: `false`)

**Example:**
```tsx
import { MarketStatusIndicator } from '@/components/common'
import { useMarketStatus } from '@/hooks/useMarketStatus'

const { marketStatus, isLoading } = useMarketStatus()
<MarketStatusIndicator marketStatus={marketStatus} isLoading={isLoading} />
```

---

### ConnectionStatusIndicator

Displays WebSocket connection status with visual indicator.

**Props:**
- `isConnected`: `boolean` - Connection status
- `isReconnecting?`: `boolean` - Reconnecting state (default: `false`)

**Example:**
```tsx
import { ConnectionStatusIndicator } from '@/components/common'
import { useWebSocket } from '@/hooks/useWebSocket'

const { isConnected } = useWebSocket()
<ConnectionStatusIndicator isConnected={isConnected} />
```

---

## Importing Components

All components can be imported from the common components index:

```tsx
import {
  StatusBadge,
  PnLDisplay,
  Card,
  Button,
  Input,
  Select,
  Modal,
  LoadingSpinner,
  EmptyState,
  MarketStatusIndicator,
  ConnectionStatusIndicator,
} from '@/components/common'
```

## Testing

All components have unit tests. Run tests with:

```bash
npm test
```

## Design System

Components follow the Material-UI design system and use the theme defined in `src/styles/theme.ts`. All components are:
- Fully typed with TypeScript
- Responsive
- Accessible (ARIA labels, semantic HTML)
- Consistent with the design system
