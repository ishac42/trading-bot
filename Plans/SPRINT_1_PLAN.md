# Sprint 1: Design System & Common Components - Implementation Plan

## Overview
**Goal**: Build reusable components and design system foundation  
**Duration**: 1 week  
**Priority**: High - Foundation for all future development

---

## Sprint Goals

1. ✅ Complete design system (colors, typography, spacing)
2. ✅ Build 9 reusable common components
3. ✅ Enhance layout components (TopBar, Navigation)
4. ✅ Set up component testing
5. ✅ Document components

---

## Day-by-Day Breakdown

### Day 1: Design System & Theme Enhancement

**Morning (4 hours)**
- [ ] Review current theme (`src/styles/theme.ts`)
- [ ] Enhance color palette with all variants
- [ ] Complete typography scale
- [ ] Define spacing scale
- [ ] Add component overrides

**Afternoon (4 hours)**
- [ ] Test theme across all breakpoints
- [ ] Create theme documentation
- [ ] Update Layout components to use enhanced theme
- [ ] Verify theme works in light/dark mode (if applicable)

**Deliverables**:
- ✅ Enhanced theme file with complete design tokens
- ✅ Theme documentation

---

### Day 2: Core Common Components (Part 1)

**Morning (4 hours)**
- [ ] **StatusBadge Component**
  - Create `src/components/common/StatusBadge.tsx`
  - Props: `status: 'running' | 'paused' | 'stopped' | 'error'`
  - Color coding: Green/Yellow/Gray/Red
  - Icon support (optional)
  - Variants: dot, badge, chip
  - Responsive sizing
  - Unit tests

- [ ] **P&LDisplay Component**
  - Create `src/components/common/PnLDisplay.tsx`
  - Props: `amount: number`, `percentage?: number`, `showSign?: boolean`
  - Color: Green (positive), Red (negative)
  - Format: +$1,234.56 (+2.5%)
  - Handle zero values
  - Currency formatting utility
  - Unit tests

**Afternoon (4 hours)**
- [ ] **Card Component**
  - Create `src/components/common/Card.tsx`
  - Base card with consistent styling
  - Props: `title?`, `children`, `actions?`, `elevation?`
  - Variants: outlined, elevated, flat
  - Responsive padding
  - Hover effects (optional)

- [ ] **Button Variants**
  - Create `src/components/common/Button.tsx` (wrapper)
  - Extend MUI Button with custom variants
  - Variants: primary, secondary, danger, text
  - Sizes: small, medium, large
  - Loading state
  - Icon support

**Deliverables**:
- ✅ 4 components created and tested
- ✅ Components folder structure established

---

### Day 3: Core Common Components (Part 2)

**Morning (4 hours)**
- [ ] **Input Component**
  - Create `src/components/common/Input.tsx`
  - Extend MUI TextField
  - Validation styling (error, success states)
  - Helper text support
  - Label variants
  - Required field indicator
  - Responsive sizing

- [ ] **Select/Dropdown Component**
  - Create `src/components/common/Select.tsx`
  - Extend MUI Select
  - Searchable option (optional)
  - Multi-select support
  - Placeholder handling
  - Error states

**Afternoon (4 hours)**
- [ ] **Modal/Dialog Component**
  - Create `src/components/common/Modal.tsx`
  - Extend MUI Dialog
  - Props: `open`, `onClose`, `title`, `children`, `actions?`
  - Variants: confirmation, form, info
  - Responsive sizing
  - Backdrop handling
  - Animation

- [ ] **LoadingSpinner Component**
  - Create `src/components/common/LoadingSpinner.tsx`
  - Variants: circular, linear, skeleton
  - Sizes: small, medium, large
  - Full page overlay option
  - Text support ("Loading...")

**Deliverables**:
- ✅ 4 more components created
- ✅ Form components ready for use

---

### Day 4: Additional Components & Layout Enhancements

**Morning (4 hours)**
- [ ] **EmptyState Component**
  - Create `src/components/common/EmptyState.tsx`
  - Props: `title`, `message`, `icon?`, `action?`
  - Variants: no data, error, empty search
  - Icon support
  - Call-to-action button

- [ ] **TopBar Enhancements**
  - Update `src/components/layout/TopBar.tsx`
  - Add market status indicator (real component)
  - Add connection status indicator
  - User menu dropdown (placeholder)
  - Responsive improvements

**Afternoon (4 hours)**
- [ ] **Component Index File**
  - Create `src/components/common/index.ts`
  - Export all common components
  - Easy imports: `import { StatusBadge, PnLDisplay } from '@/components/common'`

