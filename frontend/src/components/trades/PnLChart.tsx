import React from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface PnLChartProps {
  data: { date: string; pnl: number; cumulativePnl: number }[]
}

/**
 * Custom tooltip for the P&L chart
 */
const CustomTooltip: React.FC<{
  active?: boolean
  payload?: Array<{ value: number; dataKey: string }>
  label?: string
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null

  const cumulative = payload.find((p) => p.dataKey === 'cumulativePnl')
  const daily = payload.find((p) => p.dataKey === 'pnl')

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        p: 1.5,
        boxShadow: 2,
      }}
    >
      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      {daily && (
        <Typography
          variant="body2"
          sx={{
            color: daily.value >= 0 ? 'success.main' : 'error.main',
          }}
        >
          Daily: {daily.value >= 0 ? '+' : ''}${daily.value.toFixed(2)}
        </Typography>
      )}
      {cumulative && (
        <Typography
          variant="body2"
          sx={{
            color: cumulative.value >= 0 ? 'success.main' : 'error.main',
            fontWeight: 600,
          }}
        >
          Cumulative: {cumulative.value >= 0 ? '+' : ''}$
          {cumulative.value.toFixed(2)}
        </Typography>
      )}
    </Box>
  )
}

/**
 * PnLChart Component
 *
 * Displays a cumulative P&L area chart over time.
 * Green fill when positive, red fill when negative.
 */
export const PnLChart: React.FC<PnLChartProps> = ({ data }) => {
  const theme = useTheme()

  if (data.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 250,
          color: 'text.secondary',
        }}
      >
        <Typography variant="body2">No P&L data available</Typography>
      </Box>
    )
  }

  const lastValue = data[data.length - 1]?.cumulativePnl ?? 0
  const isPositive = lastValue >= 0
  const fillColor = isPositive
    ? theme.palette.success.main
    : theme.palette.error.main
  const strokeColor = fillColor

  return (
    <Box sx={{ width: '100%', height: 250 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
        >
          <defs>
            <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={fillColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={fillColor} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={theme.palette.divider}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
            tickFormatter={(value: string) => {
              const d = new Date(value)
              return `${d.getMonth() + 1}/${d.getDate()}`
            }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
            tickFormatter={(value: number) => `$${value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="cumulativePnl"
            stroke={strokeColor}
            fill="url(#pnlGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  )
}
