import React from 'react'
import { Box, Grid, Typography } from '@mui/material'
import { Card } from '@/components/common'
import { formatCurrency } from '@/utils/formatters'
import type { BookAnalyticsMetrics } from '@/utils/bookAnalytics'

interface BookMetricsProps {
  metrics: BookAnalyticsMetrics
}

const Metric: React.FC<{ label: string; value: string; detail: string }> = ({ label, value, detail }) => (
  <Box
    sx={{
      p: 2,
      border: 1,
      borderColor: 'divider',
      borderRadius: 2,
      height: '100%',
    }}
  >
    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
      {label}
    </Typography>
    <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
      {value}
    </Typography>
    <Typography variant="caption" color="text.secondary">
      {detail}
    </Typography>
  </Box>
)

export const BookMetrics: React.FC<BookMetricsProps> = ({ metrics }) => (
  <Card title="Expectancy and cost">
    <Grid container spacing={1.5}>
      <Grid size={{ xs: 6, md: 3 }}>
        <Metric
          label="Expectancy"
          value={formatCurrency(metrics.expectancy, '$', true)}
          detail="Average net result per closed trade"
        />
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <Metric
          label="Turnover"
          value={`${metrics.turnover.toFixed(2)}×`}
          detail="Filled notional divided by equity"
        />
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <Metric
          label="CVaR 95%"
          value={formatCurrency(metrics.cvar95, '$', true)}
          detail="Average of the worst 5% of closed trades"
        />
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <Metric
          label="Cost / gross alpha"
          value={metrics.costToGrossAlphaPct == null ? '—' : `${metrics.costToGrossAlphaPct.toFixed(2)}%`}
          detail={`${formatCurrency(metrics.cost)} cost on ${formatCurrency(metrics.grossAlpha)} gross`}
        />
      </Grid>
    </Grid>
  </Card>
)
