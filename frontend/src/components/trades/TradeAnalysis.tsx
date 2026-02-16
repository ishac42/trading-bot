import React from 'react'
import {
  Box,
  Typography,
  Grid,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  BarChart as BarChartIcon,
  Equalizer as EqualizerIcon,
  EmojiEvents as TrophyIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { Card, PnLDisplay } from '@/components/common'
import type { TradeStats } from '@/types'
import { formatCurrency } from '@/utils/formatters'
import { PnLChart } from './PnLChart'

interface TradeAnalysisProps {
  stats: TradeStats | undefined
  isLoading: boolean
}

/**
 * Single stat card for the overview grid
 */
const StatCard: React.FC<{
  label: string
  value: string | React.ReactNode
  icon: React.ReactNode
  color?: string
}> = ({ label, value, icon, color }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      p: 2,
      border: 1,
      borderColor: 'divider',
      borderRadius: 1,
    }}
  >
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        borderRadius: 1,
        bgcolor: color ? `${color}15` : 'action.hover',
        color: color || 'text.secondary',
        flexShrink: 0,
      }}
    >
      {icon}
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontSize: '0.75rem' }}
      >
        {label}
      </Typography>
      <Box sx={{ fontWeight: 600, fontSize: '1rem' }}>{value}</Box>
    </Box>
  </Box>
)

/**
 * Loading skeleton for the analysis
 */
const AnalysisSkeleton: React.FC = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <Grid container spacing={2}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Grid size={{ xs: 6, sm: 4, md: 2 }} key={i}>
          <Skeleton variant="rectangular" height={72} sx={{ borderRadius: 1 }} />
        </Grid>
      ))}
    </Grid>
    <Skeleton variant="rectangular" height={250} sx={{ borderRadius: 1 }} />
  </Box>
)

/**
 * TradeAnalysis Component
 *
 * Displays trade statistics overview, cumulative P&L chart,
 * performance by symbol, and performance by bot.
 */
export const TradeAnalysis: React.FC<TradeAnalysisProps> = ({
  stats,
  isLoading,
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  if (isLoading) return <AnalysisSkeleton />
  if (!stats) return null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Stats Overview Grid */}
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard
            label="Total Trades"
            value={stats.totalTrades.toString()}
            icon={<BarChartIcon fontSize="small" />}
            color={theme.palette.primary.main}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard
            label="Win Rate"
            value={`${stats.winRate}%`}
            icon={<EqualizerIcon fontSize="small" />}
            color={
              stats.winRate >= 50
                ? theme.palette.success.main
                : theme.palette.warning.main
            }
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard
            label="Total P&L"
            value={
              <PnLDisplay amount={stats.totalPnL} showSign size="small" bold />
            }
            icon={
              stats.totalPnL >= 0 ? (
                <TrendingUpIcon fontSize="small" />
              ) : (
                <TrendingDownIcon fontSize="small" />
              )
            }
            color={
              stats.totalPnL >= 0
                ? theme.palette.success.main
                : theme.palette.error.main
            }
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard
            label="Avg P&L"
            value={
              <PnLDisplay amount={stats.avgPnL} showSign size="small" bold />
            }
            icon={<EqualizerIcon fontSize="small" />}
            color={
              stats.avgPnL >= 0
                ? theme.palette.success.main
                : theme.palette.error.main
            }
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard
            label="Best Trade"
            value={formatCurrency(stats.bestTrade, '$', true)}
            icon={<TrophyIcon fontSize="small" />}
            color={theme.palette.success.main}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard
            label="Worst Trade"
            value={formatCurrency(stats.worstTrade, '$', true)}
            icon={<WarningIcon fontSize="small" />}
            color={theme.palette.error.main}
          />
        </Grid>
      </Grid>

      {/* Cumulative P&L Chart */}
      <Card title="Cumulative P&L">
        <PnLChart data={stats.pnlByDate} />
      </Card>

      {/* Performance Breakdown Tables */}
      <Grid container spacing={2}>
        {/* Performance by Symbol */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card title="Performance by Symbol">
            {stats.pnlBySymbol.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                No closed trades yet
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Symbol</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">
                        Trades
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">
                        Win Rate
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">
                        P&L
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.pnlBySymbol
                      .sort((a, b) => b.pnl - a.pnl)
                      .map((row) => (
                        <TableRow key={row.symbol}>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {row.symbol}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              {row.trades}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              color={
                                row.winRate >= 50
                                  ? 'success.main'
                                  : 'error.main'
                              }
                            >
                              {row.winRate}%
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <PnLDisplay
                              amount={row.pnl}
                              showSign
                              size="small"
                              bold
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Card>
        </Grid>

        {/* Performance by Bot */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card title="Performance by Bot">
            {stats.pnlByBot.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                No closed trades yet
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Bot</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">
                        Trades
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">
                        Win Rate
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">
                        P&L
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.pnlByBot
                      .sort((a, b) => b.pnl - a.pnl)
                      .map((row) => (
                        <TableRow key={row.botId}>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{
                                maxWidth: isMobile ? 100 : 160,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {row.botName}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              {row.trades}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              color={
                                row.winRate >= 50
                                  ? 'success.main'
                                  : 'error.main'
                              }
                            >
                              {row.winRate}%
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <PnLDisplay
                              amount={row.pnl}
                              showSign
                              size="small"
                              bold
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
