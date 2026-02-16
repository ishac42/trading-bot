import React from 'react'
import { Chip, Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/system'
import { FiberManualRecord } from '@mui/icons-material'

export type StatusType = 'running' | 'paused' | 'stopped' | 'error'
export type StatusVariant = 'dot' | 'badge' | 'chip'
export type StatusSize = 'small' | 'medium' | 'large'

export interface StatusBadgeProps {
  status: StatusType
  variant?: StatusVariant
  size?: StatusSize
  showLabel?: boolean
  className?: string
  sx?: SxProps<Theme>
}

const statusConfig: Record<
  StatusType,
  { color: string; label: string; icon?: React.ReactNode }
> = {
  running: {
    color: '#4caf50',
    label: 'Running',
  },
  paused: {
    color: '#ff9800',
    label: 'Paused',
  },
  stopped: {
    color: '#757575',
    label: 'Stopped',
  },
  error: {
    color: '#f44336',
    label: 'Error',
  },
}

const sizeConfig: Record<StatusSize, { dot: number; fontSize: string }> = {
  small: { dot: 6, fontSize: '0.75rem' },
  medium: { dot: 8, fontSize: '0.875rem' },
  large: { dot: 10, fontSize: '1rem' },
}

/**
 * StatusBadge Component
 * 
 * Displays a status indicator with color coding for bot states.
 * 
 * @example
 * ```tsx
 * <StatusBadge status="running" />
 * <StatusBadge status="paused" variant="chip" showLabel />
 * ```
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant = 'badge',
  size = 'medium',
  showLabel = true,
  className,
  sx,
}) => {
  const config = statusConfig[status]
  const sizeProps = sizeConfig[size]

  if (variant === 'dot') {
    return (
      <Box
        className={className}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          ...sx,
        }}
        role="status"
        aria-label={`Status: ${config.label}`}
      >
        <FiberManualRecord
          sx={{
            fontSize: sizeProps.dot,
            color: config.color,
          }}
        />
        {showLabel && (
          <Box
            component="span"
            sx={{
              fontSize: sizeProps.fontSize,
              color: 'text.secondary',
            }}
          >
            {config.label}
          </Box>
        )}
      </Box>
    )
  }

  if (variant === 'chip') {
    return (
      <Chip
        label={showLabel ? config.label : ''}
        size={size === 'small' ? 'small' : 'medium'}
        sx={{
          backgroundColor: config.color,
          color: '#ffffff',
          fontWeight: 500,
          fontSize: sizeProps.fontSize,
          height: size === 'small' ? 20 : size === 'medium' ? 24 : 28,
          '& .MuiChip-label': {
            padding: size === 'small' ? '0 6px' : '0 8px',
          },
          ...sx,
        }}
        className={className}
        role="status"
        aria-label={`Status: ${config.label}`}
      />
    )
  }

  // Badge variant (default)
  return (
    <Box
      className={className}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        ...sx,
      }}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      <Box
        sx={{
          width: sizeProps.dot,
          height: sizeProps.dot,
          borderRadius: '50%',
          backgroundColor: config.color,
          flexShrink: 0,
        }}
      />
      {showLabel && (
        <Box
          component="span"
          sx={{
            fontSize: sizeProps.fontSize,
            color: 'text.primary',
            fontWeight: 500,
          }}
        >
          {config.label}
        </Box>
      )}
    </Box>
  )
}
