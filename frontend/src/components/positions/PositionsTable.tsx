import React, { useState } from 'react'
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  Typography,
  useMediaQuery,
  useTheme,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  Alert,
} from '@mui/material'
import type { Position } from '@/types'
import { formatCurrency, formatRelativeTime } from '@/utils/formatters'
import { PnLDisplay } from '@/components/common/PnLDisplay'
import { useBots } from '@/hooks/useBots'
import { useClosePosition } from '@/hooks/usePositions'

type SortField =
  | 'symbol'
  | 'bot_id'
  | 'quantity'
  | 'entry_price'
  | 'current_price'
  | 'unrealized_pnl'
  | 'stop_loss_price'
  | 'opened_at'

type SortOrder = 'asc' | 'desc'

interface PositionsTableProps {
  positions: Position[]
  onPositionClick: (position: Position) => void
  externalSort?: { field: string; order: string } | null
}

/**
 * PositionsTable Component
 *
 * Displays positions in a sortable table (desktop) or card list (mobile).
 * - Sortable columns
 * - Color-coded P&L
 * - Responsive: table on desktop, cards on mobile
 */
export const PositionsTable: React.FC<PositionsTableProps> = ({
  positions,
  onPositionClick,
  externalSort,
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const { data: bots } = useBots()

  const botNameMap = React.useMemo(() => {
    const map = new Map<string, string>()
    bots?.forEach((bot) => map.set(bot.id, bot.name))
    return map
  }, [bots])

  const getBotName = (botId: string | null) => {
    if (!botId) return null
    return botNameMap.get(botId) || 'Unknown Bot'
  }

  const isUnmanaged = (position: Position) => !position.bot_id

  const closePosition = useClosePosition()
  const [sellTarget, setSellTarget] = useState<Position | null>(null)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  const handleSellClick = (e: React.MouseEvent, position: Position) => {
    e.stopPropagation()
    setSellTarget(position)
  }

  const handleConfirmSell = () => {
    if (!sellTarget) return
    const botLabel = getBotName(sellTarget.bot_id)
    closePosition.mutate(
      { positionId: sellTarget.id, pauseBot: true },
      {
        onSuccess: (data: any) => {
          const msg = data.bot_paused
            ? `Position closed. Bot '${data.bot_name}' has been paused.`
            : 'Position closed successfully.'
          setSnackbar({ open: true, message: msg, severity: 'success' })
          setSellTarget(null)
        },
        onError: () => {
          setSnackbar({ open: true, message: 'Failed to close position.', severity: 'error' })
          setSellTarget(null)
        },
      }
    )
  }

  const [sortField, setSortField] = useState<SortField>('opened_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // Sort positions
  const sortedPositions = [...positions].sort((a, b) => {
    // If external sort is provided, skip internal sorting
    if (externalSort) return 0

    const multiplier = sortOrder === 'asc' ? 1 : -1
    const aVal = a[sortField]
    const bVal = b[sortField]

    if (aVal === undefined && bVal === undefined) return 0
    if (aVal === undefined) return 1
    if (bVal === undefined) return -1

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal) * multiplier
    }
    return ((aVal as number) - (bVal as number)) * multiplier
  })

  const confirmDialog = (
    <>
      <Dialog
        open={!!sellTarget}
        onClose={() => setSellTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Emergency Sell</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Sell all <strong>{sellTarget?.quantity}</strong> shares of{' '}
            <strong>{sellTarget?.symbol}</strong> at market price?
            {sellTarget?.bot_id && (
              <> Bot &apos;{getBotName(sellTarget.bot_id)}&apos; will be paused.</>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSellTarget(null)}>Cancel</Button>
          <Button
            onClick={handleConfirmSell}
            variant="contained"
            color="error"
            disabled={closePosition.isPending}
          >
            Sell &amp; Pause Bot
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  )

  if (isMobile) {
    return (
      <>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sortedPositions.map((position) => (
            <PositionCard
              key={position.id}
              position={position}
              onClick={() => onPositionClick(position)}
              getBotName={getBotName}
              onSellClick={handleSellClick}
              isSelling={closePosition.isPending && sellTarget?.id === position.id}
            />
          ))}
        </Box>
        {confirmDialog}
      </>
    )
  }

  return (
    <>
    <TableContainer component={Paper} elevation={1}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <SortableHeader
              label="Symbol"
              field="symbol"
              currentSort={sortField}
              currentOrder={sortOrder}
              onSort={handleSort}
            />
            <SortableHeader
              label="Bot"
              field="bot_id"
              currentSort={sortField}
              currentOrder={sortOrder}
              onSort={handleSort}
            />
            <SortableHeader
              label="Qty"
              field="quantity"
              currentSort={sortField}
              currentOrder={sortOrder}
              onSort={handleSort}
              align="right"
            />
            <SortableHeader
              label="Entry Price"
              field="entry_price"
              currentSort={sortField}
              currentOrder={sortOrder}
              onSort={handleSort}
              align="right"
            />
            <SortableHeader
              label="Current Price"
              field="current_price"
              currentSort={sortField}
              currentOrder={sortOrder}
              onSort={handleSort}
              align="right"
            />
            <SortableHeader
              label="P&L"
              field="unrealized_pnl"
              currentSort={sortField}
              currentOrder={sortOrder}
              onSort={handleSort}
              align="right"
            />
            <SortableHeader
              label="Stop Loss"
              field="stop_loss_price"
              currentSort={sortField}
              currentOrder={sortOrder}
              onSort={handleSort}
              align="right"
            />
            <SortableHeader
              label="Opened"
              field="opened_at"
              currentSort={sortField}
              currentOrder={sortOrder}
              onSort={handleSort}
            />
            <TableCell align="center" sx={{ fontWeight: 'bold', width: 80 }}>
              Action
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedPositions.map((position) => (
            <PositionRow
              key={position.id}
              position={position}
              onClick={() => onPositionClick(position)}
              getBotName={getBotName}
              onSellClick={handleSellClick}
              isSelling={closePosition.isPending && sellTarget?.id === position.id}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
    {confirmDialog}
    </>
  )
}

/** Sortable table header cell */
const SortableHeader: React.FC<{
  label: string
  field: SortField
  currentSort: SortField
  currentOrder: SortOrder
  onSort: (field: SortField) => void
  align?: 'left' | 'right' | 'center'
}> = ({ label, field, currentSort, currentOrder, onSort, align = 'left' }) => (
  <TableCell align={align} sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
    <TableSortLabel
      active={currentSort === field}
      direction={currentSort === field ? currentOrder : 'asc'}
      onClick={() => onSort(field)}
    >
      {label}
    </TableSortLabel>
  </TableCell>
)

/** Table row for a single position */
const PositionRow: React.FC<{
  position: Position
  onClick: () => void
  getBotName: (botId: string | null) => string | null
  onSellClick: (e: React.MouseEvent, position: Position) => void
  isSelling: boolean
}> = ({ position, onClick, getBotName, onSellClick, isSelling }) => {
  const pnlPercent =
    position.entry_price > 0
      ? ((position.current_price - position.entry_price) /
          position.entry_price) *
        100
      : 0

  return (
    <TableRow
      hover
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        '&:last-child td': { borderBottom: 0 },
      }}
    >
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography variant="body1" fontWeight={600}>
            {position.symbol}
          </Typography>
          {position.entry_indicator && (
            <Chip
              label={position.entry_indicator}
              size="small"
              color="info"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          )}
        </Box>
      </TableCell>
      <TableCell>
        {position.bot_id ? (
          <Typography variant="body2" color="text.secondary">
            {getBotName(position.bot_id)}
          </Typography>
        ) : (
          <Chip
            label="Unmanaged"
            size="small"
            color="warning"
            variant="filled"
            sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600 }}
          />
        )}
      </TableCell>
      <TableCell align="right">
        <Typography variant="body1">{position.quantity}</Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body1">
          {formatCurrency(position.entry_price)}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body1" fontWeight={500}>
          {formatCurrency(position.current_price)}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <PnLDisplay
          amount={position.unrealized_pnl}
          percentage={pnlPercent}
          showSign
          size="small"
        />
      </TableCell>
      <TableCell align="right">
        {position.stop_loss_price ? (
          <Typography variant="body2" color="error.main">
            {formatCurrency(position.stop_loss_price)}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            —
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {position.opened_at ? formatRelativeTime(position.opened_at) : '—'}
        </Typography>
      </TableCell>
      <TableCell align="center">
        {position.bot_id && (
          <Button
            size="small"
            variant="contained"
            color="error"
            disabled={isSelling}
            onClick={(e) => onSellClick(e, position)}
            sx={{
              minWidth: 56,
              height: 28,
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'none',
            }}
          >
            SELL
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

/** Mobile card view for a single position */
const PositionCard: React.FC<{
  position: Position
  onClick: () => void
  getBotName: (botId: string | null) => string | null
  onSellClick: (e: React.MouseEvent, position: Position) => void
  isSelling: boolean
}> = ({ position, onClick, getBotName, onSellClick, isSelling }) => {
  const pnlPercent =
    position.entry_price > 0
      ? ((position.current_price - position.entry_price) /
          position.entry_price) *
        100
      : 0

  return (
    <Paper
      elevation={1}
      onClick={onClick}
      sx={{
        p: 2,
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-1px)',
          boxShadow: 3,
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 1.5,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
              {position.symbol}
            </Typography>
            {position.entry_indicator && (
              <Chip
                label={position.entry_indicator}
                size="small"
                color="info"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}
          </Box>
          {position.bot_id ? (
            <Typography variant="body2" color="text.secondary">
              {getBotName(position.bot_id)}
            </Typography>
          ) : (
            <Chip
              label="Unmanaged"
              size="small"
              color="warning"
              variant="filled"
              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }}
            />
          )}
        </Box>
        <PnLDisplay
          amount={position.unrealized_pnl}
          percentage={pnlPercent}
          showSign
          size="small"
          bold
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 1,
        }}
      >
        <Box>
          <Typography variant="body2" color="text.secondary">
            Qty
          </Typography>
          <Typography variant="body1">{position.quantity}</Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            Entry
          </Typography>
          <Typography variant="body1">
            {formatCurrency(position.entry_price)}
          </Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            Current
          </Typography>
          <Typography variant="body1" fontWeight={500}>
            {formatCurrency(position.current_price)}
          </Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            Stop Loss
          </Typography>
          {position.stop_loss_price ? (
            <Chip
              label={formatCurrency(position.stop_loss_price)}
              size="small"
              color="error"
              variant="outlined"
              sx={{ height: 22 }}
            />
          ) : (
            <Typography variant="body1" color="text.secondary">
              —
            </Typography>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          {position.opened_at ? `Opened ${formatRelativeTime(position.opened_at)}` : ''}
        </Typography>
        {position.bot_id && (
          <Button
            size="small"
            variant="contained"
            color="error"
            disabled={isSelling}
            onClick={(e) => onSellClick(e, position)}
            sx={{
              minWidth: 56,
              height: 28,
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'none',
            }}
          >
            SELL
          </Button>
        )}
      </Box>
    </Paper>
  )
}
