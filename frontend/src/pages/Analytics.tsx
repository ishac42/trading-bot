import React, { useState } from 'react'
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  Tabs,
  Tab,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  CompareArrows as CompareIcon,
  PieChart as PieChartIcon,
} from '@mui/icons-material'
import {
  PerformanceOverview,
  CumulativePnLChart,
  BotComparisonChart,
  BotComparisonTable,
  SymbolPerformance,
} from '@/components/analytics'
import { useAnalytics } from '@/hooks/useAnalytics'
import type { AnalyticsTimeRange } from '@/types'

const TIME_RANGE_OPTIONS: { value: AnalyticsTimeRange; label: string }[] = [
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'All' },
]

/**
 * Analytics Page
 *
 * Comprehensive analytics dashboard with:
 * - Performance Overview (key metrics)
 * - Cumulative P&L chart (with daily/cumulative toggle)
 * - Bot performance comparison (chart + table)
 * - Symbol performance breakdown (chart + table)
 * - Time range filter
 *
 * Data is fetched via the useAnalytics hook.
 */
const Analytics: React.FC = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>('ALL')
  const [activeTab, setActiveTab] = useState(0)

  const { data, isLoading, error } = useAnalytics(timeRange)

  const handleTimeRangeChange = (
    _: React.MouseEvent<HTMLElement>,
    newRange: AnalyticsTimeRange | null
  ) => {
    if (newRange) setTimeRange(newRange)
  }

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
          gap: 1.5,
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
          Analytics
        </Typography>

        {/* Time Range Selector */}
        <ToggleButtonGroup
          value={timeRange}
          exclusive
          onChange={handleTimeRangeChange}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              px: { xs: 1, sm: 1.5 },
              py: 0.5,
              fontSize: { xs: '0.7rem', sm: '0.8rem' },
              fontWeight: 600,
            },
          }}
        >
          {TIME_RANGE_OPTIONS.map((option) => (
            <ToggleButton key={option.value} value={option.value}>
              {option.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load analytics data. Please try again.
        </Alert>
      )}

      {/* Performance Overview */}
      <Box sx={{ mb: { xs: 2, md: 3 } }}>
        <PerformanceOverview overview={data?.overview} isLoading={isLoading} />
      </Box>

      {/* P&L Chart */}
      <Box sx={{ mb: { xs: 2, md: 3 } }}>
        <CumulativePnLChart data={data?.pnlTimeSeries} isLoading={isLoading} />
      </Box>

      {/* Tab Navigation for Bot / Symbol sections */}
      <Box sx={{ mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              minHeight: 42,
              fontWeight: 500,
            },
            '& .MuiTabs-indicator': { height: 2 },
          }}
        >
          <Tab
            icon={<CompareIcon fontSize="small" />}
            iconPosition="start"
            label={isMobile ? 'Bots' : 'Bot Comparison'}
            sx={{ fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}
          />
          <Tab
            icon={<PieChartIcon fontSize="small" />}
            iconPosition="start"
            label={isMobile ? 'Symbols' : 'Symbol Performance'}
            sx={{ fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}
          />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {activeTab === 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 } }}>
          <BotComparisonChart
            data={data?.botPerformance}
            isLoading={isLoading}
          />
          <BotComparisonTable
            data={data?.botPerformance}
            isLoading={isLoading}
          />
        </Box>
      ) : (
        <SymbolPerformance
          data={data?.symbolPerformance}
          isLoading={isLoading}
        />
      )}
    </Box>
  )
}

export default Analytics
