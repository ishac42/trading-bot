import React, { useCallback } from 'react'
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
} from '@mui/icons-material'
import { Card, StatusBadge, PnLDisplay, Button } from '@/components/common'
import type { Bot } from '@/types'
import { formatCurrency, formatIndicators } from '@/utils/formatters'

interface BotCardProps {
  bot: Bot
  onPause?: (botId: string) => void
  onResume?: (botId: string) => void
  onStop?: (botId: string) => void
  onClick?: (botId: string) => void
  /** Whether any action is currently loading */
  actionLoading?: string | null
}

/**
 * BotCard Component
 *
 * Displays a bot's information including name, status, symbols,
 * capital, P&L, indicators, trades today, and win rate.
 * Includes action buttons for Pause/Resume/Stop.
 */
export const BotCard: React.FC<BotCardProps> = ({
  bot,
  onPause,
  onResume,
  onStop,
  onClick,
  actionLoading,
}) => {
  const isActionLoading = actionLoading === bot.id

  const handlePause = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onPause?.(bot.id)
    },
    [bot.id, onPause]
  )

  const handleResume = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onResume?.(bot.id)
    },
    [bot.id, onResume]
  )

  const handleStop = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onStop?.(bot.id)
    },
    [bot.id, onStop]
  )

  const handleClick = useCallback(() => {
    onClick?.(bot.id)
  }, [bot.id, onClick])

  const actionButtons = (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {bot.status === 'running' && (
        <>
          <Tooltip title="Pause bot">
            <span>
              <Button
                variant="secondary"
                size="small"
                startIcon={<PauseIcon />}
                onClick={handlePause}
                loading={isActionLoading}
              >
                Pause
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Stop bot">
            <span>
              <Button
                variant="danger"
                size="small"
                startIcon={<StopIcon />}
                onClick={handleStop}
                loading={isActionLoading}
              >
                Stop
              </Button>
            </span>
          </Tooltip>
        </>
      )}
      {bot.status === 'paused' && (
        <>
          <Tooltip title="Resume bot">
            <span>
              <Button
                variant="primary"
                size="small"
                startIcon={<PlayIcon />}
                onClick={handleResume}
                loading={isActionLoading}
              >
                Resume
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Stop bot">
            <span>
              <Button
                variant="danger"
                size="small"
                startIcon={<StopIcon />}
                onClick={handleStop}
                loading={isActionLoading}
              >
                Stop
              </Button>
            </span>
          </Tooltip>
        </>
      )}
      {bot.status === 'stopped' && (
        <Tooltip title="Start bot">
          <span>
            <Button
              variant="primary"
              size="small"
              startIcon={<PlayIcon />}
              onClick={handleResume}
              loading={isActionLoading}
            >
              Start
            </Button>
          </span>
        </Tooltip>
      )}
    </Box>
  )

  return (
    <Card
      variant="outlined"
      onClick={onClick ? handleClick : undefined}
      sx={{
        '&:hover': {
          borderColor: 'primary.main',
          backgroundColor: 'action.hover',
        },
        transition: 'all 0.2s ease-in-out',
      }}
    >
      {/* Header: Bot name + Status + Actions */}
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
          <Typography
            variant="h3"
            component="h3"
            sx={{ fontWeight: 600, fontSize: { xs: '0.95rem', sm: '1.1rem' } }}
          >
            {bot.name}
          </Typography>
          <StatusBadge status={bot.status} variant="chip" size="small" />
        </Box>
        {actionButtons}
      </Box>

      <Divider sx={{ mb: 1.5 }} />

      {/* Details Row 1: Symbols + Capital + P&L */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: { xs: 1, sm: 2 },
          mb: 1.5,
          alignItems: 'center',
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {bot.symbols.map((symbol) => (
            <Chip
              key={symbol}
              label={symbol}
              size="small"
              variant="outlined"
              sx={{
                fontWeight: 500,
                fontSize: '0.75rem',
                height: 24,
              }}
            />
          ))}
        </Box>

        <Divider orientation="vertical" flexItem />

        <Typography variant="body2" color="text.secondary">
          Capital:{' '}
          <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {formatCurrency(bot.capital)}
          </Box>
        </Typography>

        <Divider orientation="vertical" flexItem />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Today:
          </Typography>
          <PnLDisplay
            amount={bot.today_pnl}
            showSign
            size="small"
            bold
          />
        </Box>

        <Divider orientation="vertical" flexItem />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Total P&L:
          </Typography>
          <PnLDisplay
            amount={bot.total_pnl}
            showSign
            size="small"
            bold
          />
        </Box>
      </Box>

      {/* Details Row 2: Indicators + Trades Today + Win Rate */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: { xs: 1, sm: 2 },
          alignItems: 'center',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Indicators:{' '}
          <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>
            {formatIndicators(bot.indicators)}
          </Box>
        </Typography>

        <Divider orientation="vertical" flexItem />

        <Typography variant="body2" color="text.secondary">
          Trades Today:{' '}
          <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {bot.trades_today}
          </Box>
        </Typography>

        <Divider orientation="vertical" flexItem />

        <Typography variant="body2" color="text.secondary">
          Win Rate:{' '}
          <Box
            component="span"
            sx={{
              fontWeight: 600,
              color: bot.win_rate >= 50 ? 'success.main' : 'error.main',
            }}
          >
            {bot.win_rate}%
          </Box>
        </Typography>
      </Box>
    </Card>
  )
}
