import { Alert, Box, Chip, Grid, LinearProgress, Skeleton, Typography } from '@mui/material'
import { Card, PnLDisplay } from '@/components/common'
import type { BookSummary as BookSummaryModel, ThrottleStage } from '@/types'
import { formatCurrency, formatPercentage } from '@/utils/formatters'

const throttleLabel: Record<ThrottleStage, string> = {
  normal: 'Normal',
  half: 'Throttled — half size',
  stop_new: 'No new risk',
  locked: 'Locked',
}

const throttleColor: Record<ThrottleStage, 'success' | 'warning' | 'error'> = {
  normal: 'success',
  half: 'warning',
  stop_new: 'warning',
  locked: 'error',
}

interface BookSummaryProps {
  summary?: BookSummaryModel
  isLoading?: boolean
}

const BookSummary = ({ summary, isLoading = false }: BookSummaryProps) => {
  if (isLoading || !summary) {
    return (
      <Grid container spacing={{ xs: 2, md: 3 }}>
        {[1, 2, 3, 4].map((item) => (
          <Grid key={item} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <Skeleton variant="text" width="50%" />
              <Skeleton variant="text" width="80%" height={36} />
            </Card>
          </Grid>
        ))}
      </Grid>
    )
  }

  const lockProgress = Math.min(
    100,
    Math.max(0, (Math.abs(Math.min(summary.marked_daily_pnl_pct, 0)) / Math.abs(summary.daily_lock_pct)) * 100)
  )
  const freshness = summary.data_freshness
  const empty = summary.position_count === 0 && summary.open_stop_risk === 0

  return (
    <Box>
      {freshness.stale && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Market data is stale
          {freshness.age_seconds != null ? ` (${freshness.age_seconds}s)` : ''}. New risk is frozen until quotes recover.
        </Alert>
      )}
      {summary.kill_switch.locked && (
        <Alert severity="error" sx={{ mb: 2 }}>
          The book is locked at the {formatPercentage(summary.daily_lock_pct, false)} daily-loss line. New entries are refused.
        </Alert>
      )}
      {empty && !summary.kill_switch.locked && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No open risk. The book is flat.
        </Alert>
      )}

      <Grid container spacing={{ xs: 2, md: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <Typography variant="body2" color="text.secondary">
              Book equity
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {formatCurrency(summary.equity)}
            </Typography>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <Typography variant="body2" color="text.secondary">
              Marked daily P&L
            </Typography>
            <PnLDisplay amount={summary.marked_daily_pnl} percentage={summary.marked_daily_pnl_pct} showSign bold />
            <Box sx={{ mt: 1 }}>
              <LinearProgress variant="determinate" value={lockProgress} color={lockProgress >= 100 ? 'error' : 'primary'} />
              <Typography variant="caption" color="text.secondary">
                {formatPercentage(summary.marked_daily_pnl_pct)} of {formatPercentage(summary.daily_lock_pct, false)} lock
              </Typography>
            </Box>
            <Chip
              size="small"
              label={throttleLabel[summary.throttle_stage]}
              color={throttleColor[summary.throttle_stage]}
              sx={{ mt: 1 }}
            />
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <Typography variant="body2" color="text.secondary">
              Open stop-risk
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {formatCurrency(summary.open_stop_risk)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatPercentage(summary.open_stop_risk_pct, false)} of equity
            </Typography>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <Typography variant="body2" color="text.secondary">
              Positions
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {summary.position_count}
              <Typography component="span" variant="body2" color="text.secondary">
                {' '}
                / {summary.max_positions}
              </Typography>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Regime: {summary.regime ?? '—'}
            </Typography>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card>
            <Typography variant="body2" color="text.secondary">
              Data freshness
            </Typography>
            <Typography variant="h6" fontWeight={700} color={freshness.stale ? 'error.main' : 'success.main'}>
              {freshness.stale ? 'Stale' : 'Fresh'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {freshness.feed.toUpperCase()}
              {freshness.age_seconds != null ? ` · ${freshness.age_seconds}s old` : ''}
            </Typography>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card>
            <Typography variant="body2" color="text.secondary">
              Kill switch
            </Typography>
            <Typography variant="h6" fontWeight={700} color={summary.kill_switch.halted ? 'error.main' : 'success.main'}>
              {summary.kill_switch.halted ? 'Halted' : 'Armed'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {summary.kill_switch.locked ? 'Daily lock is on' : 'Not locked'}
            </Typography>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default BookSummary
