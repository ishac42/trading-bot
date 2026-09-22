import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Box, Snackbar, Stack, TextField, Typography } from '@mui/material'
import { Button } from '@/components/common'
import UniversePreview from '@/components/settings/UniversePreview'
import { useBook } from '@/hooks/useBook'
import { useRealtimeDashboard } from '@/hooks/useRealtimeDashboard'
import {
  clampBotRisk,
  clampUniverseFilters,
  createBotProfile,
  defaultBotRisk,
  previewUniverse,
  UNIVERSE_LIMITS,
  updateBotProfile,
  type BookActionResult,
} from '@/mocks/bookStore'
import type { BotRiskParameters, UniverseFilters } from '@/types'

const BotProfileEditor = () => {
  const { botId } = useParams()
  return <BotProfileEditorForm key={botId ?? 'create'} botId={botId} />
}

const BotProfileEditorForm = ({ botId }: { botId?: string }) => {
  const navigate = useNavigate()
  const book = useBook()
  useRealtimeDashboard()
  const existing = book.bots.find((bot) => bot.id === botId)
  const missing = Boolean(botId) && !existing

  const [name, setName] = useState(existing?.name ?? '')
  const [universe, setUniverse] = useState<UniverseFilters>(existing?.universe ?? clampUniverseFilters(book.universe))
  const [risk, setRisk] = useState<BotRiskParameters>(existing?.risk ?? clampBotRisk(defaultBotRisk, book.risk))
  const [notice, setNotice] = useState<BookActionResult | null>(null)

  const filtersMatch =
    existing != null &&
    existing.universe.top_n === universe.top_n &&
    existing.universe.min_price === universe.min_price &&
    existing.universe.max_spread_bps === universe.max_spread_bps
  const snapshot = filtersMatch ? existing.snapshot : previewUniverse(universe)
  const ceiling = book.risk

  const save = () => {
    const input = { name, universe, risk }
    const result = existing ? updateBotProfile(existing.id, input) : createBotProfile(input)
    setNotice(result)
    if (result.ok) {
      window.setTimeout(() => navigate('/bots'), 400)
    }
  }

  if (missing) {
    return (
      <Box>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Bot not found
        </Typography>
        <Button variant="primary" onClick={() => navigate('/bots')}>
          Back to bots
        </Button>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 1, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
        {existing ? `Edit ${existing.name}` : 'New bot'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choose the universe this bot scans and the risk it may request. Values looser than the book caps are saved at the cap.
      </Typography>

      <Stack spacing={2}>
        <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} size="small" />
        <Typography variant="h6">Universe</Typography>
        <TextField
          label="Top names by dollar volume"
          type="number"
          size="small"
          value={universe.top_n}
          helperText={`${UNIVERSE_LIMITS.topNMin}–${UNIVERSE_LIMITS.topNMax}`}
          onChange={(event) => setUniverse({ ...universe, top_n: Number(event.target.value) })}
        />
        <TextField
          label="Price floor ($)"
          type="number"
          size="small"
          value={universe.min_price}
          helperText={`At least $${UNIVERSE_LIMITS.minPrice}`}
          onChange={(event) => setUniverse({ ...universe, min_price: Number(event.target.value) })}
        />
        <TextField
          label="Max RTH spread (bps)"
          type="number"
          size="small"
          value={universe.max_spread_bps}
          helperText={`${UNIVERSE_LIMITS.spreadMin}–${UNIVERSE_LIMITS.spreadMax} bps`}
          onChange={(event) => setUniverse({ ...universe, max_spread_bps: Number(event.target.value) })}
        />
        <UniversePreview snapshot={snapshot} />

        <Typography variant="h6">Risk parameters</Typography>
        <TextField
          label="Risk per trade (%)"
          type="number"
          size="small"
          value={risk.risk_per_trade_pct}
          helperText={`Book cap ${ceiling.risk_per_trade_pct}%`}
          onChange={(event) => setRisk({ ...risk, risk_per_trade_pct: Number(event.target.value) })}
        />
        <TextField
          label="Max open stop-risk (%)"
          type="number"
          size="small"
          value={risk.max_open_stop_risk_pct}
          helperText={`Book aggregate cap ${ceiling.max_open_stop_risk_pct}%`}
          onChange={(event) => setRisk({ ...risk, max_open_stop_risk_pct: Number(event.target.value) })}
        />
        <TextField
          label="Max positions"
          type="number"
          size="small"
          value={risk.max_positions}
          helperText={`Book cap ${ceiling.max_positions}`}
          onChange={(event) => setRisk({ ...risk, max_positions: Number(event.target.value) })}
        />
        <TextField
          label="Single-name notional (%)"
          type="number"
          size="small"
          value={risk.single_name_notional_pct}
          helperText={`Book cap ${ceiling.single_name_notional_pct}%`}
          onChange={(event) => setRisk({ ...risk, single_name_notional_pct: Number(event.target.value) })}
        />
        <TextField
          label="Minimum score"
          type="number"
          size="small"
          value={risk.min_score}
          helperText={`Book floor ${ceiling.min_score}`}
          onChange={(event) => setRisk({ ...risk, min_score: Number(event.target.value) })}
        />
        <TextField
          label="Minimum target (R)"
          type="number"
          size="small"
          value={risk.min_target_r}
          helperText={`Book floor ${ceiling.min_target_r}R and ${ceiling.cost_multiple}× cost`}
          onChange={(event) => setRisk({ ...risk, min_target_r: Number(event.target.value) })}
        />
        <TextField
          label="Cost multiple"
          type="number"
          size="small"
          value={risk.cost_multiple}
          helperText={`Book floor ${ceiling.cost_multiple}×`}
          onChange={(event) => setRisk({ ...risk, cost_multiple: Number(event.target.value) })}
        />
        <TextField
          label="Sleeve loss limit (%)"
          type="number"
          size="small"
          value={risk.sleeve_loss_limit_pct}
          helperText={`Stops this bot only. Cannot be looser than the book lock at ${ceiling.hard_daily_lock_pct}%.`}
          onChange={(event) => setRisk({ ...risk, sleeve_loss_limit_pct: Number(event.target.value) })}
        />
      </Stack>

      <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
        <Button variant="primary" onClick={save}>
          Save
        </Button>
        <Button variant="text" onClick={() => navigate('/bots')}>
          Cancel
        </Button>
      </Box>

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

export default BotProfileEditor
