import { useCallback, useState } from 'react'
import { Box, Typography, Alert, Snackbar } from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { BotForm } from '@/components/bots/form'
import { LoadingSpinner } from '@/components/common'
import { useBot, useUpdateBot } from '@/hooks/useBots'
import type { BotFormData } from '@/types'

/**
 * EditBot Page
 *
 * Loads an existing bot by ID and renders BotForm pre-filled with its data.
 * On save the bot is updated and the user is redirected back to the bots list
 * with a success snackbar.
 */
const EditBot = () => {
  const navigate = useNavigate()
  const { botId } = useParams<{ botId: string }>()
  const { data: bot, isLoading, error } = useBot(botId)
  const updateBot = useUpdateBot()
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  const handleSubmit = useCallback(
    async (data: BotFormData) => {
      if (!botId) return
      await updateBot.mutateAsync({ id: botId, data })
      setSnackbar({
        open: true,
        message: 'Bot updated successfully!',
        severity: 'success',
      })
      setTimeout(() => navigate('/bots'), 600)
    },
    [botId, updateBot, navigate]
  )

  const handleCancel = useCallback(() => {
    navigate('/bots')
  }, [navigate])

  if (isLoading) {
    return (
      <Box sx={{ py: 8 }}>
        <LoadingSpinner text="Loading bot..." />
      </Box>
    )
  }

  if (error || !bot) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error">
          {error ? 'Failed to load bot data.' : 'Bot not found.'}{' '}
          <Box
            component="span"
            sx={{ cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => navigate('/bots')}
          >
            Go back to bots list
          </Box>
        </Alert>
      </Box>
    )
  }

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
        Edit Bot — {bot.name}
      </Typography>

      <Box
        sx={{
          maxWidth: 900,
          mx: 'auto',
          p: { xs: 2, sm: 3 },
          backgroundColor: 'background.paper',
          borderRadius: 2,
          border: 1,
          borderColor: 'divider',
        }}
      >
        <BotForm
          initialData={bot}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={updateBot.isPending}
          submitLabel="Save Changes"
        />
      </Box>

      {/* Success / Error Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default EditBot
