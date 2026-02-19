import React from 'react'
import {
  Box,
  Typography,
  InputAdornment,
} from '@mui/material'
import { Input } from '@/components/common'
import { useAccount } from '@/hooks/useAccount'
import { formatCurrency } from '@/utils/formatters'

interface BasicInfoSectionProps {
  name: string
  capital: number
  tradingFrequency: number
  errors: Record<string, string>
  onChange: (field: string, value: string | number) => void
}

/**
 * BasicInfoSection – Bot name, capital allocation, and trading frequency inputs.
 */
export const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({
  name,
  capital,
  tradingFrequency,
  errors,
  onChange,
}) => {
  const { data: account } = useAccount()

  const availableCapital = account?.available_capital ?? null
  const capitalHelperText = errors.capital
    || (availableCapital !== null
      ? `Available: ${formatCurrency(availableCapital)} of ${formatCurrency(account?.buying_power ?? 0)} buying power`
      : 'Total capital this bot can use for trading')

  return (
    <Box>
      <Typography variant="h3" sx={{ mb: 2, fontWeight: 600 }}>
        Basic Information
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Input
          label="Bot Name"
          required
          value={name}
          onChange={(e) => onChange('name', e.target.value)}
          error={!!errors.name}
          helperText={errors.name || 'Give your bot a descriptive name'}
          placeholder="e.g. Momentum Bot #1"
        />

        <Input
          label="Capital Allocation"
          required
          type="number"
          value={capital || ''}
          onChange={(e) => onChange('capital', parseFloat(e.target.value) || 0)}
          error={!!errors.capital}
          helperText={capitalHelperText}
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            },
          }}
        />

        <Input
          label="Trading Frequency"
          required
          type="number"
          value={tradingFrequency || ''}
          onChange={(e) =>
            onChange('trading_frequency', parseInt(e.target.value) || 0)
          }
          error={!!errors.trading_frequency}
          helperText={
            errors.trading_frequency ||
            `Check for trading signals every ${tradingFrequency || 60} seconds`
          }
          slotProps={{
            input: {
              endAdornment: <InputAdornment position="end">seconds</InputAdornment>,
            },
          }}
        />
      </Box>
    </Box>
  )
}
