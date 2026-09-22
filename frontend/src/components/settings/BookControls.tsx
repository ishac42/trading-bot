import { useState } from 'react'
import { Alert, Box, Snackbar, Stack, Typography } from '@mui/material'
import { Button, Modal } from '@/components/common'
import { engageKillSwitch, type BookActionResult } from '@/mocks/bookStore'
import { persistBookCommand } from '@/services/bookControl'
import type { KillSwitchState } from '@/types'

interface BookControlsProps {
  killSwitch: KillSwitchState
  compact?: boolean
}

type PendingAction = 'flatten' | 'lock' | 'kill' | null

const copy: Record<Exclude<PendingAction, null>, { title: string; body: string }> = {
  flatten: {
    title: 'Flatten the book',
    body: 'This cancels new risk and closes open positions. It cannot be undone from this screen.',
  },
  lock: {
    title: 'Lock the book',
    body: 'New entries stay refused until you unlock. Unlock is blocked while the daily loss is still at the lock.',
  },
  kill: {
    title: 'Engage the kill switch',
    body: 'New entries halt immediately. Exits that reduce risk stay allowed.',
  },
}

const BookControls = ({ killSwitch, compact = false }: BookControlsProps) => {
  const [pending, setPending] = useState<PendingAction>(null)
  const [notice, setNotice] = useState<BookActionResult | null>(null)

  const run = async (action: PendingAction) => {
    if (!action) return
    const result =
      action === 'kill'
        ? engageKillSwitch()
        : await persistBookCommand(action === 'flatten' ? 'flatten' : 'lock')
    setNotice(result)
    setPending(null)
  }

  const handleUnlock = async () => {
    setNotice(await persistBookCommand('unlock'))
  }

  return (
    <Box>
      {!compact && (
        <>
          <Typography variant="h6" gutterBottom>
            Book controls
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Flatten, lock, and the kill switch apply to the single book. Strategy code cannot bypass them.
          </Typography>
        </>
      )}
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Button variant="danger" onClick={() => setPending('kill')} disabled={killSwitch.halted}>
          {killSwitch.halted ? 'Kill switch on' : 'Kill switch'}
        </Button>
        <Button variant="danger" onClick={() => setPending('flatten')}>
          Flatten
        </Button>
        <Button variant="secondary" onClick={() => setPending('lock')} disabled={killSwitch.locked}>
          Lock
        </Button>
        <Button variant="secondary" onClick={handleUnlock} disabled={!killSwitch.locked}>
          Unlock
        </Button>
      </Stack>

      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending ? copy[pending].title : ''}
        maxWidth="xs"
        actions={
          <>
            <Button variant="text" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => run(pending)}>
              Confirm
            </Button>
          </>
        }
      >
        <Typography variant="body2">{pending ? copy[pending].body : ''}</Typography>
      </Modal>

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

export default BookControls
