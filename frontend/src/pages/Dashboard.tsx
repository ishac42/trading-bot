import { Alert, Box, Button, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import LinkIcon from '@mui/icons-material/Link'
import { AccountSummary, RecentTradesTable } from '@/components/dashboard'
import BookSummary from '@/components/dashboard/BookSummary'
import BookControls from '@/components/settings/BookControls'
import { useBook } from '@/hooks/useBook'
import { useRealtimeDashboard } from '@/hooks/useRealtimeDashboard'
import { useSettings } from '@/hooks/useSettings'
import { useAccount } from '@/hooks/useAccount'
import { BOOK_USE_MOCK, setBookScenario } from '@/mocks/bookStore'
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
        <RecentTradesTable trades={book.trades} isLoading={false} />
      </Box>
    </Box>
  )
}

export default Dashboard
