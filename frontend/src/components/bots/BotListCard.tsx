import React, { useCallback, useMemo } from 'react'
import {
  Box,
  Typography,
  Chip,
  Divider,
  Tooltip,
} from '@mui/material'
import {
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'
import { Card, StatusBadge, PnLDisplay, Button } from '@/components/common'
import type { Bot } from '@/types'
import {
  formatCurrency,
  formatIndicators,
  formatTradingWindow,
  formatRelativeTime,
} from '@/utils/formatters'

interface BotListCardProps {
  bot: Bot
  onEdit?: (botId: string) => void
  onDelete?: (botId: string) => void
  onPause?: (botId: string) => void
  onResume?: (botId: string) => void
  onStop?: (botId: string) => void
  onStart?: (botId: string) => void
  onClick?: (botId: string) => void
  actionLoading?: string | null
}

/**
 * Deterministic mock metrics based on bot ID so they don't change on re-render.
 */
function getMockMetrics(bot: Bot) {
  // Simple hash from bot id to get stable numbers
  let hash = 0
  for (let i = 0; i < bot.id.length; i++) {
    hash = (hash * 31 + bot.id.charCodeAt(i)) | 0
  }
  const seed = Math.abs(hash)

  const tradesToday = (seed % 15) + 1
  const winRate = 50 + (seed % 35)

  let pnl: number
  let pnlPct: number

  if (bot.status === 'running') {
    pnl = ((seed % 500) + 50) * (seed % 3 === 0 ? -1 : 1)
    pnlPct = parseFloat(((pnl / bot.capital) * 100).toFixed(2))
  } else if (bot.status === 'paused') {
    pnl = ((seed % 200) + 10) * (seed % 2 === 0 ? -1 : 1)
    pnlPct = parseFloat(((pnl / bot.capital) * 100).toFixed(2))
  } else {
    pnl = (seed % 2000) - 300
    pnlPct = parseFloat(((pnl / bot.capital) * 100).toFixed(2))
  }

  return { pnl, pnlPct, tradesToday, winRate }
}

/**
 * BotListCard – Enhanced bot card for the Bots List page.
 * Shows more detail than the dashboard BotCard and includes Edit / Delete buttons.
 */
export const BotListCard: React.FC<BotListCardProps> = ({
  bot,
  onEdit,
  onDelete,
  onPause,
  onResume,
  onStop,
  onStart,
  onClick,
  actionLoading,
}) => {
  const isActionLoading = actionLoading === bot.id

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  const handleEdit = useCallback(
    (e: React.MouseEvent) => { stop(e); onEdit?.(bot.id) },
    [bot.id, onEdit]
  )
  const handleDelete = useCallback(
    (e: React.MouseEvent) => { stop(e); onDelete?.(bot.id) },
    [bot.id, onDelete]
  )
  const handlePause = useCallback(
    (e: React.MouseEvent) => { stop(e); onPause?.(bot.id) },
    [bot.id, onPause]
  )
  const handleResume = useCallback(
    (e: React.MouseEvent) => { stop(e); onResume?.(bot.id) },
    [bot.id, onResume]
  )
  const handleStop = useCallback(
    (e: React.MouseEvent) => { stop(e); onStop?.(bot.id) },
    [bot.id, onStop]
  )
  const handleStart = useCallback(
    (e: React.MouseEvent) => { stop(e); onStart?.(bot.id) },
    [bot.id, onStart]
  )
  const handleClick = useCallback(() => onClick?.(bot.id), [bot.id, onClick])

  // Stable mock metrics derived from bot data
  const { pnl, pnlPct, tradesToday, winRate } = useMemo(
    () => getMockMetrics(bot),
    [bot]
  )

  // --- Action buttons depend on status ---
  const statusActions = (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      <Tooltip title="Edit bot">
        <span>
          <Button variant="secondary" size="small" startIcon={<EditIcon />} onClick={handleEdit}>
            Edit
          </Button>
        </span>
      </Tooltip>

      {bot.status === 'running' && (
        <>
          <Button variant="secondary" size="small" startIcon={<PauseIcon />} onClick={handlePause} loading={isActionLoading}>Pause</Button>
          <Button variant="danger" size="small" startIcon={<StopIcon />} onClick={handleStop} loading={isActionLoading}>Stop</Button>
        </>
      )}
      {bot.status === 'paused' && (
        <>
          <Button variant="primary" size="small" startIcon={<PlayIcon />} onClick={handleResume} loading={isActionLoading}>Resume</Button>
          <Button variant="danger" size="small" startIcon={<StopIcon />} onClick={handleStop} loading={isActionLoading}>Stop</Button>
        </>
      )}
      {bot.status === 'stopped' && (
        <>
          <Button variant="primary" size="small" startIcon={<PlayIcon />} onClick={handleStart} loading={isActionLoading}>Start</Button>
          <Tooltip title="Delete bot">
            <span>
              <Button variant="danger" size="small" startIcon={<DeleteIcon />} onClick={handleDelete} loading={isActionLoading}>Delete</Button>
            </span>
          </Tooltip>
        </>
      )}
    </Box>
  )

  return (
    <Card
      variant="outlined"
      onClick={onClick ? handleClick : undefined}
      sx={{
        '&:hover': { borderColor: 'primary.main', backgroundColor: 'action.hover' },
        transition: 'all 0.2s',
      }}
    >
      {/* Row 1 — Name + Status + Actions */}
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1,
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h3" component="h3" sx={{ fontWeight: 600, fontSize: { xs: '0.95rem', sm: '1.1rem' } }}>
            {bot.name}
          </Typography>
          <StatusBadge status={bot.status} variant="chip" size="small" />
        </Box>
        {statusActions}
      </Box>

      <Divider sx={{ mb: 1.5 }} />

      {/* Row 2 — Symbols */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5, alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
          Symbols:
        </Typography>
        {bot.symbols.map((s) => (
          <Chip key={s} label={s} size="small" variant="outlined" sx={{ fontWeight: 500, fontSize: '0.75rem', height: 24 }} />
        ))}
      </Box>

      {/* Row 3 — Capital | Indicators | Trading Window */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, sm: 2 }, mb: 1.5, alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Capital: <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>{formatCurrency(bot.capital)}</Box>
        </Typography>
        <Divider orientation="vertical" flexItem />
        <Typography variant="body2" color="text.secondary">
          Indicators: <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>{formatIndicators(bot.indicators)}</Box>
        </Typography>
        <Divider orientation="vertical" flexItem />
        <Typography variant="body2" color="text.secondary">
          Window: <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>{formatTradingWindow(bot.start_hour, bot.start_minute, bot.end_hour, bot.end_minute)}</Box>
        </Typography>
      </Box>

      {/* Row 4 — P&L | Trades | Win Rate | Last Trade */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, sm: 2 }, alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="body2" color="text.secondary">P&L:</Typography>
          <PnLDisplay amount={pnl} percentage={pnlPct} showSign size="small" bold />
        </Box>
        <Divider orientation="vertical" flexItem />
        <Typography variant="body2" color="text.secondary">
          Trades: <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>{tradesToday}</Box>
        </Typography>
        <Divider orientation="vertical" flexItem />
        <Typography variant="body2" color="text.secondary">
          Win Rate:{' '}
          <Box component="span" sx={{ fontWeight: 600, color: winRate >= 50 ? 'success.main' : 'error.main' }}>
            {winRate}%
          </Box>
        </Typography>
        <Divider orientation="vertical" flexItem />
        <Typography variant="body2" color="text.secondary">
          Last Trade:{' '}
          <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>
            {bot.last_run_at ? formatRelativeTime(bot.last_run_at) : 'Never'}
          </Box>
        </Typography>
      </Box>
    </Card>
  )
}
