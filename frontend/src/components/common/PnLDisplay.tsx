import React from 'react'
import { Box, Typography } from '@mui/material'
import type { SxProps, Theme } from '@mui/system'
import { formatCurrency, formatPercentage } from '@/utils/formatters'

export type PnLSize = 'small' | 'medium' | 'large'

export interface PnLDisplayProps {
  amount: number
  percentage?: number
  showSign?: boolean
  size?: PnLSize
  bold?: boolean
  className?: string
  sx?: SxProps<Theme>
}

const sizeConfig: Record<PnLSize, { fontSize: string; gap: number }> = {
  small: { fontSize: '0.875rem', gap: 0.5 },
  medium: { fontSize: '1rem', gap: 0.75 },
  large: { fontSize: '1.5rem', gap: 1 },
}

/**
 * PnLDisplay Component
 * 
 * Displays profit and loss with automatic color coding and formatting.
 * 
 * @example
 * ```tsx
 * <PnLDisplay amount={1234.56} percentage={2.5} />
 * <PnLDisplay amount={-45.23} percentage={-0.9} showSign />
 * ```
 */
export const PnLDisplay: React.FC<PnLDisplayProps> = ({
  amount,
  percentage,
  showSign = false,
  size = 'medium',
  bold = false,
  className,
  sx,
}) => {
  const sizeProps = sizeConfig[size]
  
  // Determine color based on value
  const color =
    amount > 0
      ? 'success.main'
      : amount < 0
      ? 'error.main'
      : 'text.secondary'

  const fontWeight = bold ? 'bold' : 'medium'

  return (
    <Box
      className={className}
      sx={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: sizeProps.gap,
        flexWrap: 'wrap',
        ...sx,
      }}
    >
      <Typography
        variant={size === 'large' ? 'h3' : 'body1'}
        sx={{
          color,
          fontWeight,
          fontSize: sizeProps.fontSize,
          lineHeight: 1.2,
        }}
      >
        {formatCurrency(amount, '$', showSign)}
      </Typography>
      {percentage !== undefined && (
        <Typography
          variant="body2"
          sx={{
            color,
            fontSize: `calc(${sizeProps.fontSize} * 0.875)`,
            fontWeight: bold ? 'bold' : 'normal',
            opacity: 0.9,
          }}
        >
          ({formatPercentage(percentage, showSign)})
        </Typography>
      )}
    </Box>
  )
}
