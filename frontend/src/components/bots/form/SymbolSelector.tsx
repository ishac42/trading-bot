import React, { useState, useCallback } from 'react'
import {
  Box,
  Typography,
  Chip,
  TextField,
  Autocomplete,
} from '@mui/material'
import { Add as AddIcon } from '@mui/icons-material'

/** Common stock symbols for autocomplete suggestions */
const POPULAR_SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX',
  'AMD', 'INTC', 'SPY', 'QQQ', 'DIA', 'IWM', 'VTI',
  'JPM', 'BAC', 'GS', 'V', 'MA',
  'JNJ', 'PFE', 'UNH', 'ABBV', 'MRK',
  'XOM', 'CVX', 'COP', 'SLB', 'EOG',
]

interface SymbolSelectorProps {
  symbols: string[]
  onChange: (symbols: string[]) => void
  error?: string
}

/**
 * SymbolSelector – Multi-select chips with autocomplete for adding stock symbols.
 */
export const SymbolSelector: React.FC<SymbolSelectorProps> = ({
  symbols,
  onChange,
  error,
}) => {
  const [inputValue, setInputValue] = useState('')

  const handleAddSymbol = useCallback(
    (symbol: string) => {
      const upper = symbol.trim().toUpperCase()
      if (upper && !symbols.includes(upper)) {
        onChange([...symbols, upper])
      }
      setInputValue('')
    },
    [symbols, onChange]
  )

  const handleRemoveSymbol = useCallback(
    (symbol: string) => {
      onChange(symbols.filter((s) => s !== symbol))
    },
    [symbols, onChange]
  )

  // Filter out already-selected symbols
  const availableOptions = POPULAR_SYMBOLS.filter((s) => !symbols.includes(s))

  return (
    <Box>
      <Typography variant="h3" sx={{ mb: 2, fontWeight: 600 }}>
        Symbols
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Select the stock symbols this bot will trade *
      </Typography>

      {/* Selected symbols */}
      {symbols.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {symbols.map((symbol) => (
            <Chip
              key={symbol}
              label={symbol}
              onDelete={() => handleRemoveSymbol(symbol)}
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
          ))}
        </Box>
      )}

      {/* Autocomplete input */}
      <Autocomplete
        freeSolo
        options={availableOptions}
        inputValue={inputValue}
        onInputChange={(_e, value) => setInputValue(value)}
        onChange={(_e, value) => {
          if (typeof value === 'string') {
            handleAddSymbol(value)
          }
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Search & add symbol"
            placeholder="Type a symbol (e.g. AAPL) and press Enter"
            size="small"
            error={!!error}
            helperText={error}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputValue.trim()) {
                e.preventDefault()
                handleAddSymbol(inputValue)
              }
            }}
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props} key={option}>
            <AddIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
            {option}
          </Box>
        )}
      />
    </Box>
  )
}
