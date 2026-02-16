import React from 'react'
import { Grid, Box, Typography, Skeleton } from '@mui/material'
import {
  TrendingUp as TrendingUpIcon,
  SmartToy as BotIcon,
  AccountBalance as PositionsIcon,
} from '@mui/icons-material'
import { Card, PnLDisplay } from '@/components/common'
import type { SummaryStats } from '@/types'
import { formatCurrency } from '@/utils/formatters'

interface SummaryCardItemProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}

/**
 * Individual summary card item
 */
const SummaryCardItem: React.FC<SummaryCardItemProps> = ({
  title,
  icon,
  children,
}) => {
  return (
    <Card
      variant="elevated"
      elevation={2}
      sx={{
        height: '100%',
        background: (theme) =>
          `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.grey[50]} 100%)`,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 2,
        }}
      >
        <Box
          sx={{
            p: 1,
            borderRadius: 2,
            backgroundColor: 'primary.main',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 0.5, fontWeight: 500 }}
          >
            {title}
          </Typography>
          {children}
        </Box>
      </Box>
    </Card>
  )
}

interface SummaryCardsProps {
  stats?: SummaryStats
  isLoading: boolean
}

/**
 * SummaryCards Component
 *
 * Displays three summary cards at the top of the Dashboard:
 * 1. Total P&L with percentage change
 * 2. Active Bots count
 * 3. Open Positions count and value
 */
export const SummaryCards: React.FC<SummaryCardsProps> = ({
  stats,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <Grid container spacing={{ xs: 2, md: 3 }}>
        {[1, 2, 3].map((i) => (
          <Grid key={i} size={{ xs: 12, sm: 4 }}>
            <Card variant="elevated">
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <Skeleton variant="rounded" width={40} height={40} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="text" width="80%" height={32} />
                  <Skeleton variant="text" width="40%" />
                </Box>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>
    )
  }

  return (
    <Grid container spacing={{ xs: 2, md: 3 }}>
      {/* Total P&L Card */}
      <Grid size={{ xs: 12, sm: 4 }}>
        <SummaryCardItem
          title="Total P&L"
          icon={<TrendingUpIcon />}
        >
          <PnLDisplay
            amount={stats?.total_pnl ?? 0}
            showSign
            size="large"
            bold
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {stats?.pnl_percentage !== undefined && (
              <Box
                component="span"
                sx={{
                  color:
                    (stats.pnl_percentage ?? 0) >= 0
                      ? 'success.main'
                      : 'error.main',
                  fontWeight: 500,
                }}
              >
                {(stats.pnl_percentage ?? 0) >= 0 ? '↑' : '↓'}{' '}
                {Math.abs(stats.pnl_percentage ?? 0).toFixed(1)}% Today
              </Box>
            )}
          </Typography>
        </SummaryCardItem>
      </Grid>

      {/* Active Bots Card */}
      <Grid size={{ xs: 12, sm: 4 }}>
        <SummaryCardItem
          title="Active Bots"
          icon={<BotIcon />}
        >
          <Typography
            variant="h2"
            sx={{ fontWeight: 'bold', lineHeight: 1.2 }}
          >
            {stats?.active_bots ?? 0}{' '}
            <Typography
              component="span"
              variant="body2"
              color="text.secondary"
            >
              Running
            </Typography>
          </Typography>
          {stats?.paused_bots !== undefined && stats.paused_bots > 0 && (
            <Typography variant="body2" color="warning.main" sx={{ mt: 0.5 }}>
              {stats.paused_bots} Paused
            </Typography>
          )}
        </SummaryCardItem>
      </Grid>

      {/* Open Positions Card */}
      <Grid size={{ xs: 12, sm: 4 }}>
        <SummaryCardItem
          title="Open Positions"
          icon={<PositionsIcon />}
        >
          <Typography
            variant="h2"
            sx={{ fontWeight: 'bold', lineHeight: 1.2 }}
          >
            {stats?.open_positions ?? 0}{' '}
            <Typography
              component="span"
              variant="body2"
              color="text.secondary"
            >
              Positions
            </Typography>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {formatCurrency(stats?.positions_value ?? 0)} Value
          </Typography>
        </SummaryCardItem>
      </Grid>
    </Grid>
  )
}
