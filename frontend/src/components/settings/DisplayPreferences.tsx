import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import type { DisplaySettings } from '@/types'
import type { UseMutationResult } from '@tanstack/react-query'

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'UTC',
]

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF']

const DATE_FORMATS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (EU)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO)' },
]

const REFRESH_INTERVALS = [
  { value: 0, label: 'Disabled' },
  { value: 15, label: '15 seconds' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
]

const DECIMAL_OPTIONS = [
  { value: 0, label: '0 ($100)' },
  { value: 2, label: '2 ($100.50)' },
  { value: 4, label: '4 ($100.5025)' },
]

interface DisplayPreferencesProps {
  display: DisplaySettings | undefined
  updateDisplay: UseMutationResult<any, Error, DisplaySettings>
}

const DisplayPreferences = ({ display, updateDisplay }: DisplayPreferencesProps) => {
  const [form, setForm] = useState<DisplaySettings>({
    timezone: 'America/New_York',
    currency: 'USD',
    decimal_places: 2,
    date_format: 'MM/DD/YYYY',
    refresh_interval: 30,
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (display) setForm(display)
  }, [display])

  const handleSave = async () => {
    await updateDisplay.mutateAsync(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Display Preferences
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Customize how data is displayed throughout the application.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mb: 3 }}>
        <FormControl fullWidth size="small">
          <InputLabel>Timezone</InputLabel>
          <Select
            value={form.timezone}
            label="Timezone"
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          >
            {TIMEZONES.map((tz) => (
              <MenuItem key={tz} value={tz}>
                {tz.replace(/_/g, ' ')}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small">
          <InputLabel>Currency</InputLabel>
          <Select
            value={form.currency}
            label="Currency"
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          >
            {CURRENCIES.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small">
          <InputLabel>Decimal Places</InputLabel>
          <Select
            value={form.decimal_places}
            label="Decimal Places"
            onChange={(e) =>
              setForm({ ...form, decimal_places: Number(e.target.value) })
            }
          >
            {DECIMAL_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small">
          <InputLabel>Date Format</InputLabel>
          <Select
            value={form.date_format}
            label="Date Format"
            onChange={(e) => setForm({ ...form, date_format: e.target.value })}
          >
            {DATE_FORMATS.map((fmt) => (
              <MenuItem key={fmt.value} value={fmt.value}>
                {fmt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small">
          <InputLabel>Dashboard Refresh Interval</InputLabel>
          <Select
            value={form.refresh_interval}
            label="Dashboard Refresh Interval"
            onChange={(e) =>
              setForm({ ...form, refresh_interval: Number(e.target.value) })
            }
          >
            {REFRESH_INTERVALS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Button
        variant="contained"
        onClick={handleSave}
        disabled={updateDisplay.isPending}
      >
        {updateDisplay.isPending ? <CircularProgress size={20} /> : 'Save Preferences'}
      </Button>

      {saved && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Display preferences saved.
        </Alert>
      )}
    </Box>
  )
}

export default DisplayPreferences
