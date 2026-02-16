import React from 'react'
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import type { SelectChangeEvent } from '@mui/material'

export interface PositionFilterValues {
  botId: string
  symbol: string
  sortBy: string
}

interface PositionFiltersProps {
  filters: PositionFilterValues
  onFilterChange: (filters: PositionFilterValues) => void
  availableBots: { id: string; name: string }[]
  availableSymbols: string[]
}

/**
 * PositionFilters Component
 *
 * Provides filter controls for the Positions page:
 * - Bot filter dropdown
 * - Symbol filter dropdown
 * - Sort options
 */
export const PositionFilters: React.FC<PositionFiltersProps> = ({
  filters,
  onFilterChange,
  availableBots,
  availableSymbols,
}) => {
  const handleChange =
    (field: keyof PositionFilterValues) => (event: SelectChangeEvent) => {
      onFilterChange({
        ...filters,
        [field]: event.target.value,
      })
    }

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        mb: 3,
      }}
    >
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel id="bot-filter-label">Bot</InputLabel>
        <Select
          labelId="bot-filter-label"
          value={filters.botId}
          label="Bot"
          onChange={handleChange('botId')}
        >
          <MenuItem value="">
            <em>All Bots</em>
          </MenuItem>
          {availableBots.map((bot) => (
            <MenuItem key={bot.id} value={bot.id}>
              {bot.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel id="symbol-filter-label">Symbol</InputLabel>
        <Select
          labelId="symbol-filter-label"
          value={filters.symbol}
          label="Symbol"
          onChange={handleChange('symbol')}
        >
          <MenuItem value="">
            <em>All Symbols</em>
          </MenuItem>
          {availableSymbols.map((symbol) => (
            <MenuItem key={symbol} value={symbol}>
              {symbol}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel id="sort-filter-label">Sort By</InputLabel>
        <Select
          labelId="sort-filter-label"
          value={filters.sortBy}
          label="Sort By"
          onChange={handleChange('sortBy')}
        >
          <MenuItem value="">Default</MenuItem>
          <MenuItem value="symbol_asc">Symbol (A-Z)</MenuItem>
          <MenuItem value="symbol_desc">Symbol (Z-A)</MenuItem>
          <MenuItem value="unrealized_pnl_desc">P&L (High to Low)</MenuItem>
          <MenuItem value="unrealized_pnl_asc">P&L (Low to High)</MenuItem>
          <MenuItem value="opened_at_desc">Newest First</MenuItem>
          <MenuItem value="opened_at_asc">Oldest First</MenuItem>
          <MenuItem value="current_price_desc">Price (High to Low)</MenuItem>
          <MenuItem value="current_price_asc">Price (Low to High)</MenuItem>
        </Select>
      </FormControl>
    </Box>
  )
}
