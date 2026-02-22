import React, { useState } from 'react'
import {
  Box,
  Typography,
  Skeleton,
  Button as MuiButton,
  CircularProgress,
  Alert,
  Collapse,
} from '@mui/material'
import { Add as AddIcon, Sync as SyncIcon } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { Card, Button, EmptyState } from '@/components/common'
import { BotCard } from './BotCard'
import { api } from '@/services/api'
import type { Bot } from '@/types'

interface ReconcileResult {
  synced_count: number
  discrepancies: Array<{
    type: string
    detail: string
    trade_id?: string
    order_id?: string
    symbol?: string
  }>
  last_checked: string
  error?: string
}

interface ActiveBotsListProps {
  bots?: Bot[]
  isLoading: boolean
  onPauseBot?: (botId: string) => void
  onResumeBot?: (botId: string) => void
  onStopBot?: (botId: string) => void
  onBotClick?: (botId: string) => void
  actionLoading?: string | null
}

/**
 * ActiveBotsList Component
 *
 * Renders a list of active bot cards for the Dashboard.
 * Shows loading skeletons, empty state, or the bot list.
 */
export const ActiveBotsList: React.FC<ActiveBotsListProps> = ({
  bots,
  isLoading,
  onPauseBot,
  onResumeBot,
  onStopBot,
  onBotClick,
  actionLoading,
}) => {
  const navigate = useNavigate()
  const [reconciling, setReconciling] = useState(false)
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null)

  const handleCreateBot = () => {
    navigate('/bots')
  }

  const handleReconcile = async () => {
    setReconciling(true)
    try {
      const response = await api.reconcile()
      setReconcileResult(response.data)
    } catch {
      setReconcileResult({
        synced_count: 0,
        discrepancies: [{ type: 'error', detail: 'Failed to run reconciliation' }],
        last_checked: new Date().toISOString(),
      })
    } finally {
      setReconciling(false)
    }
  }

  if (isLoading) {
    return (
      <Card title="Active Bots">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[1, 2].map((i) => (
            <Box key={i}>
              <Skeleton variant="rounded" height={120} />
            </Box>
          ))}
        </Box>
      </Card>
    )
  }

  // Filter to active bots (running + paused)
  const activeBots = bots?.filter(
    (bot) => bot.status === 'running' || bot.status === 'paused'
  )

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Typography variant="h3" component="h2" sx={{ fontWeight: 600 }}>
          Active Bots
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MuiButton
            size="small"
            variant="outlined"
            startIcon={reconciling ? <CircularProgress size={14} /> : <SyncIcon />}
            onClick={handleReconcile}
            disabled={reconciling}
            sx={{ textTransform: 'none' }}
          >
            Check Sync
          </MuiButton>
          <Button
            variant="primary"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleCreateBot}
          >
            Create New Bot
          </Button>
        </Box>
      </Box>

      {reconcileResult && !reconciling && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            {reconcileResult.synced_count} synced
            {reconcileResult.discrepancies.length > 0
              ? `, ${reconcileResult.discrepancies.length} issue${reconcileResult.discrepancies.length > 1 ? 's' : ''}`
              : ' — all good'}
          </Typography>
        </Box>
      )}

      <Collapse in={!!reconcileResult && reconcileResult.discrepancies.length > 0}>
        <Box sx={{ mb: 2 }}>
          {reconcileResult?.discrepancies.map((d, i) => (
            <Alert
              key={i}
              severity={d.type === 'error' || d.type === 'fetch_error' ? 'error' : 'warning'}
              sx={{ mb: 0.5, py: 0, '& .MuiAlert-message': { fontSize: '0.8rem' } }}
            >
              <strong>{d.type}</strong>
              {d.symbol && ` (${d.symbol})`}: {d.detail}
            </Alert>
          ))}
        </Box>
      </Collapse>

      {!activeBots || activeBots.length === 0 ? (
        <EmptyState
          title="No active bots"
          message="Create and start a bot to begin trading"
          action={{ label: 'Create Bot', onClick: handleCreateBot }}
          variant="no-data"
          sx={{ minHeight: 200 }}
        />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {activeBots.map((bot) => (
            <BotCard
              key={bot.id}
              bot={bot}
              onPause={onPauseBot}
              onResume={onResumeBot}
              onStop={onStopBot}
              onClick={onBotClick}
              actionLoading={actionLoading}
            />
          ))}
        </Box>
      )}
    </Box>
  )
}
