import { useState, useCallback, useMemo } from 'react'
import {
  Box,
  Typography,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Alert,
  Snackbar,
  Skeleton,
} from '@mui/material'
import {
  Search as SearchIcon,
  Add as AddIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { Button, Modal, EmptyState } from '@/components/common'
import { BotListCard } from '@/components/bots'
import {
  useBots,
  useDeleteBot,
  usePauseBot,
  useStopBot,
  useStartBot,
} from '@/hooks/useBots'
import type { Bot } from '@/types'

type StatusFilter = 'all' | 'running' | 'paused' | 'stopped'

/**
 * Bots List Page
 *
 * Displays all bots with status filter tabs, search input, and action buttons.
 * Allows creating, editing, starting, stopping, pausing, and deleting bots.
 */
const Bots = () => {
  const navigate = useNavigate()

  // Data
  const { data: bots, isLoading, error } = useBots()

  // Mutations
  const deleteBot = useDeleteBot()
  const pauseBot = usePauseBot()
  const stopBot = useStopBot()
  const startBot = useStartBot()

  // UI state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Bot | null>(null)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  const showSnackbar = useCallback(
    (message: string, severity: 'success' | 'error' = 'success') => {
      setSnackbar({ open: true, message, severity })
    },
    []
  )

  // ---- Filtering ----

  const filteredBots = useMemo(() => {
    if (!bots) return []
    let result = [...bots]

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((b) => b.status === statusFilter)
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.symbols.some((s) => s.toLowerCase().includes(q))
      )
    }

    return result
  }, [bots, statusFilter, search])

  // ---- Status tab counts ----

  const counts = useMemo(() => {
    if (!bots) return { all: 0, running: 0, paused: 0, stopped: 0 }
    return {
      all: bots.length,
      running: bots.filter((b) => b.status === 'running').length,
      paused: bots.filter((b) => b.status === 'paused').length,
      stopped: bots.filter((b) => b.status === 'stopped').length,
    }
  }, [bots])

  // ---- Handlers ----

  const handleCreateBot = () => navigate('/bots/create')
  const handleEditBot = useCallback((id: string) => navigate(`/bots/${id}/edit`), [navigate])

  const handleBotAction = useCallback(
    async (
      botId: string,
      action: 'pause' | 'stop' | 'start',
    ) => {
      setActionLoading(botId)
      try {
        if (action === 'pause') await pauseBot.mutateAsync(botId)
        else if (action === 'stop') await stopBot.mutateAsync(botId)
        else await startBot.mutateAsync(botId)
        showSnackbar(`Bot ${action === 'start' ? 'started' : action === 'pause' ? 'paused' : 'stopped'} successfully`)
      } catch {
        showSnackbar(`Failed to ${action} bot`, 'error')
      } finally {
        setActionLoading(null)
      }
    },
    [pauseBot, stopBot, startBot, showSnackbar]
  )

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return
    setActionLoading(deleteTarget.id)
    try {
      await deleteBot.mutateAsync(deleteTarget.id)
      showSnackbar('Bot deleted successfully')
    } catch {
      showSnackbar('Failed to delete bot', 'error')
    } finally {
      setActionLoading(null)
      setDeleteTarget(null)
    }
  }, [deleteTarget, deleteBot, showSnackbar])

  // ---- Render ----

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          mb: 3,
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.25rem' }, fontWeight: 'bold' }}
        >
          Bots
        </Typography>
        <Button variant="primary" startIcon={<AddIcon />} onClick={handleCreateBot}>
          Create New Bot
        </Button>
      </Box>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load bots. Please try again later.
        </Alert>
      )}

      {/* Filters row */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { md: 'center' },
          gap: 2,
          mb: 3,
          p: 2,
          borderRadius: 1,
          backgroundColor: 'background.paper',
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Tabs
          value={statusFilter}
          onChange={(_e, v) => setStatusFilter(v as StatusFilter)}
          sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5, textTransform: 'none' } }}
        >
          <Tab label={`All (${counts.all})`} value="all" />
          <Tab label={`Running (${counts.running})`} value="running" />
          <Tab label={`Paused (${counts.paused})`} value="paused" />
          <Tab label={`Stopped (${counts.stopped})`} value="stopped" />
        </Tabs>

        <TextField
          size="small"
          placeholder="Search bots..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ ml: { md: 'auto' }, width: { xs: '100%', md: 260 } }}
        />
      </Box>

      {/* Bot List */}
      {isLoading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={160} />
          ))}
        </Box>
      ) : filteredBots.length === 0 ? (
        <EmptyState
          title={search ? 'No matching bots' : statusFilter !== 'all' ? `No ${statusFilter} bots` : 'No bots yet'}
          message={
            search
              ? 'Try a different search term'
              : 'Create your first bot to start trading'
          }
          variant={search ? 'empty-search' : 'no-data'}
          action={
            !search && statusFilter === 'all'
              ? { label: 'Create Bot', onClick: handleCreateBot }
              : undefined
          }
        />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredBots.map((bot) => (
            <BotListCard
              key={bot.id}
              bot={bot}
              onEdit={handleEditBot}
              onDelete={(id) => setDeleteTarget(bots?.find((b) => b.id === id) ?? null)}
              onPause={(id) => handleBotAction(id, 'pause')}
              onResume={(id) => handleBotAction(id, 'start')}
              onStop={(id) => handleBotAction(id, 'stop')}
              onStart={(id) => handleBotAction(id, 'start')}
              actionLoading={actionLoading}
            />
          ))}
        </Box>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Bot"
        maxWidth="xs"
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteConfirm}
              loading={actionLoading === deleteTarget?.id}
            >
              Delete
            </Button>
          </>
        }
      >
        <Typography>
          Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
          This action cannot be undone.
        </Typography>
      </Modal>

      {/* Snackbar */}
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

export default Bots
