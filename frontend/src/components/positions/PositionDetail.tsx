import React, { useState } from 'react'
import {
  Box,
  Typography,
  Button,
  Divider,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material'
import {
  Close as CloseIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material'
import type { Position } from '@/types'
import { Modal } from '@/components/common/Modal'
import { PnLDisplay } from '@/components/common/PnLDisplay'
import { formatCurrency, formatRelativeTime } from '@/utils/formatters'
import { useBots } from '@/hooks/useBots'
import { PositionChart } from './PositionChart'

interface PositionDetailProps {
  position: Position | null
  open: boolean
  onClose: () => void
  onClosePosition: (positionId: string) => void
  isClosing: boolean
}

/**
 * PositionDetail Component
 *
 * A modal that displays full position information:
 * - Symbol, bot, quantity, prices
 * - P&L breakdown
 * - Stop loss / take profit visualization
 * - TradingView chart with markers
 * - "Close Position" button with confirmation
 */
export const PositionDetail: React.FC<PositionDetailProps> = ({
  position,
  open,
  onClose,
  onClosePosition,
  isClosing,
}) => {
  const [showConfirmClose, setShowConfirmClose] = useState(false)
  const { data: bots } = useBots()

  const getBotName = (botId: string) => {
    const bot = bots?.find((b) => b.id === botId)
    return bot?.name || 'Unknown Bot'
  }

  if (!position) return null

  const pnlPercent =
    position.entry_price > 0
      ? ((position.current_price - position.entry_price) /
          position.entry_price) *
        100
      : 0

  const totalValue = position.current_price * position.quantity
  const costBasis = position.entry_price * position.quantity

  // Duration calculation
  const openedDate = new Date(position.opened_at)
  const now = new Date()
  const durationMs = now.getTime() - openedDate.getTime()
  const durationHours = Math.floor(durationMs / (1000 * 60 * 60))
  const durationMinutes = Math.floor(
    (durationMs % (1000 * 60 * 60)) / (1000 * 60)
  )
  const durationStr =
    durationHours > 0
      ? `${durationHours}h ${durationMinutes}m`
      : `${durationMinutes}m`

  const handleClosePosition = () => {
    if (!showConfirmClose) {
      setShowConfirmClose(true)
      return
    }
    onClosePosition(position.id)
    setShowConfirmClose(false)
  }

  const handleModalClose = () => {
    setShowConfirmClose(false)
    onClose()
  }

  const actions = (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 1,
      }}
    >
      {showConfirmClose && (
        <Alert
          severity="warning"
          sx={{ flex: 1, minWidth: 200, py: 0 }}
          action={
            <Button
              size="small"
              color="inherit"
              onClick={() => setShowConfirmClose(false)}
            >
              Cancel
            </Button>
          }
        >
          Are you sure you want to close this position?
        </Alert>
      )}
      <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
        <Button variant="outlined" onClick={handleModalClose}>
          {showConfirmClose ? 'Cancel' : 'Close'}
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleClosePosition}
          disabled={isClosing}
          startIcon={
            isClosing ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <CloseIcon />
            )
          }
        >
          {showConfirmClose
            ? 'Confirm Close'
            : isClosing
              ? 'Closing...'
              : 'Close Position'}
        </Button>
      </Box>
    </Box>
  )

  return (
    <Modal
      open={open}
      onClose={handleModalClose}
      title={`${position.symbol} Position`}
      maxWidth="md"
      actions={actions}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
        {/* Header info */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
              {position.symbol}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {getBotName(position.bot_id)}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                mt: 0.5,
              }}
            >
              <AccessTimeIcon
                sx={{ fontSize: 14, color: 'text.secondary' }}
              />
              <Typography variant="body2" color="text.secondary">
                Open for {durationStr} (since{' '}
                {formatRelativeTime(position.opened_at)})
              </Typography>
            </Box>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <PnLDisplay
              amount={position.unrealized_pnl}
              percentage={pnlPercent}
              showSign
              size="large"
              bold
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Unrealized P&L
            </Typography>
          </Box>
        </Box>

        <Divider />

        {/* Position details grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, 1fr)',
              sm: 'repeat(3, 1fr)',
              md: 'repeat(4, 1fr)',
            },
            gap: 2.5,
          }}
        >
          <DetailItem label="Quantity" value={position.quantity.toString()} />
          <DetailItem
            label="Entry Price"
            value={formatCurrency(position.entry_price)}
          />
          <DetailItem
            label="Current Price"
            value={formatCurrency(position.current_price)}
            highlight
          />
          <DetailItem
            label="Cost Basis"
            value={formatCurrency(costBasis)}
          />
          <DetailItem
            label="Market Value"
            value={formatCurrency(totalValue)}
          />
          <DetailItem
            label="Stop Loss"
            value={
              position.stop_loss_price
                ? formatCurrency(position.stop_loss_price)
                : 'Not set'
            }
            valueColor={position.stop_loss_price ? 'error.main' : undefined}
          />
          <DetailItem
            label="Take Profit"
            value={
              position.take_profit_price
                ? formatCurrency(position.take_profit_price)
                : 'Not set'
            }
            valueColor={position.take_profit_price ? 'success.main' : undefined}
          />
          <DetailItem
            label="Duration"
            value={durationStr}
          />
          {position.entry_indicator && (
            <DetailItem
              label="Entry Indicator"
              value={position.entry_indicator}
              valueColor="info.main"
            />
          )}
        </Box>

        {/* Risk level chips */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {position.stop_loss_price && (
            <Chip
              label={`SL: ${formatCurrency(position.stop_loss_price)} (${(
                ((position.stop_loss_price - position.entry_price) /
                  position.entry_price) *
                100
              ).toFixed(2)}%)`}
              size="small"
              color="error"
              variant="outlined"
            />
          )}
          {position.take_profit_price && (
            <Chip
              label={`TP: ${formatCurrency(position.take_profit_price)} (${(
                ((position.take_profit_price - position.entry_price) /
                  position.entry_price) *
                100
              ).toFixed(2)}%)`}
              size="small"
              color="success"
              variant="outlined"
            />
          )}
          <Chip
            label={`P&L: ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%`}
            size="small"
            color={pnlPercent >= 0 ? 'success' : 'error'}
          />
          {position.entry_indicator && (
            <Chip
              label={`Entry: ${position.entry_indicator}`}
              size="small"
              color="info"
              variant="outlined"
            />
          )}
        </Box>

        <Divider />

        {/* Chart */}
        <PositionChart position={position} />
      </Box>
    </Modal>
  )
}

/** Helper component for detail items in the grid */
const DetailItem: React.FC<{
  label: string
  value: string
  highlight?: boolean
  valueColor?: string
}> = ({ label, value, highlight, valueColor }) => (
  <Box>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.25 }}>
      {label}
    </Typography>
    <Typography
      variant="body1"
      sx={{
        fontWeight: highlight ? 600 : 500,
        color: valueColor || 'text.primary',
      }}
    >
      {value}
    </Typography>
  </Box>
)
