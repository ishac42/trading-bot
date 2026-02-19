import React, { useState, useCallback } from 'react'
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Skeleton,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { Card, Button, PnLDisplay, EmptyState, Modal } from '@/components/common'
import type { Trade } from '@/types'
import { formatTime, formatCurrency } from '@/utils/formatters'
import { useBots } from '@/hooks/useBots'

interface RecentTradesTableProps {
  trades?: Trade[]
  isLoading: boolean
}

/**
 * Trade Detail content shown in modal
 */
const TradeDetail: React.FC<{ trade: Trade; getBotName: (botId: string) => string }> = ({ trade, getBotName }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Typography variant="body2" color="text.secondary">
        Trade ID
      </Typography>
      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
        {trade.id}
      </Typography>
    </Box>
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Typography variant="body2" color="text.secondary">
        Symbol
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {trade.symbol}
      </Typography>
    </Box>
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Typography variant="body2" color="text.secondary">
        Type
      </Typography>
      <Chip
        label={trade.type.toUpperCase()}
        size="small"
        color={trade.type === 'buy' ? 'success' : 'error'}
        sx={{ fontWeight: 600 }}
      />
    </Box>
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Typography variant="body2" color="text.secondary">
        Quantity
      </Typography>
      <Typography variant="body2">{trade.quantity}</Typography>
    </Box>
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Typography variant="body2" color="text.secondary">
        Price
      </Typography>
      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
        {formatCurrency(trade.price)}
      </Typography>
    </Box>
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Typography variant="body2" color="text.secondary">
        Bot
      </Typography>
      <Typography variant="body2">{getBotName(trade.bot_id)}</Typography>
    </Box>
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Typography variant="body2" color="text.secondary">
        Time
      </Typography>
      <Typography variant="body2">
        {new Date(trade.timestamp).toLocaleString()}
      </Typography>
    </Box>
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Typography variant="body2" color="text.secondary">
        Status
      </Typography>
      <Chip
        label={trade.status}
        size="small"
        variant="outlined"
        sx={{ textTransform: 'capitalize' }}
      />
    </Box>
    {trade.profit_loss !== undefined && (
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary">
          P&L
        </Typography>
        <PnLDisplay amount={trade.profit_loss} showSign size="small" bold />
      </Box>
    )}
    {trade.commission !== undefined && (
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary">
          Commission
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {formatCurrency(trade.commission)}
        </Typography>
      </Box>
    )}
  </Box>
)

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
        <PnLDisplay amount={trade.profit_loss} showSign size="small" bold />
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
        {formatTime(trade.timestamp)} · Qty: {trade.quantity} ·{' '}
        {formatCurrency(trade.price)}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontSize: '0.75rem' }}
      >
        {getBotName(trade.bot_id)}
      </Typography>
    </Box>
  </Box>
)

/**
 * RecentTradesTable Component
 *
 * Displays recent trades in a table format (desktop) or card format (mobile).
 * Includes a "View All" link to the trades page.
 */
export const RecentTradesTable: React.FC<RecentTradesTableProps> = ({
  trades,
  isLoading,
}) => {
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const { data: bots } = useBots()

  const getBotName = useCallback(
    (botId: string) => bots?.find((b) => b.id === botId)?.name || 'Unknown Bot',
    [bots]
  )

  const handleRowClick = useCallback((trade: Trade) => {
    setSelectedTrade(trade)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setSelectedTrade(null)
  }, [])

  const handleViewAll = () => {
    navigate('/trades')
  }

  if (isLoading) {
    return (
      <Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Skeleton variant="text" width={150} height={32} />
          <Skeleton variant="text" width={80} />
        </Box>
        <Card>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              height={40}
              sx={{ mb: 1 }}
            />
          ))}
        </Card>
      </Box>
    )
  }

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Typography variant="h3" component="h2" sx={{ fontWeight: 600 }}>
          Recent Trades
        </Typography>
        <Button
          variant="text"
          size="small"
          endIcon={<ArrowForwardIcon />}
          onClick={handleViewAll}
        >
          View All
        </Button>
      </Box>

      {!trades || trades.length === 0 ? (
        <EmptyState
          title="No trades yet"
          message="Trades will appear here once your bots start trading"
          variant="no-data"
          sx={{ minHeight: 200 }}
        />
      ) : isMobile ? (
        // Mobile: Card-based view
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {trades.map((trade) => (
            <TradeCardMobile
              key={trade.id}
              trade={trade}
              onClick={() => handleRowClick(trade)}
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
          <Table size="small" aria-label="recent trades">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Symbol</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">
                  Qty
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">
                  Price
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Bot</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">
                  P&L
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {trades.map((trade) => (
                <TableRow
                  key={trade.id}
                  hover
                  onClick={() => handleRowClick(trade)}
                  sx={{
                    cursor: 'pointer',
                    '&:last-child td, &:last-child th': { border: 0 },
                  }}
                >
                  <TableCell>
                    <Typography variant="body2">
                      {formatTime(trade.timestamp)}
                    </Typography>
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
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Trade Detail Modal */}
      <Modal
        open={!!selectedTrade}
        onClose={handleCloseDetail}
        title={
          selectedTrade
            ? `Trade Details - ${selectedTrade.symbol}`
            : 'Trade Details'
        }
        maxWidth="xs"
      >
        {selectedTrade && <TradeDetail trade={selectedTrade} getBotName={getBotName} />}
      </Modal>
    </Box>
  )
}
