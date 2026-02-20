import React, { useState } from 'react'
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Chip,
  Skeleton,
  Grid,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card, PnLDisplay } from '@/components/common'
import { formatCompactCurrency } from '@/utils/formatters'
import type { SymbolPerformanceData } from '@/types'

interface SymbolPerformanceProps {
  data: SymbolPerformanceData[] | undefined
  isLoading: boolean
}

type SortField = 'symbol' | 'totalPnL' | 'winRate' | 'totalTrades' | 'totalVolume'
type SortDir = 'asc' | 'desc'

/**
 * Custom tooltip for the symbol chart
 */
const CustomTooltip: React.FC<{
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; payload: any }>
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null

  const sym = payload[0]?.payload

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        p: 1.5,
        boxShadow: 3,
        minWidth: 160,
      }}
    >
      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
        {sym?.symbol}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: (sym?.totalPnL ?? 0) >= 0 ? 'success.main' : 'error.main',
        }}
      >
        P&L: {(sym?.totalPnL ?? 0) >= 0 ? '+' : ''}$
        {(sym?.totalPnL ?? 0).toFixed(2)}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Win Rate: {sym?.winRate ?? 0}%
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Trades: {sym?.totalTrades ?? 0}
      </Typography>
    </Box>
  )
}

/**
 * SymbolPerformance Component
 *
 * Displays a chart and table showing performance metrics per symbol.
 * The chart shows P&L per symbol; the table provides detailed breakdown.
 */
export const SymbolPerformance: React.FC<SymbolPerformanceProps> = ({
  data,
  isLoading,
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [sortField, setSortField] = useState<SortField>('totalPnL')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  if (isLoading) {
    return (
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card title="P&L by Symbol">
            <Skeleton variant="rectangular" height={250} sx={{ borderRadius: 1 }} />
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card title="Symbol Details">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton
                key={i}
                variant="rectangular"
                height={40}
                sx={{ borderRadius: 1, mb: 1 }}
              />
            ))}
          </Card>
        </Grid>
      </Grid>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card title="Symbol Performance">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 120,
            color: 'text.secondary',
          }}
        >
          <Typography variant="body2">No symbol data available</Typography>
        </Box>
      </Card>
    )
  }

  const sortedData = [...data].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    switch (sortField) {
      case 'symbol':
        return dir * a.symbol.localeCompare(b.symbol)
      case 'totalPnL':
        return dir * (a.totalPnL - b.totalPnL)
      case 'winRate':
        return dir * (a.winRate - b.winRate)
      case 'totalTrades':
        return dir * (a.totalTrades - b.totalTrades)
      case 'totalVolume':
        return dir * (a.totalVolume - b.totalVolume)
      default:
        return 0
    }
  })

  // Chart data sorted by P&L
  const chartData = [...data].sort((a, b) => b.totalPnL - a.totalPnL)

  const SortHeader: React.FC<{
    field: SortField
    label: string
    align?: 'left' | 'right'
  }> = ({ field, label, align = 'right' }) => (
    <TableCell align={align} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
      <TableSortLabel
        active={sortField === field}
        direction={sortField === field ? sortDir : 'desc'}
        onClick={() => handleSort(field)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  )

  return (
    <Grid container spacing={2}>
      {/* P&L by Symbol Chart */}
      <Grid size={{ xs: 12, md: 5 }}>
        <Card title="P&L by Symbol">
          <Box sx={{ width: '100%', height: Math.max(200, chartData.length * 45) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{
                  top: 5,
                  right: 20,
                  left: isMobile ? 5 : 10,
                  bottom: 5,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={theme.palette.divider}
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{
                    fontSize: 11,
                    fill: theme.palette.text.secondary,
                  }}
                  tickFormatter={(value: number) => `$${value}`}
                />
                <YAxis
                  type="category"
                  dataKey="symbol"
                  tick={{
                    fontSize: 12,
                    fill: theme.palette.text.secondary,
                    fontWeight: 600,
                  }}
                  width={55}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="totalPnL"
                  name="P&L"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={28}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.totalPnL >= 0
                          ? theme.palette.success.main
                          : theme.palette.error.main
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Card>
      </Grid>

      {/* Symbol Details Table */}
      <Grid size={{ xs: 12, md: 7 }}>
        <Card title="Symbol Details">
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <SortHeader field="symbol" label="Symbol" align="left" />
                  <SortHeader field="totalPnL" label="P&L" />
                  <SortHeader field="winRate" label="Win Rate" />
                  <SortHeader field="totalTrades" label="Trades" />
                  {!isMobile && (
                    <SortHeader field="totalVolume" label="Volume" />
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedData.map((sym) => (
                  <TableRow
                    key={sym.symbol}
                    sx={{ '&:hover': { bgcolor: 'action.hover' } }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {sym.symbol}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <PnLDisplay
                        amount={sym.totalPnL}
                        showSign
                        size="small"
                        bold
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={`${sym.winRate}%`}
                        size="small"
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          height: 24,
                          bgcolor:
                            sym.winRate >= 50
                              ? `${theme.palette.success.main}20`
                              : `${theme.palette.error.main}20`,
                          color:
                            sym.winRate >= 50
                              ? theme.palette.success.main
                              : theme.palette.error.main,
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {sym.totalTrades}
                        {!isMobile && (
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                            sx={{ ml: 0.5 }}
                          >
                            ({sym.winningTrades}W/{sym.losingTrades}L)
                          </Typography>
                        )}
                      </Typography>
                    </TableCell>
                    {!isMobile && (
                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary">
                          {formatCompactCurrency(sym.totalVolume)}
                        </Typography>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Grid>
    </Grid>
  )
}
