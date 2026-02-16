import React, { useCallback } from 'react'
import {
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  Collapse,
  Grid,
  Divider,
} from '@mui/material'
import { Input } from '@/components/common'
import type { IndicatorDefinition } from '@/types'

/**
 * Predefined list of technical indicators and their configurable parameters.
 */
export const AVAILABLE_INDICATORS: IndicatorDefinition[] = [
  {
    key: 'RSI',
    label: 'RSI (Relative Strength Index)',
    description: 'Measures speed and magnitude of price changes',
    params: [
      { key: 'period', label: 'Period', defaultValue: 14, min: 2, max: 100 },
      { key: 'oversold', label: 'Oversold', defaultValue: 30, min: 0, max: 100 },
      { key: 'overbought', label: 'Overbought', defaultValue: 70, min: 0, max: 100 },
    ],
  },
  {
    key: 'MACD',
    label: 'MACD (Moving Average Convergence Divergence)',
    description: 'Shows relationship between two moving averages',
    params: [
      { key: 'fast', label: 'Fast Period', defaultValue: 12, min: 2, max: 100 },
      { key: 'slow', label: 'Slow Period', defaultValue: 26, min: 2, max: 200 },
      { key: 'signal', label: 'Signal Period', defaultValue: 9, min: 2, max: 100 },
    ],
  },
  {
    key: 'SMA',
    label: 'SMA (Simple Moving Average)',
    description: 'Average price over a specified number of periods',
    params: [
      { key: 'period', label: 'Period', defaultValue: 50, min: 2, max: 500 },
    ],
  },
  {
    key: 'EMA',
    label: 'EMA (Exponential Moving Average)',
    description: 'Weighted moving average giving more weight to recent prices',
    params: [
      { key: 'period', label: 'Period', defaultValue: 20, min: 2, max: 500 },
    ],
  },
  {
    key: 'Bollinger Bands',
    label: 'Bollinger Bands',
    description: 'Volatility bands placed above and below a moving average',
    params: [
      { key: 'period', label: 'Period', defaultValue: 20, min: 2, max: 200 },
      { key: 'stdDev', label: 'Std Dev', defaultValue: 2, min: 0.5, max: 5, step: 0.5 },
    ],
  },
  {
    key: 'Stochastic',
    label: 'Stochastic Oscillator',
    description: 'Compares closing price to price range over a given period',
    params: [
      { key: 'kPeriod', label: 'K Period', defaultValue: 14, min: 2, max: 100 },
      { key: 'dPeriod', label: 'D Period', defaultValue: 3, min: 2, max: 100 },
    ],
  },
]

interface IndicatorConfigSectionProps {
  /** Currently selected indicators with their param values: { RSI: { period: 14, ... }, ... } */
  indicators: Record<string, Record<string, number>>
  onChange: (indicators: Record<string, Record<string, number>>) => void
  error?: string
}

/**
 * IndicatorConfigSection – Checkbox list of indicators with dynamic parameter inputs.
 */
export const IndicatorConfigSection: React.FC<IndicatorConfigSectionProps> = ({
  indicators,
  onChange,
  error,
}) => {
  const isEnabled = (key: string) => key in indicators

  const handleToggle = useCallback(
    (def: IndicatorDefinition) => {
      const next = { ...indicators }
      if (isEnabled(def.key)) {
        delete next[def.key]
      } else {
        // Initialize with default values
        const defaults: Record<string, number> = {}
        def.params.forEach((p) => {
          defaults[p.key] = p.defaultValue
        })
        next[def.key] = defaults
      }
      onChange(next)
    },
    [indicators, onChange]
  )

  const handleParamChange = useCallback(
    (indicatorKey: string, paramKey: string, value: number) => {
      const next = { ...indicators }
      next[indicatorKey] = { ...next[indicatorKey], [paramKey]: value }
      onChange(next)
    },
    [indicators, onChange]
  )

  return (
    <Box>
      <Typography variant="h3" sx={{ mb: 1, fontWeight: 600 }}>
        Technical Indicators
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Select indicators to use for trading signals
      </Typography>

      {error && (
        <Typography variant="body2" color="error" sx={{ mb: 1 }}>
          {error}
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {AVAILABLE_INDICATORS.map((def) => {
          const enabled = isEnabled(def.key)
          return (
            <Box
              key={def.key}
              sx={{
                border: 1,
                borderColor: enabled ? 'primary.main' : 'divider',
                borderRadius: 1,
                p: 2,
                transition: 'border-color 0.2s',
                backgroundColor: enabled ? 'action.selected' : 'transparent',
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={enabled}
                    onChange={() => handleToggle(def)}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1" fontWeight={500}>
                      {def.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {def.description}
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start', mr: 0 }}
              />

              <Collapse in={enabled} timeout={200}>
                <Divider sx={{ my: 1.5 }} />
                <Grid container spacing={2}>
                  {def.params.map((param) => (
                    <Grid key={param.key} size={{ xs: 6, sm: 4, md: 3 }}>
                      <Input
                        label={param.label}
                        type="number"
                        size="small"
                        value={indicators[def.key]?.[param.key] ?? param.defaultValue}
                        onChange={(e) =>
                          handleParamChange(
                            def.key,
                            param.key,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        slotProps={{
                          htmlInput: {
                            min: param.min,
                            max: param.max,
                            step: param.step ?? 1,
                          },
                        }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Collapse>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
