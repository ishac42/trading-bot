import React from 'react'
import { Box, Paper, Typography } from '@mui/material'
import {
  AccountBalance as AccountBalanceIcon,
  TrendingUp as TrendingUpIcon,
  ShowChart as ShowChartIcon,
} from '@mui/icons-material'
import type { Position } from '@/types'
import { formatCurrency } from '@/utils/formatters'

interface PositionsSummaryProps {
  positions: Position[]
}

/**
 * PositionsSummary Component
 *
 * Displays a summary bar at the top of the Positions page:
 * - Total open positions count
 * - Total market value
 * - Total unrealized P&L
 */
export const PositionsSummary: React.FC<PositionsSummaryProps> = ({
  positions,
}) => {
  const totalPositions = positions.length
  const totalValue = positions.reduce(
    (sum, p) => sum + p.current_price * p.quantity,
    0
  )
  const totalUnrealizedPnl = positions.reduce(
    (sum, p) => sum + p.unrealized_pnl,
    0
  )

  const cards = [
    {
      label: 'Open Positions',
      value: totalPositions.toString(),
      icon: <ShowChartIcon />,
      color: 'primary.main',
    },
    {
      label: 'Total Value',
      value: formatCurrency(totalValue),
      icon: <AccountBalanceIcon />,
      color: 'primary.main',
    },
    {
      label: 'Unrealized P&L',
      value: formatCurrency(totalUnrealizedPnl, '$', true),
      icon: <TrendingUpIcon />,
      color:
        totalUnrealizedPnl > 0
          ? 'success.main'
          : totalUnrealizedPnl < 0
            ? 'error.main'
            : 'text.secondary',
    },
  ]

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(3, 1fr)',
        },
        gap: 2,
        mb: 3,
      }}
    >
      {cards.map((card) => (
        <Paper
          key={card.label}
          elevation={1}
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 1,
              bgcolor: 'action.hover',
              color: card.color,
              flexShrink: 0,
            }}
          >
            {card.icon}
          </Box>
          <Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ lineHeight: 1.2 }}
            >
              {card.label}
            </Typography>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 'bold',
                color: card.color,
                lineHeight: 1.3,
              }}
            >
              {card.value}
            </Typography>
          </Box>
        </Paper>
      ))}
    </Box>
  )
}
