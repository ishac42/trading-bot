import React from 'react'
import {
  Box,
  Typography,
  Grid,
  Alert,
} from '@mui/material'
import { Select } from '@/components/common'
import type { SelectOption } from '@/components/common'

interface TradingWindowSectionProps {
  startHour: number
  startMinute: number
  endHour: number
  endMinute: number
  errors: Record<string, string>
  onChange: (field: string, value: number) => void
}

const hourOptions: SelectOption[] = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i.toString().padStart(2, '0'),
}))

const minuteOptions: SelectOption[] = [0, 15, 30, 45].map((m) => ({
  value: m,
  label: m.toString().padStart(2, '0'),
}))

/**
 * TradingWindowSection – Start/end time pickers with EST timezone display.
 */
export const TradingWindowSection: React.FC<TradingWindowSectionProps> = ({
  startHour,
  startMinute,
  endHour,
  endMinute,
  errors,
  onChange,
}) => {
  const formatTimeLabel = (hour: number, minute: number) => {
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period} EST`
  }

  return (
    <Box>
      <Typography variant="h3" sx={{ mb: 2, fontWeight: 600 }}>
        Trading Window
      </Typography>

      <Grid container spacing={2} alignItems="center">
        {/* Start Time */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Start Time *
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Select
              label="Hour"
              options={hourOptions}
              value={startHour}
              onChange={(e) =>
                onChange('start_hour', Number(e.target.value))
              }
              error={!!errors.start_hour}
              sx={{ minWidth: 80 }}
            />
            <Typography variant="h3">:</Typography>
            <Select
              label="Min"
              options={minuteOptions}
              value={startMinute}
              onChange={(e) =>
                onChange('start_minute', Number(e.target.value))
              }
              sx={{ minWidth: 80 }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              EST
            </Typography>
          </Box>
        </Grid>

        {/* End Time */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            End Time *
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Select
              label="Hour"
              options={hourOptions}
              value={endHour}
              onChange={(e) =>
                onChange('end_hour', Number(e.target.value))
              }
              error={!!errors.end_hour}
              sx={{ minWidth: 80 }}
            />
            <Typography variant="h3">:</Typography>
            <Select
              label="Min"
              options={minuteOptions}
              value={endMinute}
              onChange={(e) =>
                onChange('end_minute', Number(e.target.value))
              }
              sx={{ minWidth: 80 }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              EST
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {errors.trading_window && (
        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
          {errors.trading_window}
        </Typography>
      )}

      <Alert severity="info" sx={{ mt: 2 }} icon={false}>
        Bot will only trade between{' '}
        <strong>{formatTimeLabel(startHour, startMinute)}</strong> and{' '}
        <strong>{formatTimeLabel(endHour, endMinute)}</strong>
      </Alert>
    </Box>
  )
}
