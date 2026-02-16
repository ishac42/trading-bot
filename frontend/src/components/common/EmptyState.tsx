import React from 'react'
import {
  Box,
  Typography,
  Button,
} from '@mui/material'
import type { SxProps, Theme } from '@mui/system'
import {
  Inbox as InboxIcon,
  SearchOff as SearchOffIcon,
  ErrorOutline as ErrorIcon,
} from '@mui/icons-material'

export type EmptyStateVariant = 'no-data' | 'error' | 'empty-search'

export interface EmptyStateProps {
  title: string
  message?: string
  icon?: React.ReactNode
  action?: {
    label: string
    onClick: () => void
  }
  variant?: EmptyStateVariant
  sx?: SxProps<Theme>
  className?: string
}

const defaultIcons: Record<EmptyStateVariant, React.ReactNode> = {
  'no-data': <InboxIcon sx={{ fontSize: 64, color: 'text.secondary' }} />,
  'error': <ErrorIcon sx={{ fontSize: 64, color: 'error.main' }} />,
  'empty-search': <SearchOffIcon sx={{ fontSize: 64, color: 'text.secondary' }} />,
}

/**
 * EmptyState Component
 * 
 * Displays an empty state message with optional icon and action button.
 * Useful for empty lists, error states, and search results.
 * 
 * @example
 * ```tsx
 * <EmptyState
 *   title="No bots found"
 *   message="Create your first bot to get started"
 *   action={{ label: 'Create Bot', onClick: handleCreate }}
 * />
 * ```
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  icon,
  action,
  variant = 'no-data',
  sx,
  className,
}) => {
  const displayIcon = icon || defaultIcons[variant]

  return (
    <Box
      className={className}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
        textAlign: 'center',
        minHeight: 300,
        ...sx,
      }}
    >
      <Box
        sx={{
          marginBottom: 2,
          opacity: 0.6,
        }}
      >
        {displayIcon}
      </Box>
      <Typography
        variant="h3"
        sx={{
          marginBottom: 1,
          color: 'text.primary',
          fontWeight: 600,
        }}
      >
        {title}
      </Typography>
      {message && (
        <Typography
          variant="body1"
          sx={{
            marginBottom: 3,
            color: 'text.secondary',
            maxWidth: 400,
          }}
        >
          {message}
        </Typography>
      )}
      {action && (
        <Button
          variant="contained"
          color="primary"
          onClick={action.onClick}
          sx={{
            marginTop: 2,
          }}
        >
          {action.label}
        </Button>
      )}
    </Box>
  )
}
