import React from 'react'
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  useMediaQuery,
  useTheme,
  Collapse,
  IconButton,
  Typography,
  Chip,
} from '@mui/material'
import {
  FilterList as FilterIcon,
  Clear as ClearIcon,
} from '@mui/icons-material'
import type { SelectChangeEvent } from '@mui/material'
import type { TradeFilters as TradeFiltersType, DateRangePreset, TradeTypeFilter } from '@/types'
import { mockBots } from '@/mocks/dashboardData'

interface TradeFiltersProps {
  filters: TradeFiltersType
  onFiltersChange: (filters: TradeFiltersType) => void
}

const DATE_RANGE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom' },
]

/**
 * Get unique symbols from mock bots
 */
function getUniqueSymbols(): string[] {
  const symbols = new Set<string>()
  mockBots.forEach((bot) => bot.symbols.forEach((s) => symbols.add(s)))
  return Array.from(symbols).sort()
}

/**
 * Count active filters
 */
function countActiveFilters(filters: TradeFiltersType): number {
  let count = 0
  if (filters.dateRange !== 'all') count++
  if (filters.botId) count++
  if (filters.symbol) count++
  if (filters.type !== 'all') count++
  return count
}

const defaultFilters: TradeFiltersType = {
  dateRange: 'all',
  botId: '',
  symbol: '',
  type: 'all',
}

/**
 * TradeFilters Component
 *
 * Provides filtering controls for the trade history table.
 * Includes date range, bot filter, symbol filter, and trade type filter.
 * Collapses on mobile with a filter toggle button.
 */
export const TradeFilters: React.FC<TradeFiltersProps> = ({
  filters,
  onFiltersChange,
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [showFilters, setShowFilters] = React.useState(!isMobile)

  const symbols = React.useMemo(() => getUniqueSymbols(), [])
  const activeFilterCount = countActiveFilters(filters)

  const handleDateRangeChange = (
    _: React.MouseEvent<HTMLElement>,
    value: DateRangePreset | null
  ) => {
    if (value) {
      onFiltersChange({
        ...filters,
        dateRange: value,
        ...(value !== 'custom'
          ? { customStartDate: undefined, customEndDate: undefined }
          : {}),
      })
    }
  }

  const handleBotChange = (event: SelectChangeEvent<string>) => {
    onFiltersChange({ ...filters, botId: event.target.value })
  }

  const handleSymbolChange = (event: SelectChangeEvent<string>) => {
    onFiltersChange({ ...filters, symbol: event.target.value })
  }

  const handleTypeChange = (
    _: React.MouseEvent<HTMLElement>,
    value: TradeTypeFilter | null
  ) => {
    if (value) {
      onFiltersChange({ ...filters, type: value })
    }
  }

  const handleCustomStartDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, customStartDate: e.target.value })
  }

  const handleCustomEndDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, customEndDate: e.target.value })
  }

  const handleClearFilters = () => {
    onFiltersChange(defaultFilters)
  }

  return (
    <Box>
      {/* Mobile filter toggle */}
      {isMobile && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              onClick={() => setShowFilters(!showFilters)}
              size="small"
            >
              <FilterIcon />
            </IconButton>
            <Typography variant="body2" color="text.secondary">
              Filters
            </Typography>
            {activeFilterCount > 0 && (
              <Chip
                label={activeFilterCount}
                size="small"
                color="primary"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}
          </Box>
          {activeFilterCount > 0 && (
            <IconButton onClick={handleClearFilters} size="small">
              <ClearIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      )}

      <Collapse in={showFilters || !isMobile}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 2,
            alignItems: { xs: 'stretch', md: 'center' },
            flexWrap: 'wrap',
          }}
        >
          {/* Date Range */}
          <Box>
            <ToggleButtonGroup
              value={filters.dateRange}
              exclusive
              onChange={handleDateRangeChange}
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  textTransform: 'none',
                  px: { xs: 1, sm: 1.5 },
                  fontSize: { xs: '0.75rem', sm: '0.8125rem' },
                },
              }}
            >
              {DATE_RANGE_OPTIONS.map((opt) => (
                <ToggleButton key={opt.value} value={opt.value}>
                  {opt.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {/* Custom date inputs */}
          {filters.dateRange === 'custom' && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                type="date"
                label="From"
                value={filters.customStartDate || ''}
                onChange={handleCustomStartDate}
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ minWidth: 140 }}
              />
              <TextField
                type="date"
                label="To"
                value={filters.customEndDate || ''}
                onChange={handleCustomEndDate}
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ minWidth: 140 }}
              />
            </Box>
          )}

          {/* Bot Filter */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Bot</InputLabel>
            <Select
              value={filters.botId}
              onChange={handleBotChange}
              label="Bot"
            >
              <MenuItem value="">All Bots</MenuItem>
              {mockBots.map((bot) => (
                <MenuItem key={bot.id} value={bot.id}>
                  {bot.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Symbol Filter */}
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Symbol</InputLabel>
            <Select
              value={filters.symbol}
              onChange={handleSymbolChange}
              label="Symbol"
            >
              <MenuItem value="">All Symbols</MenuItem>
              {symbols.map((symbol) => (
                <MenuItem key={symbol} value={symbol}>
                  {symbol}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Type Filter */}
          <ToggleButtonGroup
            value={filters.type}
            exclusive
            onChange={handleTypeChange}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                textTransform: 'none',
                px: { xs: 1.5, sm: 2 },
                fontSize: { xs: '0.75rem', sm: '0.8125rem' },
              },
            }}
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="buy">Buy</ToggleButton>
            <ToggleButton value="sell">Sell</ToggleButton>
          </ToggleButtonGroup>

          {/* Clear Filters (desktop only) */}
          {!isMobile && activeFilterCount > 0 && (
            <Chip
              label="Clear Filters"
              onDelete={handleClearFilters}
              onClick={handleClearFilters}
              variant="outlined"
              size="small"
              sx={{ ml: 'auto' }}
            />
          )}
        </Box>
      </Collapse>
    </Box>
  )
}
