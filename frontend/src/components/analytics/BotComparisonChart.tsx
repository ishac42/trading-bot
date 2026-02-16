import React from 'react'
import {
  Box,
  Typography,
  Skeleton,
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
  Legend,
  Cell,
} from 'recharts'
import { Card } from '@/components/common'
import type { BotPerformanceData } from '@/types'

interface BotComparisonChartProps {
  data: BotPerformanceData[] | undefined
  isLoading: boolean
}

/**
 * Custom tooltip for the bot comparison chart
 */
const CustomTooltip: React.FC<{
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; payload: any }>
  label?: string
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null

  const bot = payload[0]?.payload

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        p: 1.5,
        boxShadow: 3,
        minWidth: 180,
      }}
    >
      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
        {bot?.botName}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: (bot?.totalPnL ?? 0) >= 0 ? 'success.main' : 'error.main',
        }}
      >
        P&L: {(bot?.totalPnL ?? 0) >= 0 ? '+' : ''}$
        {(bot?.totalPnL ?? 0).toFixed(2)}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Win Rate: {bot?.winRate ?? 0}%
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Trades: {bot?.totalTrades ?? 0}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        ROC: {(bot?.returnOnCapital ?? 0) >= 0 ? '+' : ''}
        {(bot?.returnOnCapital ?? 0).toFixed(2)}%
      </Typography>
    </Box>
  )
}

/**
 * BotComparisonChart Component
 *
 * Displays a horizontal bar chart comparing bot performance by P&L.
 * Bars are color-coded green (positive) and red (negative).
 */
export const BotComparisonChart: React.FC<BotComparisonChartProps> = ({
  data,
  isLoading,
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  if (isLoading) {
    return (
      <Card title="Bot Performance Comparison">
        <Skeleton variant="rectangular" height={250} sx={{ borderRadius: 1 }} />
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card title="Bot Performance Comparison">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 200,
            color: 'text.secondary',
          }}
        >
          <Typography variant="body2">No bot data available</Typography>
        </Box>
      </Card>
    )
  }

  // Sort by P&L descending
  const sortedData = [...data].sort((a, b) => b.totalPnL - a.totalPnL)

  return (
    <Card title="Bot Performance Comparison">
      <Box sx={{ width: '100%', height: Math.max(200, sortedData.length * 60) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sortedData}
            layout="vertical"
            margin={{
              top: 5,
              right: 30,
              left: isMobile ? 10 : 20,
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
              dataKey="botName"
              tick={{
                fontSize: isMobile ? 10 : 12,
                fill: theme.palette.text.secondary,
              }}
              width={isMobile ? 80 : 130}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="totalPnL"
              name="Total P&L"
              radius={[0, 4, 4, 0]}
              maxBarSize={35}
            >
              {sortedData.map((entry, index) => (
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
  )
}
