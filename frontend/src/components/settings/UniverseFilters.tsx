import { useState } from 'react'
import { Alert, Box, Snackbar, Stack, TextField, Typography } from '@mui/material'
import { Button } from '@/components/common'
import { getBookState, resetUniverseFilters, saveUniverseFilters, UNIVERSE_LIMITS, type BookActionResult } from '@/mocks/bookStore'
import type { UniverseFilters as UniverseFiltersModel } from '@/types'

interface UniverseFiltersProps {
  filters: UniverseFiltersModel
}

const UniverseFilters = ({ filters }: UniverseFiltersProps) => {
  const [draft, setDraft] = useState(filters)
  const [notice, setNotice] = useState<BookActionResult | null>(null)

  const handleSave = () => {
    setNotice(saveUniverseFilters(draft))
    setDraft(getBookState().universe)
  }

  const handleReset = () => {
    setNotice(resetUniverseFilters())
    setDraft(getBookState().universe)
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Universe
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Membership is a filter, then a point-in-time snapshot. Names are not typed in.
      </Typography>
      <Stack spacing={2} sx={{ maxWidth: 420 }}>
        <TextField
          label="Top names by dollar volume"
          type="number"
          value={draft.top_n}
          onChange={(event) => setDraft({ ...draft, top_n: Number(event.target.value) })}
          helperText={`Between ${UNIVERSE_LIMITS.topNMin} and ${UNIVERSE_LIMITS.topNMax}`}
          inputProps={{ min: UNIVERSE_LIMITS.topNMin, max: UNIVERSE_LIMITS.topNMax }}
          size="small"
        />
        <TextField
          label="Price floor ($)"
          type="number"
          value={draft.min_price}
          onChange={(event) => setDraft({ ...draft, min_price: Number(event.target.value) })}
          helperText={`At least $${UNIVERSE_LIMITS.minPrice}`}
          inputProps={{ min: UNIVERSE_LIMITS.minPrice, step: 0.5 }}
          size="small"
        />
        <TextField
          label="Max RTH spread (bps)"
          type="number"
          value={draft.max_spread_bps}
          onChange={(event) => setDraft({ ...draft, max_spread_bps: Number(event.target.value) })}
          helperText={`${UNIVERSE_LIMITS.spreadMin}–${UNIVERSE_LIMITS.spreadMax} bps`}
          inputProps={{ min: UNIVERSE_LIMITS.spreadMin, max: UNIVERSE_LIMITS.spreadMax }}
          size="small"
        />
        <Stack direction="row" spacing={1}>
          <Button variant="primary" onClick={handleSave}>
            Save
          </Button>
          <Button variant="secondary" onClick={handleReset}>
            Reset
          </Button>
        </Stack>
      </Stack>
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

export default UniverseFilters
