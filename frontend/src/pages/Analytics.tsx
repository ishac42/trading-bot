import React, { useMemo, useState } from 'react'
import { Box, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material'
import { PerformanceOverview, CumulativePnLChart, SymbolPerformance } from '@/components/analytics'
import { BookMetrics } from '@/components/analytics/BookMetrics'
import { BookSplits } from '@/components/analytics/BookSplits'
import { useBook } from '@/hooks/useBook'
import { buildBookAnalytics } from '@/utils/bookAnalytics'
import type { AnalyticsTimeRange } from '@/types'

const TIME_RANGE_OPTIONS: { value: AnalyticsTimeRange; label: string }[] = [
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'All' },
]

const Analytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>('ALL')
  const { trades, bots, summary } = useBook()

  const data = useMemo(
    () =>
      buildBookAnalytics(trades, {
        equity: summary.equity,
        bots: bots.map((bot) => ({ id: bot.id, name: bot.name })),
        timeRange,
      }),
    [trades, bots, summary.equity, timeRange]
  )

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: { xs: 2, sm: 3 },
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' },
            fontWeight: 'bold',
          }}
        >
          Analytics
        </Typography>

        <ToggleButtonGroup
          value={timeRange}
          exclusive
          onChange={(_, next: AnalyticsTimeRange | null) => {
            if (next) setTimeRange(next)
          }}
          size="small"
          aria-label="Analytics time range"
          sx={{
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              px: { xs: 1, sm: 1.5 },
              py: 0.5,
              fontSize: { xs: '0.7rem', sm: '0.8rem' },
              fontWeight: 600,
            },
          }}
        >
          {TIME_RANGE_OPTIONS.map((option) => (
            <ToggleButton key={option.value} value={option.value}>
              {option.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ mb: { xs: 2, md: 3 } }}>
        <PerformanceOverview overview={data.overview} isLoading={false} />
      </Box>

      <Box sx={{ mb: { xs: 2, md: 3 } }}>
        <BookMetrics metrics={data.metrics} />
      </Box>

      <Box sx={{ mb: { xs: 2, md: 3 } }}>
        <CumulativePnLChart data={data.pnlTimeSeries} isLoading={false} />
      </Box>

      <Box sx={{ mb: { xs: 2, md: 3 } }}>
        <BookSplits byRegime={data.byRegime} bySession={data.bySession} byBot={data.byBot} />
      </Box>

      <SymbolPerformance data={data.symbolPerformance} isLoading={false} />
    </Box>
  )
}

export default Analytics
