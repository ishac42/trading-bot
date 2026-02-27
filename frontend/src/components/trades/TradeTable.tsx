import React from 'react'
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  Chip,
  Typography,
  Skeleton,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { Card, PnLDisplay, EmptyState } from '@/components/common'
import type { Trade, TradeSort, TradeSortField, TradePagination } from '@/types'
import { formatCurrency } from '@/utils/formatters'
import { useBots } from '@/hooks/useBots'

interface TradeTableProps {
  trades: Trade[]
  pagination: TradePagination
  sort: TradeSort
  isLoading: boolean
  onSortChange: (sort: TradeSort) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onRowClick: (trade: Trade) => void
}

interface Column {
  id: TradeSortField | 'bot' | 'reason'
  label: string
  sortable: boolean
  align?: 'left' | 'right' | 'center'
  minWidth?: number
}

const columns: Column[] = [
  { id: 'timestamp', label: 'Time', sortable: true, minWidth: 140 },
  { id: 'symbol', label: 'Symbol', sortable: true, minWidth: 80 },
  { id: 'type', label: 'Type', sortable: true, minWidth: 70 },
  { id: 'quantity', label: 'Qty', sortable: true, align: 'right', minWidth: 60 },
  { id: 'price', label: 'Price', sortable: true, align: 'right', minWidth: 90 },
  { id: 'bot', label: 'Bot', sortable: false, minWidth: 120 },
  { id: 'profit_loss', label: 'P&L', sortable: true, align: 'right', minWidth: 90 },
  { id: 'reason', label: 'Reason', sortable: false, minWidth: 140 },
]

/**
 * Mobile card view for a single trade
 */
const TradeCardMobile: React.FC<{
  trade: Trade
  onClick: () => void
  getBotName: (botId: string) => string
}> = ({ trade, onClick, getBotName }) => (
  <Box
    onClick={onClick}
    sx={{
      p: 2,
      border: 1,
      borderColor: 'divider',
      borderRadius: 1,
      cursor: 'pointer',
      '&:hover': { backgroundColor: 'action.hover' },
      transition: 'background-color 0.15s',
    }}
  >
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body1" fontWeight={600}>
          {trade.symbol}
        </Typography>
        <Chip
          label={trade.type.toUpperCase()}
          size="small"
          color={trade.type === 'buy' ? 'success' : 'error'}
          sx={{ fontWeight: 600, height: 20, fontSize: '0.7rem' }}
        />
      </Box>
      {trade.profit_loss !== undefined ? (
        <PnLDisplay amount={trade.profit_loss} percentage={trade.profit_loss_pct} showSign size="small" bold />
      ) : (
        <Typography variant="body2" color="text.secondary">
          -
        </Typography>
      )}
    </Box>
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {new Date(trade.timestamp).toLocaleDateString()} ·{' '}
        {new Date(trade.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}{' '}
        · Qty: {trade.quantity} · {formatCurrency(trade.price)}
      </Typography>
    </Box>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontSize: '0.75rem' }}
      >
        {getBotName(trade.bot_id)}
      </Typography>
      {trade.reason && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontSize: '0.7rem', fontStyle: 'italic' }}
        >
          {trade.reason}
        </Typography>
      )}
    </Box>
  </Box>
)

/**
 * Loading skeleton for the table
 */
const TableSkeleton: React.FC = () => (
  <Card>
    {Array.from({ length: 8 }).map((_, i) => (
      <Skeleton key={i} variant="rectangular" height={44} sx={{ mb: 0.5 }} />
    ))}
  </Card>
)

/**
 * TradeTable Component
 *
 * Enhanced table with sorting, pagination, and responsive mobile card view.
 * Supports clicking rows to open trade detail modal.
 */
export const TradeTable: React.FC<TradeTableProps> = ({
  trades,
  pagination,
  sort,
  isLoading,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  onRowClick,
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const { data: bots } = useBots()

  const getBotName = React.useCallback(
    (botId: string) => bots?.find((b) => b.id === botId)?.name || 'Unknown Bot',
    [bots]
  )

  const handleSort = (field: TradeSortField) => {
    const isAsc = sort.field === field && sort.direction === 'asc'
    onSortChange({ field, direction: isAsc ? 'desc' : 'asc' })
  }

  const handleChangePage = (_: unknown, newPage: number) => {
    onPageChange(newPage + 1) // MUI is 0-based, our pagination is 1-based
  }

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    onPageSizeChange(parseInt(event.target.value, 10))
    onPageChange(1)
  }

  if (isLoading) return <TableSkeleton />

  if (trades.length === 0) {
    return (
      <EmptyState
        title="No trades found"
        message="Try adjusting your filters or date range to find trades"
        variant="empty-search"
        sx={{ minHeight: 200 }}
      />
    )
  }

  return (
    <Box>
      {isMobile ? (
        // Mobile: Card-based view
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {trades.map((trade) => (
            <TradeCardMobile
              key={trade.id}
              trade={trade}
              onClick={() => onRowClick(trade)}
              getBotName={getBotName}
            />
          ))}
        </Box>
      ) : (
        // Desktop: Table view
        <TableContainer
          component={Card}
          variant="outlined"
          sx={{ overflow: 'auto' }}
        >
          <Table size="small" aria-label="trade history">
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    align={column.align || 'left'}
                    sx={{
                      fontWeight: 600,
                      minWidth: column.minWidth,
                      whiteSpace: 'nowrap',
                    }}
                    sortDirection={
                      sort.field === column.id ? sort.direction : false
                    }
                  >
                    {column.sortable ? (
                      <TableSortLabel
                        active={sort.field === column.id}
                        direction={
                          sort.field === column.id ? sort.direction : 'asc'
                        }
                        onClick={() =>
                          handleSort(column.id as TradeSortField)
                        }
                      >
                        {column.label}
                      </TableSortLabel>
                    ) : (
                      column.label
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {trades.map((trade) => (
                <TableRow
                  key={trade.id}
                  hover
                  onClick={() => onRowClick(trade)}
                  sx={{
                    cursor: 'pointer',
                    '&:last-child td, &:last-child th': { border: 0 },
                  }}
                >
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {new Date(trade.timestamp).toLocaleDateString()}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontSize: '0.7rem' }}
                      >
                        {new Date(trade.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {trade.symbol}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={trade.type.toUpperCase()}
                      size="small"
                      color={trade.type === 'buy' ? 'success' : 'error'}
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        height: 22,
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{trade.quantity}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: 'monospace' }}
                    >
                      {formatCurrency(trade.price)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontSize: '0.8rem' }}
                    >
                      {getBotName(trade.bot_id)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {trade.profit_loss !== undefined ? (
                      <PnLDisplay
                        amount={trade.profit_loss}
                        percentage={trade.profit_loss_pct}
                        showSign
                        size="small"
                        bold
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontSize: '0.75rem' }}
                    >
                      {trade.reason || '—'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Pagination */}
      <TablePagination
        component="div"
        count={pagination.totalItems}
        page={pagination.page - 1} // MUI is 0-based
        rowsPerPage={pagination.pageSize}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[10, 25, 50]}
        sx={{
          '& .MuiTablePagination-toolbar': {
            flexWrap: 'wrap',
            justifyContent: { xs: 'center', sm: 'flex-end' },
          },
        }}
      />
    </Box>
  )
}
