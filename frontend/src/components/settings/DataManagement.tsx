import { useState } from 'react'
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Paper,
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import type { DataStats } from '@/types'
import type { UseMutationResult } from '@tanstack/react-query'

interface DataManagementProps {
  dataStats: DataStats | undefined
  isLoadingStats: boolean
  exportTrades: UseMutationResult<void, Error, void>
  exportPositions: UseMutationResult<void, Error, void>
  clearTrades: UseMutationResult<any, Error, void>
  resetSettings: UseMutationResult<any, Error, void>
}

type ConfirmAction = 'clear-trades' | 'reset-settings' | null

const DataManagement = ({
  dataStats,
  isLoadingStats,
  exportTrades,
  exportPositions,
  clearTrades,
  resetSettings,
}: DataManagementProps) => {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)

  const handleConfirm = async () => {
    if (confirmAction === 'clear-trades') {
      await clearTrades.mutateAsync()
    } else if (confirmAction === 'reset-settings') {
      await resetSettings.mutateAsync()
    }
    setConfirmAction(null)
  }

  const confirmMessages: Record<string, { title: string; body: string }> = {
    'clear-trades': {
      title: 'Clear Trade History',
      body: 'This will permanently delete all trade records. This action cannot be undone. Active positions and bots will not be affected.',
    },
    'reset-settings': {
      title: 'Reset All Settings',
      body: 'This will reset all your settings (broker, notifications, display) to their default values. Theme preferences will not be affected.',
    },
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Data Management
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Export your data or manage storage. Dangerous actions require
        confirmation.
      </Typography>

      {/* Storage Stats */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Storage Overview
        </Typography>
        {isLoadingStats ? (
          <CircularProgress size={20} />
        ) : dataStats ? (
          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="h5">{dataStats.total_bots}</Typography>
              <Typography variant="caption" color="text.secondary">
                Bots
              </Typography>
            </Box>
            <Box>
              <Typography variant="h5">{dataStats.total_trades}</Typography>
              <Typography variant="caption" color="text.secondary">
                Trades
              </Typography>
            </Box>
            <Box>
              <Typography variant="h5">{dataStats.total_positions}</Typography>
              <Typography variant="caption" color="text.secondary">
                Positions
              </Typography>
            </Box>
            <Box>
              <Typography variant="h5">{dataStats.open_positions}</Typography>
              <Typography variant="caption" color="text.secondary">
                Open Positions
              </Typography>
            </Box>
          </Box>
        ) : null}
      </Paper>

      {/* Export Section */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Export Data
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
        <Button
          variant="outlined"
          startIcon={
            exportTrades.isPending ? (
              <CircularProgress size={16} />
            ) : (
              <DownloadIcon />
            )
          }
          onClick={() => exportTrades.mutate()}
          disabled={exportTrades.isPending}
        >
          Export Trades CSV
        </Button>
        <Button
          variant="outlined"
          startIcon={
            exportPositions.isPending ? (
              <CircularProgress size={16} />
            ) : (
              <DownloadIcon />
            )
          }
          onClick={() => exportPositions.mutate()}
          disabled={exportPositions.isPending}
        >
          Export Positions CSV
        </Button>
      </Box>

      {/* Dangerous Actions */}
      <Typography variant="subtitle2" color="error" sx={{ mb: 1 }}>
        Danger Zone
      </Typography>
      <Paper
        variant="outlined"
        sx={{ p: 2, borderColor: 'error.main' }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography variant="body2" fontWeight="medium">
                Clear Trade History
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Permanently delete all trade records
              </Typography>
            </Box>
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<DeleteForeverIcon />}
              onClick={() => setConfirmAction('clear-trades')}
            >
              Clear
            </Button>
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography variant="body2" fontWeight="medium">
                Reset All Settings
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Restore all settings to their default values
              </Typography>
            </Box>
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<RestartAltIcon />}
              onClick={() => setConfirmAction('reset-settings')}
            >
              Reset
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Feedback */}
      {clearTrades.isSuccess && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Trade history cleared successfully.
        </Alert>
      )}
      {resetSettings.isSuccess && (
        <Alert severity="success" sx={{ mt: 2 }}>
          All settings have been reset to defaults.
        </Alert>
      )}

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
      >
        <DialogTitle>
          {confirmAction && confirmMessages[confirmAction]?.title}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmAction && confirmMessages[confirmAction]?.body}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAction(null)}>Cancel</Button>
          <Button onClick={handleConfirm} color="error" variant="contained">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default DataManagement
