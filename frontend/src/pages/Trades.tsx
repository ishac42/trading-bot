import React, { useCallback, useMemo, useState } from 'react'
import { Box, Typography, Tabs, Tab, Tooltip, IconButton, Alert, Collapse } from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import AnalyticsIcon from '@mui/icons-material/Analytics'
import TableChartIcon from '@mui/icons-material/TableChart'
import { useSearchParams } from 'react-router-dom'
import { TradeFilters, TradeTable, TradeDetailModal, TradeAnalysis } from '@/components/trades'
import { useBook } from '@/hooks/useBook'
import { useRealtimeDashboard } from '@/hooks/useRealtimeDashboard'
import { exportTradesToCsv } from '@/utils/csvExport'
import { filterBookTrades, paginateTrades, sortBookTrades, summarizeBookTrades } from '@/utils/bookTrades'
import type { Trade, TradeFilters as TradeFiltersType, TradeSort, DateRangePreset, TradeTypeFilter } from '@/types'

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

const Trades: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { trades, bots } = useBook()
  useRealtimeDashboard()
  const filters = useMemo(() => parseFiltersFromParams(searchParams), [searchParams])
  const [sort, setSort] = useState<TradeSort>({ field: 'timestamp', direction: 'desc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [activeTab, setActiveTab] = useState(0)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [showExportSuccess, setShowExportSuccess] = useState(false)

  const setFilters = useCallback(
    (newFilters: TradeFiltersType) => {
      setSearchParams(filtersToParams(newFilters), { replace: true })
      setPage(1)
    },
    [setSearchParams]
  )

  const filtered = useMemo(
    () => sortBookTrades(filterBookTrades(trades, filters), sort),
    [trades, filters, sort]
  )
  const pageView = useMemo(
    () => paginateTrades(filtered, page, pageSize),
    [filtered, page, pageSize]
  )
  const stats = useMemo(() => summarizeBookTrades(filtered), [filtered])
  const availableBots = useMemo(() => bots.map((bot) => ({ id: bot.id, name: bot.name })), [bots])
  const availableSymbols = useMemo(
    () => [...new Set(trades.map((trade) => trade.symbol))].sort(),
    [trades]
  )

  const handleExportCsv = useCallback(() => {
    const getBotName = (botId: string) => {
      if (!botId) return 'Book'
      return bots.find((bot) => bot.id === botId)?.name || 'Unknown bot'
    }
    exportTradesToCsv(filtered, getBotName)
    setShowExportSuccess(true)
    setTimeout(() => setShowExportSuccess(false), 3000)
  }, [filtered, bots])

  return (
    <Box>
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
          <IconButton onClick={handleExportCsv} color="primary" aria-label="Export filtered trades as CSV">
            <DownloadIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Collapse in={showExportSuccess}>
        <Alert severity="success" onClose={() => setShowExportSuccess(false)} sx={{ mb: 2 }}>
          Trades exported successfully!
        </Alert>
      </Collapse>

      <Box sx={{ mb: 2 }}>
        <TradeFilters
          filters={filters}
          onFiltersChange={setFilters}
          bots={availableBots}
          symbols={availableSymbols}
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
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

      {activeTab === 0 ? (
        <TradeTable
          trades={pageView.trades}
          pagination={pageView.pagination}
          sort={sort}
          isLoading={false}
          onSortChange={setSort}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onRowClick={setSelectedTrade}
        />
      ) : (
        <TradeAnalysis stats={stats} isLoading={false} />
      )}

      <TradeDetailModal trade={selectedTrade} open={!!selectedTrade} onClose={() => setSelectedTrade(null)} />
    </Box>
  )
}

export default Trades
