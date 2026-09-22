import { Alert, Box, Button, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import LinkIcon from '@mui/icons-material/Link'
import { AccountSummary, RecentTradesTable } from '@/components/dashboard'
import BookSummary from '@/components/dashboard/BookSummary'
import RunningBots from '@/components/dashboard/RunningBots'
import BookControls from '@/components/settings/BookControls'
import UniversePreview from '@/components/settings/UniversePreview'
import { useBook } from '@/hooks/useBook'
import { useRealtimeDashboard } from '@/hooks/useRealtimeDashboard'
import { useSettings } from '@/hooks/useSettings'
import { useAccount } from '@/hooks/useAccount'
import { BOOK_USE_MOCK, setBookScenario } from '@/mocks/bookStore'
import { publishBookEvent } from '@/services/bookEvents'
import type { BookScenario } from '@/types'

const Dashboard = () => {
  const navigate = useNavigate()
  const book = useBook()
  const { settings, isLoading: settingsLoading } = useSettings()
  const { data: account, isLoading: accountLoading } = useAccount()

  useRealtimeDashboard()

  return (
    <Box>
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

      {!settingsLoading && !accountLoading && !settings?.broker?.is_connected && !account?.account_number && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<LinkIcon />}
              onClick={() => navigate('/settings?section=broker')}
            >
              Link Account
            </Button>
          }
        >
          No Alpaca account connected. Link your brokerage account to start trading.
        </Alert>
      )}

      {BOOK_USE_MOCK && (
        <FormControl size="small" sx={{ mb: 2, minWidth: 180 }}>
          <InputLabel id="book-scenario-label">Preview state</InputLabel>
          <Select
            labelId="book-scenario-label"
            label="Preview state"
            value={book.scenario}
            onChange={(event) => setBookScenario(event.target.value as BookScenario)}
          >
            <MenuItem value="normal">Normal book</MenuItem>
            <MenuItem value="empty">Empty book</MenuItem>
            <MenuItem value="stale">Stale feed</MenuItem>
            <MenuItem value="locked">Daily lock</MenuItem>
          </Select>
        </FormControl>
      )}

      {BOOK_USE_MOCK && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() =>
              publishBookEvent('risk_event', {
                throttle_stage: 'locked',
                marked_daily_pnl: -105,
                marked_daily_pnl_pct: -2.1,
                locked: true,
                halted: true,
              })
            }
          >
            Emit risk lock
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() =>
              publishBookEvent('universe_updated', {
                as_of: '2026-09-22T15:05:00.000Z',
                members: [
                  { symbol: 'NVDA', price: 121.4, dollar_volume: 21_000_000_000, spread_bps: 1.8 },
                  { symbol: 'AAPL', price: 229.1, dollar_volume: 9_100_000_000, spread_bps: 1.1 },
                ],
              })
            }
          >
            Emit universe update
          </Button>
        </Stack>
      )}

      <Box sx={{ mb: { xs: 3, md: 4 } }}>
        <AccountSummary />
      </Box>

      <Box sx={{ mb: { xs: 3, md: 4 } }}>
        <BookSummary summary={book.summary} />
      </Box>

      <Box sx={{ mb: { xs: 3, md: 4 } }}>
        <BookControls killSwitch={book.summary.kill_switch} compact />
      </Box>

      <Box sx={{ mb: { xs: 3, md: 4 } }}>
        <RunningBots bots={book.bots} />
      </Box>

      <Box sx={{ mb: { xs: 3, md: 4 } }}>
        <UniversePreview snapshot={book.snapshot} />
      </Box>

      <Box sx={{ mb: { xs: 3, md: 4 } }}>
        <RecentTradesTable trades={book.trades} isLoading={false} />
      </Box>
    </Box>
  )
}

export default Dashboard
