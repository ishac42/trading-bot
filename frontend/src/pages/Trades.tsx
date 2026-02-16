import React, { useState, useCallback } from 'react'
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Tooltip,
  IconButton,
  Alert,
  Collapse,
} from '@mui/material'
import {
  Download as DownloadIcon,
  Analytics as AnalyticsIcon,
  TableChart as TableChartIcon,
} from '@mui/icons-material'
import { useSearchParams } from 'react-router-dom'
import { TradeFilters, TradeTable, TradeDetailModal, TradeAnalysis } from '@/components/trades'
import { useTrades } from '@/hooks/useTrades'
import { useTradeStats } from '@/hooks/useTradeStats'
import { exportTradesToCsv } from '@/utils/csvExport'
import { mockTrades } from '@/mocks/dashboardData'
import type {
  Trade,
  TradeFilters as TradeFiltersType,
  TradeSort,
  DateRangePreset,
  TradeTypeFilter,
} from '@/types'

/**
 * Parse URL search params into TradeFilters
 */
function parseFiltersFromParams(params: URLSearchParams): TradeFiltersType {
  return {
    dateRange: (params.get('dateRange') as DateRangePreset) || 'all',
    customStartDate: params.get('startDate') || undefined,
    customEndDate: params.get('endDate') || undefined,
    botId: params.get('botId') || '',
    symbol: params.get('symbol') || '',
    type: (params.get('type') as TradeTypeFilter) || 'all',
  }
}

/**
 * Serialize TradeFilters to URL search params
 */
function filtersToParams(filters: TradeFiltersType): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.dateRange !== 'all') params.set('dateRange', filters.dateRange)
  if (filters.customStartDate) params.set('startDate', filters.customStartDate)
  if (filters.customEndDate) params.set('endDate', filters.customEndDate)
  if (filters.botId) params.set('botId', filters.botId)
  if (filters.symbol) params.set('symbol', filters.symbol)
  if (filters.type !== 'all') params.set('type', filters.type)
  return params
}

/**
 * Trades Page
 *
 * Full trade history page with:
 * - Filters (date range, bot, symbol, type)
 * - Sortable & paginated trade table
 * - Trade detail modal on row click
 * - Trade analysis with stats and P&L chart
 * - CSV export
 * - URL query params for shareable filter state
 */
const Trades: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  // Filters from URL
  const filters = parseFiltersFromParams(searchParams)
  const setFilters = useCallback(
    (newFilters: TradeFiltersType) => {
      setSearchParams(filtersToParams(newFilters), { replace: true })
    },
    [setSearchParams]
  )

  // Sorting state
  const [sort, setSort] = useState<TradeSort>({
    field: 'timestamp',
    direction: 'desc',
  })

  // Pagination state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Tab state (table vs analysis)
  const [activeTab, setActiveTab] = useState(0)

  // Trade detail modal
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)

  // Export feedback
  const [showExportSuccess, setShowExportSuccess] = useState(false)

  // Data fetching
  const {
    data: tradesData,
    isLoading: isLoadingTrades,
    error: tradesError,
  } = useTrades({ filters, sort, page, pageSize })

  const {
    data: tradeStats,
    isLoading: isLoadingStats,
  } = useTradeStats(filters)

  // Reset page when filters change
  React.useEffect(() => {
    setPage(1)
  }, [filters.dateRange, filters.botId, filters.symbol, filters.type])

  const handleRowClick = useCallback((trade: Trade) => {
    setSelectedTrade(trade)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setSelectedTrade(null)
  }, [])

  const handleExportCsv = useCallback(() => {
    // For export, we use all filtered trades (not paginated)
    // In a real app, this would be a separate API call
    // For mock, we replicate the filter logic
    const allTrades = mockTrades
      .filter((trade) => {
        if (filters.botId && trade.bot_id !== filters.botId) return false
        if (filters.symbol && trade.symbol !== filters.symbol) return false
        if (filters.type !== 'all' && trade.type !== filters.type) return false
        return true
      })
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )

    exportTradesToCsv(allTrades)
    setShowExportSuccess(true)
    setTimeout(() => setShowExportSuccess(false), 3000)
  }, [filters])

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
  }

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: { xs: 2, sm: 3 },
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' },
            fontWeight: 'bold',
          }}
        >
          Trade History
        </Typography>
        <Tooltip title="Export filtered trades as CSV">
          <IconButton onClick={handleExportCsv} color="primary">
            <DownloadIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Export Success */}
      <Collapse in={showExportSuccess}>
        <Alert
          severity="success"
          onClose={() => setShowExportSuccess(false)}
          sx={{ mb: 2 }}
        >
          Trades exported successfully!
        </Alert>
      </Collapse>

      {/* Error */}
      {tradesError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load trades. Please try again.
        </Alert>
      )}

      {/* Filters */}
      <Box sx={{ mb: 2 }}>
        <TradeFilters filters={filters} onFiltersChange={setFilters} />
      </Box>

      {/* Tab Navigation */}
      <Box sx={{ mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            '& .MuiTab-root': { textTransform: 'none', minHeight: 42 },
            '& .MuiTabs-indicator': { height: 2 },
          }}
        >
          <Tab
            icon={<TableChartIcon fontSize="small" />}
            iconPosition="start"
            label="Trades"
            sx={{ fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}
          />
          <Tab
            icon={<AnalyticsIcon fontSize="small" />}
            iconPosition="start"
            label="Analysis"
            sx={{ fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}
          />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {activeTab === 0 ? (
        <TradeTable
          trades={tradesData?.trades || []}
          pagination={
            tradesData?.pagination || {
              page: 1,
              pageSize: 10,
              totalItems: 0,
              totalPages: 1,
            }
          }
          sort={sort}
          isLoading={isLoadingTrades}
          onSortChange={setSort}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onRowClick={handleRowClick}
        />
      ) : (
        <TradeAnalysis stats={tradeStats} isLoading={isLoadingStats} />
      )}

      {/* Trade Detail Modal */}
      <TradeDetailModal
        trade={selectedTrade}
        open={!!selectedTrade}
        onClose={handleCloseDetail}
      />
    </Box>
  )
}

export default Trades