- [ ] **Component Documentation**
  - Add JSDoc comments to all components
  - Create component usage examples
  - Document props and variants

**Deliverables**:
- ✅ All common components complete
- ✅ Enhanced TopBar
- ✅ Component exports organized

---

### Day 5: Testing, Documentation & Polish

**Morning (4 hours)**
- [ ] **Unit Tests**
  - Test StatusBadge with all status variants
  - Test P&LDisplay with positive/negative/zero values
  - Test Card component variants
  - Test Button variants and states
  - Test Input validation states
  - Test Modal open/close behavior

- [ ] **Visual Testing** (Optional)
  - Set up Storybook (if time permits)
  - Create stories for key components
  - Visual regression testing setup

**Afternoon (4 hours)**
- [ ] **Integration Testing**
  - Test components work together
  - Test responsive behavior
  - Test theme application

- [ ] **Documentation**
  - Update README with component usage
  - Create component showcase page (optional)
  - Document design system decisions

- [ ] **Code Review & Refactoring**
  - Review all components
  - Refactor for consistency
  - Optimize performance (memoization where needed)

**Deliverables**:
- ✅ All components tested
- ✅ Documentation complete
- ✅ Code reviewed and polished

---

## Detailed Component Specifications

### 1. StatusBadge Component

**File**: `src/components/common/StatusBadge.tsx`

**Props**:
```typescript
interface StatusBadgeProps {
  status: 'running' | 'paused' | 'stopped' | 'error'
  variant?: 'dot' | 'badge' | 'chip'
  size?: 'small' | 'medium' | 'large'
  showLabel?: boolean
  className?: string
}
```

**Features**:
- Color mapping: running (green), paused (yellow), stopped (gray), error (red)
- Icon support (optional)
- Responsive sizing
- Accessible (ARIA labels)

**Usage**:
```tsx
<StatusBadge status="running" />
<StatusBadge status="paused" variant="chip" showLabel />
```

---

### 2. P&LDisplay Component

**File**: `src/components/common/PnLDisplay.tsx`

**Props**:
```typescript
interface PnLDisplayProps {
  amount: number
  percentage?: number
  showSign?: boolean
  size?: 'small' | 'medium' | 'large'
  bold?: boolean
  className?: string
}
```

**Features**:
- Automatic color: green (positive), red (negative), gray (zero)
- Currency formatting: $1,234.56
- Percentage formatting: (+2.5%)
- Sign display: + or - prefix
- Responsive typography

**Usage**:
```tsx
<PnLDisplay amount={1234.56} percentage={2.5} />
<PnLDisplay amount={-45.23} percentage={-0.9} showSign />
```

---

### 3. Card Component

**File**: `src/components/common/Card.tsx`

**Props**:
```typescript
interface CardProps {
  title?: string
  children: ReactNode
  actions?: ReactNode
  elevation?: number
  variant?: 'outlined' | 'elevated' | 'flat'
  sx?: SxProps
  onClick?: () => void
}
```

**Features**:
- Consistent padding and spacing
- Optional title and actions
- Hover effects (if clickable)
- Responsive

**Usage**:
```tsx
<Card title="Bot Status" actions={<Button>Edit</Button>}>
  Content here
</Card>
```

---

### 4. Button Component

**File**: `src/components/common/Button.tsx`

**Props**: Extends MUI Button with custom variants

**Features**:
- Variants: primary, secondary, danger, text
- Loading state with spinner
- Icon support (startIcon, endIcon)
- Disabled state
- Full width option

**Usage**:
```tsx
<Button variant="primary" loading={isLoading}>
  Save
</Button>
<Button variant="danger" startIcon={<DeleteIcon />}>
  Delete
</Button>
```

---

### 5. Input Component

**File**: `src/components/common/Input.tsx`

**Props**: Extends MUI TextField

**Features**:
- Validation states (error, success)
- Helper text
- Required field indicator
- Label variants
- Responsive sizing

**Usage**:
```tsx
<Input
  label="Bot Name"
  required
  error={!!errors.name}
  helperText={errors.name}
/>
```

---

### 6. Select Component

**File**: `src/components/common/Select.tsx`

**Props**: Extends MUI Select

**Features**:
- Searchable options (optional)
- Multi-select support
- Placeholder
- Error states
- Custom option rendering

**Usage**:
```tsx
<Select
  label="Symbol"
  options={symbols}
  value={selectedSymbol}
  onChange={handleChange}
/>
```

---

### 7. Modal Component

**File**: `src/components/common/Modal.tsx`

