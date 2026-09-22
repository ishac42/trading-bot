import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Box, Snackbar, TextField, Typography } from '@mui/material'
import { Button, Card, EmptyState, PnLDisplay, StatusBadge } from '@/components/common'
import { useBook } from '@/hooks/useBook'
import type { BookActionResult } from '@/mocks/bookStore'
import { removeBotProfile, setBotProfileRunning } from '@/services/botProfiles'
import type { BotProfile } from '@/types'

const BotList = () => {
  const navigate = useNavigate()
  const { bots } = useBook()
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<BookActionResult | null>(null)
  const [pendingDelete, setPendingDelete] = useState<BotProfile | null>(null)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return bots
    return bots.filter((bot) => bot.name.toLowerCase().includes(needle))
  }, [bots, query])

  const run = async (result: Promise<BookActionResult>) => setNotice(await result)

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', fontSize: { xs: '1.5rem', sm: '2rem' } }}>
          Bots
        </Typography>
        <Button variant="primary" onClick={() => navigate('/bots/create')}>
          New bot
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Each bot is a universe and a risk sleeve on the same book. Starting one does not open a second account.
      </Typography>
      <TextField
        size="small"
        label="Search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        sx={{ mb: 2, maxWidth: 320 }}
      />

      {visible.length === 0 ? (
        <EmptyState
          title={bots.length === 0 ? 'No bots yet' : 'No matches'}
          message={bots.length === 0 ? 'Create a bot to choose a universe and its risk parameters.' : 'Try a different name.'}
          variant="no-data"
        />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {visible.map((bot) => (
            <Card key={bot.id}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="h6">{bot.name}</Typography>
                    <StatusBadge status={bot.status} />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Top {bot.universe.top_n} · price ≥ ${bot.universe.min_price} · spread ≤ {bot.universe.max_spread_bps} bps ·{' '}
                    {bot.snapshot.members.length} names
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {bot.risk.risk_per_trade_pct}% per trade · {bot.risk.max_positions} positions · sleeve{' '}
                    {bot.risk.sleeve_loss_limit_pct}%
                  </Typography>
                </Box>
                <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                  <PnLDisplay amount={bot.stats.marked_pnl} percentage={bot.stats.marked_pnl_pct} showSign bold />
                  <Typography variant="body2" color="text.secondary">
                    {bot.stats.trade_count} trades · {bot.stats.win_rate}% wins · {bot.stats.veto_count} vetoes
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                {bot.status === 'running' ? (
                  <Button variant="secondary" onClick={() => run(setBotProfileRunning(bot.id, false))}>
                    Stop
                  </Button>
                ) : (
                  <Button variant="primary" onClick={() => run(setBotProfileRunning(bot.id, true))}>
                    Start
                  </Button>
                )}
                <Button variant="text" onClick={() => navigate(`/bots/${bot.id}/edit`)}>
                  Edit
                </Button>
                <Button variant="danger" onClick={() => setPendingDelete(bot)}>
                  Delete
                </Button>
              </Box>
            </Card>
          ))}
        </Box>
      )}

      {pendingDelete && (
        <Box sx={{ mt: 2 }}>
          <Alert
            severity="warning"
            action={
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="text" onClick={() => setPendingDelete(null)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    run(removeBotProfile(pendingDelete.id, pendingDelete.name))
                    setPendingDelete(null)
                  }}
                >
                  Delete
                </Button>
              </Box>
            }
          >
            Delete {pendingDelete.name}? Open positions stay on the book.
          </Alert>
        </Box>
      )}

      <Snackbar
        open={notice !== null}
        autoHideDuration={4000}
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

export default BotList
