import React from 'react'
import {
  Box,
  Typography,
  Chip,
  Divider,
} from '@mui/material'
import { Modal, PnLDisplay } from '@/components/common'
import type { Trade } from '@/types'
import { formatCurrency } from '@/utils/formatters'
import { useBook } from '@/hooks/useBook'

interface TradeDetailModalProps {
  trade: Trade | null
  open: boolean
  onClose: () => void
}

/**
 * A row in the detail view
 */
const DetailRow: React.FC<{
  label: string
  children: React.ReactNode
}> = ({ label, children }) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      py: 0.75,
    }}
  >
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    <Box>{children}</Box>
  </Box>
)

/**
 * TradeDetailModal Component
 *
 * Shows full trade details in a modal dialog when a trade row is clicked.
 * Includes trade ID, symbol, type, quantity, price, bot, time, status,
 * P&L, commission, slippage, order ID, and indicator snapshot.
 */
export const TradeDetailModal: React.FC<TradeDetailModalProps> = ({
  trade,
  open,
  onClose,
}) => {
  const { bots } = useBook()
  const getBotName = (botId: string) => {
    if (!botId) return 'Book'
    return bots.find((bot) => bot.id === botId)?.name || 'Unknown bot'
  }

  if (!trade) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Trade Details - ${trade.symbol}`}
      maxWidth="xs"
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {/* Core Info */}
        <DetailRow label="Trade ID">
          <Typography
            variant="body2"
            sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
          >
            {trade.id}
          </Typography>
        </DetailRow>

        <DetailRow label="Symbol">
          <Typography variant="body2" fontWeight={600}>
            {trade.symbol}
          </Typography>
        </DetailRow>

        <DetailRow label="Type">
          <Chip
            label={trade.type.toUpperCase()}
            size="small"
            color={trade.type === 'buy' ? 'success' : 'error'}
            sx={{ fontWeight: 600 }}
          />
        </DetailRow>

        <DetailRow label="Quantity">
          <Typography variant="body2">{trade.quantity}</Typography>
        </DetailRow>

        <DetailRow label="Price">
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {formatCurrency(trade.price)}
          </Typography>
        </DetailRow>

        <DetailRow label="Total Value">
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {formatCurrency(trade.price * trade.quantity)}
          </Typography>
        </DetailRow>

        <Divider sx={{ my: 1 }} />

        <DetailRow label="Bot">
          <Typography variant="body2">{getBotName(trade.bot_id)}</Typography>
        </DetailRow>

        <DetailRow label="Time">
          <Typography variant="body2">
            {new Date(trade.timestamp).toLocaleString()}
          </Typography>
        </DetailRow>

        <DetailRow label="Status">
          <Chip
            label={trade.status}
            size="small"
            variant="outlined"
            color={
              trade.status === 'filled'
                ? 'success'
                : trade.status === 'failed'
                  ? 'error'
                  : trade.status === 'cancelled'
                    ? 'warning'
                    : 'default'
            }
            sx={{ textTransform: 'capitalize' }}
          />
        </DetailRow>

        <DetailRow label="Reason">
          <Typography variant="body2">{trade.reason_code || trade.reason || '—'}</Typography>
        </DetailRow>

        <DetailRow label="Shortfall">
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {trade.shortfall != null ? formatCurrency(trade.shortfall) : '—'}
          </Typography>
        </DetailRow>

        <DetailRow label="Regime">
          <Typography variant="body2">{trade.regime ?? '—'}</Typography>
        </DetailRow>

        <DetailRow label="Session">
          <Typography variant="body2">{trade.session ?? '—'}</Typography>
        </DetailRow>

        {trade.order_id && (
          <DetailRow label="Order ID">
            <Typography
              variant="body2"
              sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
            >
              {trade.order_id}
            </Typography>
          </DetailRow>
        )}

        {trade.client_order_id && (
          <DetailRow label="Client Order ID">
            <Typography
              variant="body2"
              sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
            >
              {trade.client_order_id}
            </Typography>
          </DetailRow>
        )}

        <Divider sx={{ my: 1 }} />

        {/* Financial Details */}
        {trade.profit_loss !== undefined && (
          <DetailRow label="P&L">
            <PnLDisplay amount={trade.profit_loss} showSign size="small" bold />
          </DetailRow>
        )}

        {trade.commission !== undefined && (
          <DetailRow label="Commission">
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {formatCurrency(trade.commission)}
            </Typography>
          </DetailRow>
        )}

        {trade.slippage !== undefined && (
          <DetailRow label="Slippage">
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {formatCurrency(trade.slippage)}
            </Typography>
          </DetailRow>
        )}

      </Box>
    </Modal>
  )
}
