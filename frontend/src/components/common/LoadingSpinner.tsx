import React from 'react'
import {
  Box,
  CircularProgress,
  LinearProgress,
  Typography,
  Skeleton,
} from '@mui/material'
import type { SxProps, Theme } from '@mui/system'

export type LoadingVariant = 'circular' | 'linear' | 'skeleton'
export type LoadingSize = 'small' | 'medium' | 'large'

export interface LoadingSpinnerProps {
  variant?: LoadingVariant
  size?: LoadingSize
  fullPage?: boolean
  text?: string
  sx?: SxProps<Theme>
  className?: string
}

const sizeConfig: Record<LoadingSize, number> = {
  small: 24,
  medium: 40,
  large: 56,
}

/**
 * LoadingSpinner Component
 * 
 * A flexible loading indicator with multiple variants.
 * 
 * @example
 * ```tsx
 * <LoadingSpinner />
 * <LoadingSpinner variant="linear" text="Loading trades..." />
 * <LoadingSpinner fullPage />
 * ```
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  variant = 'circular',
  size = 'medium',
  fullPage = false,
  text,
  sx,
  className,
}) => {
  const spinnerSize = sizeConfig[size]

  if (variant === 'skeleton') {
    return (
      <Box className={className} sx={sx}>
        <Skeleton variant="rectangular" width="100%" height={200} />
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="80%" />
      </Box>
    )
  }

  if (variant === 'linear') {
    return (
      <Box
        className={className}
        sx={{
          width: '100%',
          ...sx,
        }}
      >
        <LinearProgress />
        {text && (
          <Typography
            variant="body2"
            sx={{
              marginTop: 1,
              textAlign: 'center',
              color: 'text.secondary',
            }}
          >
            {text}
          </Typography>
        )}
      </Box>
    )
  }

  // Circular variant (default)
  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        ...sx,
      }}
    >
      <CircularProgress size={spinnerSize} />
      {text && (
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          {text}
        </Typography>
      )}
    </Box>
  )

  if (fullPage) {
    return (
      <Box
        className={className}
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9999,
        }}
      >
        {content}
      </Box>
    )
  }

  return (
    <Box className={className} sx={sx}>
      {content}
    </Box>
  )
}
