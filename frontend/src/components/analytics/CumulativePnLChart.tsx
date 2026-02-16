import React, { useState } from 'react'
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Skeleton,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card } from '@/components/common'
import type { AnalyticsPnLDataPoint } from '@/types'

type ChartView = 'cumulative' | 'daily'

interface CumulativePnLChartProps {
  data: AnalyticsPnLDataPoint[] | undefined
  isLoading: boolean
}

/**
 * Custom tooltip for the chart
 */
const CustomTooltip: React.FC<{
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string }>
  label?: string
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null

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
        {label}
      </Typography>
      {payload.map((entry, index) => {
        const label =
          entry.dataKey === 'cumulativePnl'
            ? 'Cumulative'
            : entry.dataKey === 'pnl'
              ? 'Daily P&L'
              : entry.dataKey
        return (
          <Typography
            key={index}
            variant="body2"
            sx={{
              color: entry.value >= 0 ? 'success.main' : 'error.main',
              fontWeight: entry.dataKey === 'cumulativePnl' ? 600 : 400,
            }}
          >
            {label}: {entry.value >= 0 ? '+' : ''}${entry.value.toFixed(2)}
          </Typography>
        )
      })}
      {payload[0] && 'payload' in payload[0] && (
        <Typography variant="caption" color="text.secondary">
          {(payload[0] as any).payload?.tradeCount ?? 0} trade(s)
        </Typography>
      )}
    </Box>
  )
}

/**
 * CumulativePnLChart Component
 *
 * Displays a cumulative P&L area chart or daily P&L bar chart
 * with a toggle to switch between views.
 */
export const CumulativePnLChart: React.FC<CumulativePnLChartProps> = ({
  data,
  isLoading,
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [chartView, setChartView] = useState<ChartView>('cumulative')

  const handleViewChange = (
    _: React.MouseEvent<HTMLElement>,
    newView: ChartView | null
  ) => {
    if (newView) setChartView(newView)
  }

  if (isLoading) {
    return (
      <Card title="P&L Over Time">
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card title="P&L Over Time">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 300,
            color: 'text.secondary',
          }}
        >
          <Typography variant="body2">No P&L data available</Typography>
        </Box>
      </Card>
    )
  }

  const lastValue = data[data.length - 1]?.cumulativePnl ?? 0
  const isPositive = lastValue >= 0

  return (
    <Card
      title="P&L Over Time"
      actions={
        <ToggleButtonGroup
          value={chartView}
          exclusive
          onChange={handleViewChange}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              px: 1.5,
              py: 0.5,
              fontSize: '0.75rem',
            },
          }}
        >
          <ToggleButton value="cumulative">Cumulative</ToggleButton>
          <ToggleButton value="daily">Daily</ToggleButton>
        </ToggleButtonGroup>
      }
    >
      <Box sx={{ width: '100%', height: isMobile ? 250 : 350 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartView === 'cumulative' ? (
            <AreaChart
              data={data}
              margin={{
                top: 5,
                right: 10,
                left: isMobile ? 0 : 10,
                bottom: 5,
              }}
            >
              <defs>
                <linearGradient
                  id="analyticsPnlGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={
                      isPositive
                        ? theme.palette.success.main
                        : theme.palette.error.main
                    }
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={
                      isPositive
                        ? theme.palette.success.main
                        : theme.palette.error.main
                    }
                    stopOpacity={0.05}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={theme.palette.divider}
              />
              <XAxis
                dataKey="date"
                tick={{
                  fontSize: 11,
                  fill: theme.palette.text.secondary,
                }}
                tickFormatter={(value: string) => {
                  const d = new Date(value)
                  return `${d.getMonth() + 1}/${d.getDate()}`
                }}
              />
              <YAxis
                tick={{
                  fontSize: 11,
                  fill: theme.palette.text.secondary,
                }}
                tickFormatter={(value: number) => `$${value}`}
                width={isMobile ? 50 : 60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="cumulativePnl"
                stroke={
                  isPositive
                    ? theme.palette.success.main
                    : theme.palette.error.main
                }
                fill="url(#analyticsPnlGradient)"
                strokeWidth={2}
                name="Cumulative P&L"
              />
            </AreaChart>
          ) : (
            <BarChart
              data={data}
              margin={{
                top: 5,
                right: 10,
                left: isMobile ? 0 : 10,
                bottom: 5,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={theme.palette.divider}
              />
              <XAxis
                dataKey="date"
                tick={{
                  fontSize: 11,
                  fill: theme.palette.text.secondary,
                }}
                tickFormatter={(value: string) => {
                  const d = new Date(value)
                  return `${d.getMonth() + 1}/${d.getDate()}`
                }}
              />
              <YAxis
                tick={{
                  fontSize: 11,
                  fill: theme.palette.text.secondary,
                }}
                tickFormatter={(value: number) => `$${value}`}
                width={isMobile ? 50 : 60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
              />
              <Bar
                dataKey="pnl"
                name="Daily P&L"
                fill={theme.palette.primary.main}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </Box>
    </Card>
  )
}
