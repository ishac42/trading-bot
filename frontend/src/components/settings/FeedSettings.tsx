import { useState } from 'react'
import { Alert, Box, Chip, FormControlLabel, Snackbar, Switch, Typography } from '@mui/material'
import { Button } from '@/components/common'
import { getBookState, refreshFeeTier, saveFeed, type BookActionResult } from '@/mocks/bookStore'
import type { FeeTier, FeedSettings as FeedSettingsModel } from '@/types'

interface FeedSettingsProps {
  feed: FeedSettingsModel
  feeTier: FeeTier
}

const FeedSettings = ({ feed, feeTier }: FeedSettingsProps) => {
  const [diagnostic, setDiagnostic] = useState(feed.iex_diagnostic)
  const [notice, setNotice] = useState<BookActionResult | null>(null)

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Feed
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Research and the live book require SIP. IEX is a diagnostic feed and cannot be selected as the production source.
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="subtitle2">Production feed</Typography>
        <Chip label="SIP" color="success" size="small" />
      </Box>
      <FormControlLabel
        control={
          <Switch checked={diagnostic} onChange={(event) => setDiagnostic(event.target.checked)} />
        }
        label="Show IEX as a diagnostic comparison"
      />
      <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 6, mb: 2 }}>
        This does not replace SIP for VWAP, volume, or spread.
      </Typography>
      <Button
        variant="primary"
        onClick={() => {
          setNotice(saveFeed({ primary: 'sip', iex_diagnostic: diagnostic }))
          setDiagnostic(getBookState().feed.iex_diagnostic)
        }}
      >
        Save
      </Button>

      <Box sx={{ mt: 4 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Fee tier
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {feeTier.refreshed_at
            ? `Version ${feeTier.version}. Refreshed ${new Date(feeTier.refreshed_at).toLocaleString()}.`
            : 'Fee tier has not been refreshed.'}
        </Typography>
        <Button
          variant="secondary"
          onClick={() => setNotice(refreshFeeTier())}
        >
          Refresh fee tier
        </Button>
      </Box>

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

export default FeedSettings