**Props**:
```typescript
interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  actions?: ReactNode
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  fullScreen?: boolean
}
```

**Features**:
- Responsive sizing
- Backdrop click to close (optional)
- Animation
- Variants: confirmation, form, info

**Usage**:
```tsx
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

### 8. LoadingSpinner Component

**File**: `src/components/common/LoadingSpinner.tsx`

**Props**:
```typescript
interface LoadingSpinnerProps {
  variant?: 'circular' | 'linear' | 'skeleton'
  size?: 'small' | 'medium' | 'large'
  fullPage?: boolean
  text?: string
}
```

**Features**:
- Multiple variants
- Full page overlay option
- Text support
- Responsive sizing

**Usage**:
```tsx
<LoadingSpinner />
<LoadingSpinner variant="linear" text="Loading trades..." />
<LoadingSpinner fullPage />
```

---

### 9. EmptyState Component

**File**: `src/components/common/EmptyState.tsx`

**Props**:
```typescript
interface EmptyStateProps {
  title: string
  message?: string
  icon?: ReactNode
  action?: {
    label: string
    onClick: () => void
  }
  variant?: 'no-data' | 'error' | 'empty-search'
}
```

**Features**:
- Multiple variants
- Icon support
- Call-to-action button
- Responsive

**Usage**:
```tsx
<EmptyState
  title="No bots found"
  message="Create your first bot to get started"
  action={{ label: 'Create Bot', onClick: handleCreate }}
/>
```

---

## File Structure

```
frontend/src/
├── components/
│   ├── common/
│   │   ├── StatusBadge.tsx
│   │   ├── PnLDisplay.tsx
│   │   ├── Card.tsx
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Modal.tsx
│   │   ├── LoadingSpinner.tsx
│   │   ├── EmptyState.tsx
│   │   └── index.ts
│   └── layout/
│       ├── Layout.tsx
│       ├── TopBar.tsx (enhanced)
│       └── Navigation.tsx
├── styles/
│   └── theme.ts (enhanced)
└── utils/
    └── formatters.ts (currency, percentage)
```

---

## Testing Strategy

### Unit Tests
- Test each component in isolation
- Test all props and variants
- Test edge cases (zero values, empty states, etc.)
- Test accessibility

### Integration Tests
- Test components work together
- Test theme application
- Test responsive behavior

### Visual Tests (Optional)
- Storybook for component showcase
- Visual regression testing

---

## Acceptance Criteria

### Design System
- ✅ Complete color palette defined
- ✅ Typography scale established
- ✅ Spacing scale defined
- ✅ Theme file enhanced and documented

### Components
- ✅ All 9 common components created
- ✅ Components are fully typed (TypeScript)
- ✅ Components are responsive
- ✅ Components are accessible
- ✅ Components have unit tests
- ✅ Components are documented

### Layout
- ✅ TopBar enhanced with status indicators
- ✅ Navigation works on all screen sizes
- ✅ Layout is responsive

### Code Quality
- ✅ No TypeScript errors
- ✅ No linting errors
- ✅ Components follow consistent patterns
- ✅ Code is well-documented

---

## Dependencies

### External
- Material-UI components (already installed)
- React Testing Library (need to install)
- @testing-library/jest-dom (need to install)

### Internal
- Theme from `src/styles/theme.ts`
- Types from `src/types/index.ts`
- Utils (may need to create formatters)

---

## Risk Mitigation

### Risk: Component complexity
- **Mitigation**: Start simple, enhance incrementally
- **Fallback**: Use MUI components directly if custom ones are too complex

### Risk: Theme inconsistencies
- **Mitigation**: Document design decisions early
- **Fallback**: Use MUI default theme as base

### Risk: Testing time
- **Mitigation**: Focus on critical components first
- **Fallback**: Manual testing if unit tests take too long

---

## Success Metrics

- ✅ All components render without errors
- ✅ Components are reusable across pages
- ✅ Design system is consistent
- ✅ Code coverage > 70% for components
- ✅ No accessibility violations
- ✅ All components responsive

---

## Next Steps After Sprint 1

Once Sprint 1 is complete, we'll move to:
- **Sprint 2**: Dashboard Screen (using all the components we built)
- Components will be ready for immediate use in feature development

---

## Notes

- **Reusability First**: Build components to be used across multiple pages
- **Consistency**: Follow MUI design patterns where possible
- **Accessibility**: Ensure all components are accessible
- **Performance**: Use React.memo and useMemo where appropriate
- **Documentation**: Document as you build, not after

---

**Last Updated**: [Current Date]  
**Status**: Ready to Start
