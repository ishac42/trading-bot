/**
 * Common Components
 * 
 * Export all common reusable components for easy importing.
 * 
 * @example
 * ```tsx
 * import { StatusBadge, PnLDisplay, Card, Button } from '@/components/common'
 * ```
 */

export { StatusBadge } from './StatusBadge'
export type {
  StatusBadgeProps,
  StatusType,
  StatusVariant,
  StatusSize,
} from './StatusBadge'

export { PnLDisplay } from './PnLDisplay'
export type { PnLDisplayProps, PnLSize } from './PnLDisplay'

export { Card } from './Card'
export type { CardProps, CardVariant } from './Card'

export { Button } from './Button'
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button'

export { Input } from './Input'
export type { InputProps } from './Input'

export { Select } from './Select'
export type { SelectProps, SelectOption } from './Select'

export { Modal } from './Modal'
export type { ModalProps, ModalMaxWidth } from './Modal'

export { LoadingSpinner } from './LoadingSpinner'
export type {
  LoadingSpinnerProps,
  LoadingVariant,
  LoadingSize,
} from './LoadingSpinner'

export { EmptyState } from './EmptyState'
export type { EmptyStateProps, EmptyStateVariant } from './EmptyState'

export { MarketStatusIndicator } from './MarketStatusIndicator'
export type { MarketStatusIndicatorProps } from './MarketStatusIndicator'

export { ConnectionStatusIndicator } from './ConnectionStatusIndicator'
export type { ConnectionStatusIndicatorProps } from './ConnectionStatusIndicator'
