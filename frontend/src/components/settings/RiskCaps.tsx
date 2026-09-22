import { useState } from 'react'
import { Alert, Box, Snackbar, Stack, TextField, Tooltip, Typography } from '@mui/material'
import { Button } from '@/components/common'
import BookControls from '@/components/settings/BookControls'
import { getBookState, RISK_HARD_CAPS, saveRisk, type BookActionResult } from '@/mocks/bookStore'
import type { KillSwitchState, RiskCaps as RiskCapsModel } from '@/types'

interface RiskCapsProps {
  risk: RiskCapsModel
  killSwitch: KillSwitchState
}

const fields: {
  key: keyof RiskCapsModel
  label: string
  help: string
  step?: number
}[] = [
  { key: 'risk_per_trade_pct', label: 'Risk per trade (%)', help: `Hard cap ${RISK_HARD_CAPS.risk_per_trade_pct}%`, step: 0.01 },
  { key: 'max_open_stop_risk_pct', label: 'Max open stop-risk (%)', help: `Hard cap ${RISK_HARD_CAPS.max_open_stop_risk_pct}%`, step: 0.01 },
  { key: 'soft_throttle_pct', label: 'Soft throttle (%)', help: 'At −1%, new-trade risk is halved. Cannot be looser than −1%.', step: 0.1 },
  { key: 'stop_new_risk_pct', label: 'Stop new risk (%)', help: 'At −1.5%, no new risk. Cannot be looser than −1.5%.', step: 0.1 },
  { key: 'hard_daily_lock_pct', label: 'Flatten and lock (%)', help: 'At −2%, cancel entries, flatten, and lock. Cannot be looser than −2%.', step: 0.1 },
  { key: 'max_positions', label: 'Max positions', help: `Hard cap ${RISK_HARD_CAPS.max_positions}`, step: 1 },
  { key: 'single_name_notional_pct', label: 'Single-name notional (%)', help: `Hard cap ${RISK_HARD_CAPS.single_name_notional_pct}% for stocks`, step: 1 },
  { key: 'min_score', label: 'Minimum score', help: `Trades require at least ${RISK_HARD_CAPS.min_score}/100`, step: 1 },
  { key: 'min_target_r', label: 'Minimum target (R)', help: `At least ${RISK_HARD_CAPS.min_target_r}R`, step: 0.1 },
  { key: 'cost_multiple', label: 'Cost multiple', help: `Gross target must cover at least ${RISK_HARD_CAPS.cost_multiple}× expected round-trip cost`, step: 0.5 },
]

const RiskCaps = ({ risk, killSwitch }: RiskCapsProps) => {
  const [draft, setDraft] = useState(risk)
  const [notice, setNotice] = useState<BookActionResult | null>(null)

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Risk
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Values save only inside the hard caps. The ladder is −1% throttle, −1.5% stop new risk, −2% flatten and lock.
      </Typography>
      <Stack spacing={2} sx={{ maxWidth: 480, mb: 3 }}>
        {fields.map((field) => (
          <Tooltip key={field.key} title={field.help} placement="top-start">
            <TextField
              label={field.label}
              type="number"
              size="small"
              value={draft[field.key]}
              helperText={field.help}
              inputProps={{ step: field.step }}
              onChange={(event) =>
                setDraft({ ...draft, [field.key]: Number(event.target.value) })
              }
            />
          </Tooltip>
        ))}
        <Button
          variant="primary"
          onClick={() => {
            setNotice(saveRisk(draft))
            setDraft(getBookState().risk)
          }}
          sx={{ alignSelf: 'flex-start' }}
        >
          Save
        </Button>
      </Stack>
      <BookControls killSwitch={killSwitch} />
      <Snackbar
        open={notice !== null}
        autoHideDuration={4000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={notice?.ok === false ? 'error' : 'success'} variant="filled" onClose={() => setNotice(null)}>
          {notice?.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default RiskCaps
