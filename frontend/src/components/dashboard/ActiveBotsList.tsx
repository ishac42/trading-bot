import React from 'react'
import { Box, Typography, Skeleton } from '@mui/material'
import { Add as AddIcon } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { Card, Button, EmptyState } from '@/components/common'
import { BotCard } from './BotCard'
import type { Bot } from '@/types'

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

  const handleCreateBot = () => {
    navigate('/bots')
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
        <Button
          variant="primary"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleCreateBot}
        >
          Create New Bot
        </Button>
      </Box>

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
