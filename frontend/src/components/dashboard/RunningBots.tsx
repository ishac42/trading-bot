import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Box, Snackbar, Typography } from '@mui/material'
import { Button, Card, EmptyState, PnLDisplay, StatusBadge } from '@/components/common'
import type { BookActionResult } from '@/mocks/bookStore'
import { setBotProfileRunning } from '@/services/botProfiles'
import type { BotProfile } from '@/types'

interface RunningBotsProps {
  bots: BotProfile[]
}

const RunningBots = ({ bots }: RunningBotsProps) => {
  const navigate = useNavigate()
  const [notice, setNotice] = useState<BookActionResult | null>(null)
  const running = bots.filter((bot) => bot.status === 'running')

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h3" component="h2" sx={{ fontWeight: 600 }}>
          Bots
        </Typography>
        <Button variant="text" onClick={() => navigate('/bots')}>
          View all
        </Button>
      </Box>
      {running.length === 0 ? (
        <EmptyState
          title="No bots running"
          message="Start a bot to scan its universe. Risk still comes out of this book."
          variant="no-data"
          sx={{ minHeight: 160 }}
        />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {running.map((bot) => (
            <Card key={bot.id}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography fontWeight={600}>{bot.name}</Typography>
                    <StatusBadge status="running" />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {bot.snapshot?.members.length ?? 0} names · {bot.risk?.risk_per_trade_pct ?? 0}% per trade · sleeve{' '}
                    {bot.risk?.sleeve_loss_limit_pct ?? 0}%
                  </Typography>
                </Box>
                <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                  <PnLDisplay amount={bot.stats.marked_pnl} percentage={bot.stats.marked_pnl_pct} showSign />
                  <Typography variant="caption" color="text.secondary" display="block">
                    {bot.stats.trade_count} trades
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                <Button
                  variant="secondary"
                  onClick={async () => setNotice(await setBotProfileRunning(bot.id, false))}
                >
                  Stop
                </Button>
                <Button variant="text" onClick={() => navigate(`/bots/${bot.id}/edit`)}>
                  Edit
                </Button>
              </Box>
            </Card>
          ))}
        </Box>
      )}
      {bots.some((bot) => bot.status === 'stopped') && (
        <Button variant="text" sx={{ mt: 1 }} onClick={() => navigate('/bots')}>
          {bots.filter((bot) => bot.status === 'stopped').length} stopped
        </Button>
      )}
      <Snackbar
        open={notice !== null}
        autoHideDuration={3000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={notice?.ok ? 'success' : 'error'} variant="filled" onClose={() => setNotice(null)}>
          {notice?.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default RunningBots
