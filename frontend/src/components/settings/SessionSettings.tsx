import { useState } from 'react'
import { Alert, Box, FormControlLabel, Snackbar, Switch, Typography } from '@mui/material'
import { Button } from '@/components/common'
import { getBookState, saveSession, type BookActionResult } from '@/mocks/bookStore'
import type { SessionSettings as SessionSettingsModel } from '@/types'

interface SessionSettingsProps {
  session: SessionSettingsModel
}

const SessionSettings = ({ session }: SessionSettingsProps) => {
  const [draft, setDraft] = useState(session)
  const [notice, setNotice] = useState<BookActionResult | null>(null)

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Session
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        The live book takes new equity risk in regular hours. Extended hours is a separate flag and is not the live path.
      </Typography>
      <FormControlLabel
        control={
          <Switch
            checked={draft.rth_enabled}
            onChange={(event) => setDraft({ ...draft, rth_enabled: event.target.checked })}
          />
        }
        label="Regular hours"
      />
      <Box>
        <FormControlLabel
          control={
            <Switch
              checked={draft.extended_hours}
              onChange={(event) => setDraft({ ...draft, extended_hours: event.target.checked })}
            />
          }
          label="Extended hours"
        />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 6, mt: -0.5 }}>
          Off by default. Turning this on does not enable an extended-hours strategy.
        </Typography>
      </Box>
      <Button
        variant="primary"
        sx={{ mt: 2 }}
        onClick={() => {
          setNotice(saveSession(draft))
          setDraft(getBookState().session)
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
        <Alert severity="success" variant="filled" onClose={() => setNotice(null)}>
          {notice?.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default SessionSettings
