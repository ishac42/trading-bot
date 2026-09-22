import { useState } from 'react'
import { Alert, Box, FormControlLabel, Radio, RadioGroup, Snackbar, Typography } from '@mui/material'
import { Button } from '@/components/common'
import { getBookState, type BookActionResult } from '@/mocks/bookStore'
import { persistMode } from '@/services/bookControl'
import type { AccountMode } from '@/types'

interface AccountModeSettingsProps {
  mode: AccountMode
}

const options: { value: AccountMode; label: string; detail: string }[] = [
  { value: 'paper', label: 'Paper', detail: 'Orders go to the paper venue.' },
  { value: 'shadow', label: 'Shadow', detail: 'A shadow book records decisions and does not size live buying power.' },
  { value: 'min_size_live', label: 'Min-size live', detail: 'The smallest live size. Still one book.' },
]

const AccountModeSettings = ({ mode }: AccountModeSettingsProps) => {
  const [draft, setDraft] = useState<AccountMode>(mode)
  const [notice, setNotice] = useState<BookActionResult | null>(null)

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Account mode
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        One mode at a time. Two modes must not independently size the same buying power.
      </Typography>
      <RadioGroup
        aria-label="Account mode"
        value={draft}
        onChange={(event) => setDraft(event.target.value as AccountMode)}
      >
        {options.map((option) => (
          <FormControlLabel
            key={option.value}
            value={option.value}
            control={<Radio />}
            label={
              <Box>
                <Typography variant="body1">{option.label}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {option.detail}
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', mb: 1 }}
          />
        ))}
      </RadioGroup>
      <Button
        variant="primary"
        sx={{ mt: 1 }}
        onClick={async () => {
          const result = await persistMode(draft)
          setNotice(result)
          if (result.ok) setDraft(getBookState().mode)
        }}
      >
        Save
      </Button>
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

export default AccountModeSettings
