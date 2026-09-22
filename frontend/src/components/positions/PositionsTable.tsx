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
import { useBook } from '@/hooks/useBook'
import { closeBookPosition } from '@/mocks/bookStore'

type SortField =
  | 'symbol'
  | 'bot_id'
  | 'quantity'
  | 'entry_price'
  | 'current_price'
  | 'unrealized_pnl'
  | 'score'
  | 'hold_minutes'
  | 'atr_stop'
  | 'opened_at'

type SortOrder = 'asc' | 'desc'

function formatHold(minutes: number | null | undefined) {
  if (minutes == null) return '—'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`
}

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
  const { bots } = useBook()

  const botNameMap = React.useMemo(() => {
    const map = new Map<string, string>()
    bots.forEach((bot) => map.set(bot.id, bot.name))
    return map
  }, [bots])

  const getBotName = (botId: string | null) => {
    if (!botId) return 'Book'
    return botNameMap.get(botId) || 'Unknown bot'
  }
  const [sellTarget, setSellTarget] = useState<Position | null>(null)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  const [isSelling, setIsSelling] = useState(false)

  const handleSellClick = (e: React.MouseEvent, position: Position) => {
    e.stopPropagation()
    setSellTarget(position)
  }

  const handleConfirmSell = () => {
    if (!sellTarget) return
    setIsSelling(true)
    const result = closeBookPosition(sellTarget.id)
    setSnackbar({
      open: true,
      message: result.message,
      severity: result.ok ? 'success' : 'error',
    })
    setSellTarget(null)
    setIsSelling(false)
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
    const aNum = typeof aVal === 'number' ? aVal : null
    const bNum = typeof bVal === 'number' ? bVal : null
    if (aNum == null && bNum == null) return 0
    if (aNum == null) return 1
    if (bNum == null) return -1
    return (aNum - bNum) * multiplier
  })

  const confirmDialog = (
    <>
      <Dialog
        open={!!sellTarget}
        onClose={() => setSellTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Close position</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Close <strong>{sellTarget?.quantity}</strong> shares of{' '}
            <strong>{sellTarget?.symbol}</strong>? The bot stays running. Open risk leaves the book.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSellTarget(null)}>Cancel</Button>
          <Button
            onClick={handleConfirmSell}
            variant="contained"
            color="error"
            disabled={isSelling}
          >
            Close position
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
              isSelling={isSelling && sellTarget?.id === position.id}
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
            <TableCell sx={{ fontWeight: 'bold' }}>Regime</TableCell>
            <SortableHeader
              label="Score"
              field="score"
              currentSort={sortField}
              currentOrder={sortOrder}
              onSort={handleSort}
              align="right"
            />
            <TableCell sx={{ fontWeight: 'bold' }}>Veto</TableCell>
            <SortableHeader
              label="Hold"
              field="hold_minutes"
              currentSort={sortField}
              currentOrder={sortOrder}
              onSort={handleSort}
              align="right"
            />
            <SortableHeader
              label="ATR stop"
              field="atr_stop"
              currentSort={sortField}
              currentOrder={sortOrder}
              onSort={handleSort}
              align="right"
            />
            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Target</TableCell>
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
              isSelling={isSelling && sellTarget?.id === position.id}
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
        <Typography variant="body1" fontWeight={600}>
          {position.symbol}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {getBotName(position.bot_id)}
        </Typography>
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
      <TableCell>
        <Typography variant="body2">{position.regime ?? '—'}</Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2">{position.score ?? '—'}</Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {position.veto_code ?? '—'}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2">{formatHold(position.hold_minutes)}</Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" color="error.main">
          {position.atr_stop != null ? formatCurrency(position.atr_stop) : '—'}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" color="success.main">
          {position.target_price != null ? formatCurrency(position.target_price) : '—'}
        </Typography>
      </TableCell>
      <TableCell align="center">
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
          Close
        </Button>
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
          <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
            {position.symbol}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {getBotName(position.bot_id)}
          </Typography>
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
            Regime
          </Typography>
          <Typography variant="body1">{position.regime ?? '—'}</Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            Score
          </Typography>
          <Typography variant="body1">{position.score ?? '—'}</Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            Hold
          </Typography>
          <Typography variant="body1">{formatHold(position.hold_minutes)}</Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            ATR stop
          </Typography>
          <Typography variant="body1" color="error.main">
            {position.atr_stop != null ? formatCurrency(position.atr_stop) : '—'}
          </Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            Target
          </Typography>
          <Typography variant="body1" color="success.main">
            {position.target_price != null ? formatCurrency(position.target_price) : '—'}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          {position.opened_at ? `Opened ${formatRelativeTime(position.opened_at)}` : ''}
        </Typography>
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
          Close
        </Button>
      </Box>
    </Paper>
  )
}
