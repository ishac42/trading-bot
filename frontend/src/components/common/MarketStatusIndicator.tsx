import React from 'react'
import { Box, Typography, Tooltip } from '@mui/material'
import type { SxProps, Theme } from '@mui/system'
import { FiberManualRecord } from '@mui/icons-material'
import type { MarketStatus } from '@/types'

export interface MarketStatusIndicatorProps {
  marketStatus?: MarketStatus
  isLoading?: boolean
  sx?: SxProps<Theme>
  className?: string
}

/**
 * MarketStatusIndicator Component
 * 
 * Displays the current market status (open/closed) with visual indicator.
 * 
 * @example
 * ```tsx
 * <MarketStatusIndicator marketStatus={status} />
 * ```
 */
export const MarketStatusIndicator: React.FC<MarketStatusIndicatorProps> = ({
  marketStatus,
  isLoading = false,
  sx,
  className,
}) => {
  const hasError = !!marketStatus?.error
  const isOpen = !hasError && (marketStatus?.is_open ?? false)
  const color = hasError ? '#f44336' : isOpen ? '#4caf50' : '#757575'
  const label = hasError ? 'Market UNKNOWN' : isOpen ? 'Market OPEN' : 'Market CLOSED'
  
  const tooltipText = hasError
    ? marketStatus!.error!
    : marketStatus?.time_until_close 
    ? `Time until close: ${marketStatus.time_until_close}`
    : marketStatus?.next_open
    ? `Next open: ${new Date(marketStatus.next_open).toLocaleString()}`
    : label

  return (
    <Tooltip title={tooltipText} arrow>
      <Box
        className={className}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          ...sx,
        }}
        role="status"
        aria-label={label}
      >
        <FiberManualRecord
          sx={{
            fontSize: 10,
            color: isLoading ? 'text.disabled' : color,
            animation: isLoading ? 'pulse 2s ease-in-out infinite' : 'none',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.5 },
            },
          }}
        />
        <Typography
          variant="body2"
          sx={{
            fontSize: { xs: '0.75rem', sm: '0.875rem' },
            color: isLoading ? 'text.disabled' : 'text.primary',
            fontWeight: 500,
            display: { xs: 'none', sm: 'block' },
          }}
        >
          {isLoading ? 'Loading...' : label}
        </Typography>
      </Box>
    </Tooltip>
  )
}
