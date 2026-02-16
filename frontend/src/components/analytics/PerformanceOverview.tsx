import React from 'react'
import {
  Box,
  Grid,
  Typography,
  Skeleton,
  useTheme,
} from '@mui/material'
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  BarChart as BarChartIcon,
  Equalizer as EqualizerIcon,
  EmojiEvents as TrophyIcon,
  Warning as WarningIcon,
  ShowChart as ShowChartIcon,
  AccountBalance as AccountBalanceIcon,
} from '@mui/icons-material'
import { Card, PnLDisplay } from '@/components/common'
import { formatCurrency } from '@/utils/formatters'
import type { AnalyticsOverview } from '@/types'

interface PerformanceOverviewProps {
  overview: AnalyticsOverview | undefined
  isLoading: boolean
}

/**
 * Single metric card for the overview grid
 */
const MetricCard: React.FC<{
  label: string
  value: string | React.ReactNode
  icon: React.ReactNode
  color?: string
  subtitle?: string
}> = ({ label, value, icon, color, subtitle }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      p: 2,
      border: 1,
      borderColor: 'divider',
      borderRadius: 2,
      bgcolor: 'background.paper',
      height: '100%',
      transition: 'all 0.2s ease-in-out',
      '&:hover': {
        borderColor: color || 'primary.main',
        boxShadow: 1,
      },
    }}
  >
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        borderRadius: 1.5,
        bgcolor: color ? `${color}15` : 'action.hover',
        color: color || 'text.secondary',
        flexShrink: 0,
      }}
    >
      {icon}
    </Box>
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontSize: '0.75rem', fontWeight: 500 }}
      >
        {label}
      </Typography>
      <Box sx={{ fontWeight: 600, fontSize: '1.05rem', lineHeight: 1.3 }}>
        {value}
      </Box>
      {subtitle && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: '0.7rem' }}
        >
          {subtitle}
        </Typography>
      )}
    </Box>
  </Box>
)

/**
 * Loading skeleton for the performance overview
 */
const OverviewSkeleton: React.FC = () => (
  <Grid container spacing={2}>
    {Array.from({ length: 8 }).map((_, i) => (
      <Grid size={{ xs: 6, sm: 4, md: 3 }} key={i}>
        <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} />
      </Grid>
    ))}
  </Grid>
)

/**
 * PerformanceOverview Component
 *
 * Displays key portfolio performance metrics in a grid of cards:
 * Total P&L, Win Rate, Sharpe Ratio, Profit Factor,
 * Max Drawdown, Avg Trade, Best/Worst Trade
 */
export const PerformanceOverview: React.FC<PerformanceOverviewProps> = ({
  overview,
  isLoading,
}) => {
  const theme = useTheme()

  if (isLoading) return <OverviewSkeleton />
  if (!overview) return null

  return (
    <Card title="Performance Overview">
      <Grid container spacing={1.5}>
        {/* Total P&L */}
        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
          <MetricCard
            label="Total P&L"
            value={
              <PnLDisplay
                amount={overview.totalPnL}
                percentage={overview.totalPnLPercentage}
                showSign
                size="small"
                bold
              />
            }
            icon={
              overview.totalPnL >= 0 ? (
                <TrendingUpIcon />
              ) : (
                <TrendingDownIcon />
              )
            }
            color={
              overview.totalPnL >= 0
                ? theme.palette.success.main
                : theme.palette.error.main
            }
          />
        </Grid>

        {/* Win Rate */}
        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
          <MetricCard
            label="Win Rate"
            value={`${overview.winRate}%`}
            icon={<EqualizerIcon />}
            color={
              overview.winRate >= 50
                ? theme.palette.success.main
                : theme.palette.warning.main
            }
            subtitle={`${overview.winningTrades}W / ${overview.losingTrades}L of ${overview.totalTrades} trades`}
          />
        </Grid>

        {/* Sharpe Ratio */}
        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
          <MetricCard
            label="Sharpe Ratio"
            value={overview.sharpeRatio.toFixed(2)}
            icon={<ShowChartIcon />}
            color={
              overview.sharpeRatio >= 1
                ? theme.palette.success.main
                : overview.sharpeRatio >= 0
                  ? theme.palette.warning.main
                  : theme.palette.error.main
            }
            subtitle={
              overview.sharpeRatio >= 2
                ? 'Excellent'
                : overview.sharpeRatio >= 1
                  ? 'Good'
                  : overview.sharpeRatio >= 0
                    ? 'Average'
                    : 'Poor'
            }
          />
        </Grid>

        {/* Profit Factor */}
        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
          <MetricCard
            label="Profit Factor"
            value={
              overview.profitFactor >= 999
                ? '∞'
                : overview.profitFactor.toFixed(2)
            }
            icon={<BarChartIcon />}
            color={
              overview.profitFactor >= 1.5
                ? theme.palette.success.main
                : overview.profitFactor >= 1
                  ? theme.palette.warning.main
                  : theme.palette.error.main
            }
            subtitle="Gross profit / Gross loss"
          />
        </Grid>

        {/* Max Drawdown */}
        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
          <MetricCard
            label="Max Drawdown"
            value={formatCurrency(overview.maxDrawdown, '$')}
            icon={<TrendingDownIcon />}
            color={theme.palette.error.main}
            subtitle={`${overview.maxDrawdownPercentage.toFixed(2)}% of capital`}
          />
        </Grid>

        {/* Avg Trade Return */}
        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
          <MetricCard
            label="Avg Trade Return"
            value={
              <PnLDisplay
                amount={overview.avgTradeReturn}
                showSign
                size="small"
                bold
              />
            }
            icon={<EqualizerIcon />}
            color={
              overview.avgTradeReturn >= 0
                ? theme.palette.success.main
                : theme.palette.error.main
            }
            subtitle={`Win: ${formatCurrency(overview.avgWin, '$', true)} / Loss: -${formatCurrency(overview.avgLoss, '$')}`}
          />
        </Grid>

        {/* Best Trade */}
        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
          <MetricCard
            label="Best Trade"
            value={formatCurrency(overview.bestTrade, '$', true)}
            icon={<TrophyIcon />}
            color={theme.palette.success.main}
          />
        </Grid>

        {/* Worst Trade */}
        <Grid size={{ xs: 6, sm: 4, md: 3 }}>
          <MetricCard
            label="Worst Trade"
            value={formatCurrency(overview.worstTrade, '$', true)}
            icon={<WarningIcon />}
            color={theme.palette.error.main}
          />
        </Grid>
      </Grid>

      {/* Capital Summary */}
      <Box
        sx={{
          mt: 2,
          pt: 2,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <AccountBalanceIcon
          sx={{ color: 'text.secondary', fontSize: '1rem' }}
        />
        <Typography variant="body2" color="text.secondary">
          Total Capital Deployed:{' '}
          <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {formatCurrency(overview.totalCapitalDeployed)}
          </Box>
        </Typography>
      </Box>
    </Card>
  )
}
