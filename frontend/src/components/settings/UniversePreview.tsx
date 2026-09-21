import { Box, Skeleton, Typography, useMediaQuery, useTheme } from '@mui/material'
import { Card, EmptyState } from '@/components/common'
import type { UniverseSnapshot } from '@/types'
import { formatCurrency } from '@/utils/formatters'

interface UniversePreviewProps {
  snapshot: UniverseSnapshot
  loading?: boolean
}

function formatVolume(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

const UniversePreview = ({ snapshot, loading = false }: UniversePreviewProps) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Membership snapshot
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        As of {new Date(snapshot.as_of).toLocaleString()} · top {snapshot.filters.top_n} · price ≥ $
        {snapshot.filters.min_price} · spread ≤ {snapshot.filters.max_spread_bps} bps
      </Typography>

      {loading ? (
        <StackSkeletons />
      ) : snapshot.members.length === 0 ? (
        <EmptyState
          title="No names in this snapshot"
          message="Loosen the price floor or spread band, or wait for the next regular-hours scan."
          variant="no-data"
          sx={{ minHeight: 180 }}
        />
      ) : isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {snapshot.members.map((member) => (
            <Card key={member.symbol} variant="outlined">
              <Typography fontWeight={600}>{member.symbol}</Typography>
              <Typography variant="body2" color="text.secondary">
                {formatCurrency(member.price)} · volume {formatVolume(member.dollar_volume)} · spread{' '}
                {member.spread_bps.toFixed(1)} bps
              </Typography>
            </Card>
          ))}
        </Box>
      ) : (
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
          <Box component="thead">
            <Box component="tr">
              {['Symbol', 'Price', 'Dollar volume', 'Spread'].map((label) => (
                <Box
                  component="th"
                  key={label}
                  sx={{ textAlign: label === 'Symbol' ? 'left' : 'right', py: 1, fontSize: '0.8rem' }}
                >
                  {label}
                </Box>
              ))}
            </Box>
          </Box>
          <Box component="tbody">
            {snapshot.members.map((member) => (
              <Box component="tr" key={member.symbol} sx={{ borderTop: 1, borderColor: 'divider' }}>
                <Box component="td" sx={{ py: 1, fontWeight: 600 }}>
                  {member.symbol}
                </Box>
                <Box component="td" sx={{ py: 1, textAlign: 'right', fontFamily: 'monospace' }}>
                  {formatCurrency(member.price)}
                </Box>
                <Box component="td" sx={{ py: 1, textAlign: 'right' }}>
                  {formatVolume(member.dollar_volume)}
                </Box>
                <Box component="td" sx={{ py: 1, textAlign: 'right' }}>
                  {member.spread_bps.toFixed(1)} bps
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  )
}

const StackSkeletons = () => (
  <Box>
    {[1, 2, 3, 4].map((row) => (
      <Skeleton key={row} variant="rectangular" height={36} sx={{ mb: 1 }} />
    ))}
  </Box>
)

export default UniversePreview
