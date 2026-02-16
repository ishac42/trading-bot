import React, { useEffect, useRef } from 'react'
import { Box, Typography } from '@mui/material'
import { createChart, ColorType } from 'lightweight-charts'
import type { IChartApi, ISeriesApi, LineSeries, AreaSeries } from 'lightweight-charts'
import type { Position } from '@/types'
import { useTheme } from '@mui/material/styles'

interface PositionChartProps {
  position: Position
}

/**
 * Generate mock price history data for a position.
 * In production, this would be fetched from the API.
 */
function generateMockPriceData(position: Position) {
  const data: { time: string; value: number }[] = []
  const now = new Date()
  const opened = new Date(position.opened_at)
  const totalMinutes = Math.max(
    Math.floor((now.getTime() - opened.getTime()) / (1000 * 60)),
    60
  )
  const intervalMinutes = Math.max(Math.floor(totalMinutes / 50), 1)

  let price = position.entry_price
  const volatility = position.entry_price * 0.002 // 0.2% volatility

  for (
    let i = 0;
    i <= totalMinutes;
    i += intervalMinutes
  ) {
    const time = new Date(opened.getTime() + i * 60 * 1000)
    // Random walk toward current price
    const progress = i / totalMinutes
    const target = position.entry_price + (position.current_price - position.entry_price) * progress
    price = target + (Math.random() - 0.5) * volatility * 2
    data.push({
      time: time.toISOString().slice(0, 10) + ' ' + time.toTimeString().slice(0, 5),
      value: Math.round(price * 100) / 100,
    })
  }

  // Ensure last point is current price
  if (data.length > 0) {
    data[data.length - 1].value = position.current_price
  }

  return data
}

/**
 * PositionChart Component
 *
 * Renders a TradingView Lightweight Chart showing:
 * - Price area/line chart
 * - Entry price horizontal line
 * - Stop loss horizontal line (red)
 * - Take profit horizontal line (green)
 * - Current price line
 */
export const PositionChart: React.FC<PositionChartProps> = ({ position }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const theme = useTheme()

  useEffect(() => {
    if (!chartContainerRef.current) return

    const isDark = theme.palette.mode === 'dark'

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: {
          type: ColorType.Solid,
          color: isDark ? '#1e1e1e' : '#ffffff',
        },
        textColor: isDark ? '#d1d4dc' : '#191919',
      },
      grid: {
        vertLines: { color: isDark ? '#2B2B43' : '#e1e3eb' },
        horzLines: { color: isDark ? '#2B2B43' : '#e1e3eb' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 280,
      rightPriceScale: {
        borderColor: isDark ? '#2B2B43' : '#e1e3eb',
      },
      timeScale: {
        borderColor: isDark ? '#2B2B43' : '#e1e3eb',
        timeVisible: true,
      },
    })

    chartRef.current = chart

    // Add area series for price
    const isProfit = position.unrealized_pnl >= 0
    const areaSeries = chart.addSeries('Area', {
      lineColor: isProfit ? '#4caf50' : '#f44336',
      topColor: isProfit
        ? 'rgba(76, 175, 80, 0.3)'
        : 'rgba(244, 67, 54, 0.3)',
      bottomColor: isProfit
        ? 'rgba(76, 175, 80, 0.05)'
        : 'rgba(244, 67, 54, 0.05)',
      lineWidth: 2,
    })

    // Generate and set data
    const priceData = generateMockPriceData(position)
    areaSeries.setData(priceData as any)

    // Add entry price line
    areaSeries.createPriceLine({
      price: position.entry_price,
      color: '#1976d2',
      lineWidth: 2,
      lineStyle: 2, // Dashed
      axisLabelVisible: true,
      title: 'Entry',
    })

    // Add stop loss line
    if (position.stop_loss_price) {
      areaSeries.createPriceLine({
        price: position.stop_loss_price,
        color: '#f44336',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Stop Loss',
      })
    }

    // Add take profit line
    if (position.take_profit_price) {
      areaSeries.createPriceLine({
        price: position.take_profit_price,
        color: '#4caf50',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Take Profit',
      })
    }

    // Fit content
    chart.timeScale().fitContent()

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
    }
  }, [position, theme.palette.mode])

  return (
    <Box>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 1 }}
      >
        Price Chart
      </Typography>
      <Box
        ref={chartContainerRef}
        sx={{
          width: '100%',
          borderRadius: 1,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
        }}
      />
    </Box>
  )
}
