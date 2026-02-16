import { useState, useCallback } from 'react'
import { Box, Typography, Alert, Snackbar } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { SummaryCards, ActiveBotsList, RecentTradesTable } from '@/components/dashboard'
import { useBots, usePauseBot, useStopBot, useStartBot } from '@/hooks/useBots'
import { useRecentTrades } from '@/hooks/useRecentTrades'
import { useSummaryStats } from '@/hooks/useSummaryStats'
import { useRealtimeDashboard } from '@/hooks/useRealtimeDashboard'

/**
 * Dashboard Page
 *
 * Main overview page combining:
 * - Summary Cards (Total P&L, Active Bots, Open Positions)
 * - Active Bots List with action buttons
 * - Recent Trades Table
 *
 * All data is fetched via React Query hooks and updated
 * in real-time via WebSocket subscriptions.
 */
const Dashboard = () => {
  const navigate = useNavigate()

  // Data hooks
  const { data: bots, isLoading: botsLoading, error: botsError } = useBots()
  const { data: trades, isLoading: tradesLoading, error: tradesError } = useRecentTrades(10)
  const { data: stats, isLoading: statsLoading, error: statsError } = useSummaryStats()

  // Real-time updates
  useRealtimeDashboard()

  // Action mutations
  const pauseBot = usePauseBot()
  const stopBot = useStopBot()
  const startBot = useStartBot()

  // UI state
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  const showSnackbar = useCallback(
    (message: string, severity: 'success' | 'error' = 'success') => {
      setSnackbar({ open: true, message, severity })
    },
    []
  )

  const handleCloseSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }))
  }, [])

  // Bot action handlers
  const handlePauseBot = useCallback(
    async (botId: string) => {
      setActionLoading(botId)
      try {
        await pauseBot.mutateAsync(botId)
        showSnackbar('Bot paused successfully')
      } catch {
        showSnackbar('Failed to pause bot', 'error')
      } finally {
        setActionLoading(null)
      }
    },
    [pauseBot, showSnackbar]
  )

  const handleResumeBot = useCallback(
    async (botId: string) => {
      setActionLoading(botId)
      try {
        await startBot.mutateAsync(botId)
        showSnackbar('Bot resumed successfully')
      } catch {
        showSnackbar('Failed to resume bot', 'error')
      } finally {
        setActionLoading(null)
      }
    },
    [startBot, showSnackbar]
  )

  const handleStopBot = useCallback(
    async (botId: string) => {
      setActionLoading(botId)
      try {
        await stopBot.mutateAsync(botId)
        showSnackbar('Bot stopped successfully')
      } catch {
        showSnackbar('Failed to stop bot', 'error')
      } finally {
        setActionLoading(null)
      }
    },
    [stopBot, showSnackbar]
  )

  const handleBotClick = useCallback(
    (botId: string) => {
      navigate(`/bots/${botId}`)
    },
    [navigate]
  )

  // Show error if all data sources fail
  const hasError = botsError && tradesError && statsError

  return (
    <Box>
      {/* Page Title */}
      <Typography
        variant="h4"
        component="h1"
        sx={{
          mb: { xs: 2, sm: 3 },
          fontSize: { xs: '1.5rem', sm: '2rem', md: '2.25rem' },
          fontWeight: 'bold',
        }}
      >
        Dashboard
      </Typography>

      {/* Error Banner */}
      {hasError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load dashboard data. Please check your connection and try
          again.
        </Alert>
      )}

      {/* Summary Cards */}
      <Box sx={{ mb: { xs: 3, md: 4 } }}>
        <SummaryCards stats={stats} isLoading={statsLoading} />
      </Box>

      {/* Active Bots Section */}
      <Box sx={{ mb: { xs: 3, md: 4 } }}>
        <ActiveBotsList
          bots={bots}
          isLoading={botsLoading}
          onPauseBot={handlePauseBot}
          onResumeBot={handleResumeBot}
          onStopBot={handleStopBot}
          onBotClick={handleBotClick}
          actionLoading={actionLoading}
        />
      </Box>

      {/* Recent Trades Table */}
      <Box sx={{ mb: { xs: 3, md: 4 } }}>
        <RecentTradesTable trades={trades} isLoading={tradesLoading} />
      </Box>

      {/* Snackbar for action feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default Dashboard
