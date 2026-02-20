import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  TextField,
  Button,
  FormControlLabel,
  Checkbox,
  Switch,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material'
import type { NotificationSettings as NotifSettings } from '@/types'
import type { UseMutationResult } from '@tanstack/react-query'

interface NotificationSettingsProps {
  notifications: NotifSettings | undefined
  updateNotifications: UseMutationResult<any, Error, NotifSettings>
}

const NotificationSettings = ({
  notifications,
  updateNotifications,
}: NotificationSettingsProps) => {
  const [form, setForm] = useState<NotifSettings>({
    email_enabled: false,
    email_address: '',
    notify_trade_executed: true,
    notify_bot_error: true,
    notify_daily_summary: false,
    notify_stop_loss_hit: true,
    notify_market_hours: false,
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (notifications) setForm(notifications)
  }, [notifications])

  const handleSave = async () => {
    await updateNotifications.mutateAsync(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const toggle = (field: keyof NotifSettings) => {
    setForm((prev) => ({ ...prev, [field]: !prev[field] }))
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Notifications
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure how and when you receive notifications about your trading
        activity. Email delivery will be available in a future update.
      </Typography>

      {/* Master Toggle */}
      <FormControlLabel
        control={
          <Switch
            checked={form.email_enabled}
            onChange={() => toggle('email_enabled')}
          />
        }
        label="Enable email notifications"
        sx={{ mb: 2 }}
      />

      {form.email_enabled && (
        <TextField
          label="Email Address"
          value={form.email_address}
          onChange={(e) => setForm({ ...form, email_address: e.target.value })}
          placeholder="you@example.com"
          fullWidth
          size="small"
          sx={{ mb: 3 }}
        />
      )}

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Notification Triggers
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 3 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={form.notify_trade_executed}
              onChange={() => toggle('notify_trade_executed')}
            />
          }
          label="Trade executed (buy/sell filled)"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={form.notify_bot_error}
              onChange={() => toggle('notify_bot_error')}
            />
          }
          label="Bot error or stopped unexpectedly"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={form.notify_daily_summary}
              onChange={() => toggle('notify_daily_summary')}
            />
          }
          label="Daily P&L summary"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={form.notify_stop_loss_hit}
              onChange={() => toggle('notify_stop_loss_hit')}
            />
          }
          label="Stop-loss or take-profit triggered"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={form.notify_market_hours}
              onChange={() => toggle('notify_market_hours')}
            />
          }
          label="Market open/close reminders"
        />
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Email delivery is not yet active. Your preferences are saved and will
        take effect when the notification service is enabled.
      </Alert>

      <Button
        variant="contained"
        onClick={handleSave}
        disabled={updateNotifications.isPending}
      >
        {updateNotifications.isPending ? (
          <CircularProgress size={20} />
        ) : (
          'Save Preferences'
        )}
      </Button>

      {saved && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Notification preferences saved.
        </Alert>
      )}
    </Box>
  )
}

export default NotificationSettings
