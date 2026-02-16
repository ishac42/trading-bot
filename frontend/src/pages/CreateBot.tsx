import { useCallback, useState } from 'react'
import { Box, Typography, Alert, Snackbar } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { BotForm } from '@/components/bots/form'
import { useCreateBot } from '@/hooks/useBots'
import type { BotFormData } from '@/types'

/**
 * CreateBot Page
 *
 * Renders the full bot creation form using BotForm.
 * On successful submission the user is redirected to the bots list
 * with a success snackbar. Errors are shown inline.
 */
const CreateBot = () => {
  const navigate = useNavigate()
  const createBot = useCreateBot()
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  const handleSubmit = useCallback(
    async (data: BotFormData) => {
      await createBot.mutateAsync(data)
      setSnackbar({
        open: true,
        message: 'Bot created successfully!',
        severity: 'success',
      })
      // Brief delay so user sees the success message
      setTimeout(() => navigate('/bots'), 600)
    },
    [createBot, navigate]
  )

  const handleCancel = useCallback(() => {
    navigate('/bots')
  }, [navigate])

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
        Create New Bot
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
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={createBot.isPending}
          submitLabel="Create Bot"
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

export default CreateBot
