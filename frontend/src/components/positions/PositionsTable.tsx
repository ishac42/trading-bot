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
} from '@mui/material'
import type { Position } from '@/types'
import { formatCurrency, formatRelativeTime } from '@/utils/formatters'
import { PnLDisplay } from '@/components/common/PnLDisplay'
import { getBotName } from '@/mocks/dashboardData'

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

  if (isMobile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {sortedPositions.map((position) => (
          <PositionCard
            key={position.id}
            position={position}
            onClick={() => onPositionClick(position)}
          />
        ))}
      </Box>
    )
  }

  return (
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
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedPositions.map((position) => (
            <PositionRow
              key={position.id}
              position={position}
              onClick={() => onPositionClick(position)}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
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
}> = ({ position, onClick }) => {
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
          {formatRelativeTime(position.opened_at)}
        </Typography>
      </TableCell>
    </TableRow>
  )
}

/** Mobile card view for a single position */
const PositionCard: React.FC<{
  position: Position
  onClick: () => void
}> = ({ position, onClick }) => {
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

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mt: 1.5, textAlign: 'right' }}
      >
        Opened {formatRelativeTime(position.opened_at)}
      </Typography>
    </Paper>
  )
}
