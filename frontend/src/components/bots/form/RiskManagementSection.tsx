import React from 'react'
import {
  Box,
  Typography,
  Grid,
  InputAdornment,
  Tooltip,
  IconButton,
} from '@mui/material'
import { HelpOutline as HelpIcon } from '@mui/icons-material'
import { Input } from '@/components/common'
import type { RiskManagement } from '@/types'

interface RiskManagementSectionProps {
  riskManagement: RiskManagement
  errors: Record<string, string>
  onChange: (field: keyof RiskManagement, value: number) => void
}

interface RiskFieldConfig {
  key: keyof RiskManagement
  label: string
  tooltip: string
  unit: string
  min: number
  max: number
  step: number
}

const RISK_FIELDS: RiskFieldConfig[] = [
  {
    key: 'stop_loss',
    label: 'Stop Loss',
    tooltip: 'Automatically sell if the position loses this percentage of value',
    unit: '%',
    min: 0.1,
    max: 50,
    step: 0.5,
  },
  {
    key: 'take_profit',
    label: 'Take Profit',
    tooltip: 'Automatically sell if the position gains this percentage of value',
    unit: '%',
    min: 0.1,
    max: 100,
    step: 0.5,
  },
  {
    key: 'max_position_size',
    label: 'Max Position Size',
    tooltip: 'Maximum percentage of capital that can be used for a single trade',
    unit: '%',
    min: 1,
    max: 100,
    step: 1,
  },
  {
    key: 'max_daily_loss',
    label: 'Max Daily Loss',
    tooltip: 'Stop trading for the day if total losses exceed this percentage',
    unit: '%',
    min: 1,
    max: 100,
    step: 1,
  },
  {
    key: 'max_concurrent_positions',
    label: 'Max Concurrent Positions',
    tooltip: 'Maximum number of open positions at any given time',
    unit: 'positions',
    min: 1,
    max: 50,
    step: 1,
  },
]

/**
 * RiskManagementSection – Inputs for stop loss, take profit, position sizing,
 * daily loss limit, and max concurrent positions, all with tooltips.
 */
export const RiskManagementSection: React.FC<RiskManagementSectionProps> = ({
  riskManagement,
  errors,
  onChange,
}) => {
  return (
    <Box>
      <Typography variant="h3" sx={{ mb: 2, fontWeight: 600 }}>
        Risk Management
      </Typography>

      <Grid container spacing={2.5}>
        {RISK_FIELDS.map((field) => (
          <Grid key={field.key} size={{ xs: 12, sm: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
              <Input
                label={field.label}
                required
                type="number"
                value={riskManagement[field.key] ?? ''}
                onChange={(e) =>
                  onChange(field.key, parseFloat(e.target.value) || 0)
                }
                error={!!errors[field.key]}
                helperText={errors[field.key]}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">{field.unit}</InputAdornment>
                    ),
                  },
                  htmlInput: {
                    min: field.min,
                    max: field.max,
                    step: field.step,
                  },
                }}
                size="small"
              />
              <Tooltip title={field.tooltip} arrow placement="top">
                <IconButton size="small" sx={{ mt: 1 }}>
                  <HelpIcon fontSize="small" color="action" />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
