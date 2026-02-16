import React from 'react'
import { Box, Tooltip } from '@mui/material'
import type { SxProps, Theme } from '@mui/system'
import { FiberManualRecord } from '@mui/icons-material'
import { WifiOff } from '@mui/icons-material'

export interface ConnectionStatusIndicatorProps {
  isConnected: boolean
  isReconnecting?: boolean
  sx?: SxProps<Theme>
  className?: string
}

/**
 * ConnectionStatusIndicator Component
 * 
 * Displays WebSocket connection status with visual indicator.
 * 
 * @example
 * ```tsx
 * <ConnectionStatusIndicator isConnected={isConnected} isReconnecting={isReconnecting} />
 * ```
 */
export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
  isConnected,
  isReconnecting = false,
  sx,
  className,
}) => {
  const color = isConnected ? '#4caf50' : isReconnecting ? '#ff9800' : '#f44336'
  const label = isConnected 
    ? 'Connected' 
    : isReconnecting 
    ? 'Reconnecting...' 
    : 'Disconnected'
  
  const tooltipText = isConnected
    ? 'WebSocket connected'
    : isReconnecting
    ? 'Reconnecting to server...'
    : 'WebSocket disconnected'

  return (
    <Tooltip title={tooltipText} arrow>
      <Box
        className={className}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          ...sx,
        }}
        role="status"
        aria-label={`Connection: ${label}`}
      >
        {!isConnected && !isReconnecting ? (
          <WifiOff
            sx={{
              fontSize: 16,
              color,
            }}
          />
        ) : (
          <FiberManualRecord
            sx={{
              fontSize: 10,
              color,
              animation: isReconnecting ? 'pulse 1.5s ease-in-out infinite' : 'none',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.3 },
              },
            }}
          />
        )}
      </Box>
    </Tooltip>
  )
}
