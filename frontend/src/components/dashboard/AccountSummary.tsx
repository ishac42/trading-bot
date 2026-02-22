import React from 'react'
import {
  Box,
  Typography,
  Skeleton,
  Chip,
  LinearProgress,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import {
  AccountBalance as AccountIcon,
  Savings as CashIcon,
  ShoppingCart as BuyingPowerIcon,
  TrendingUp as GainsIcon,
  PieChart as AllocationIcon,
} from '@mui/icons-material'
import { Card } from '@/components/common'
import { useAccount } from '@/hooks/useAccount'
import { formatCurrency } from '@/utils/formatters'

interface MetricCardProps {
  label: string
  value: string
  icon: React.ReactNode
  color?: string
  subtitle?: string
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  icon,
  color,
  subtitle,
}) => (
  <Card variant="elevated" elevation={1} sx={{ height: '100%' }}>
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
      <Box
        sx={{
          p: 0.75,
          borderRadius: 1.5,
          backgroundColor: color || 'primary.main',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
          {label}
        </Typography>
        <Typography
          variant="h6"
          sx={{ fontWeight: 'bold', lineHeight: 1.3, fontSize: '1.1rem' }}
        >
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
  </Card>
)

export const AccountSummary: React.FC = () => {
  const { data: account, isLoading } = useAccount()

  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="text" width={200} height={28} sx={{ mb: 1.5 }} />
        <Grid container spacing={2}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 2.4 }}>
              <Card variant="elevated">
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                  <Skeleton variant="rounded" width={32} height={32} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="60%" />
                    <Skeleton variant="text" width="80%" height={28} />
                  </Box>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    )
  }

  if (!account) return null

  const allocationPct =
    account.buying_power > 0
      ? Math.min((account.allocated_capital / account.buying_power) * 100, 100)
      : 0

  const allocationColor =
    allocationPct > 90 ? 'error' : allocationPct > 70 ? 'warning' : 'success'

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Account Overview
        </Typography>
        {account.account_number && (
          <Chip
            label={`#${account.account_number}`}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.75rem' }}
          />
        )}
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <MetricCard
            label="Total Account Value"
            value={formatCurrency(account.equity)}
            icon={<AccountIcon fontSize="small" />}
            color="#1976d2"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <MetricCard
            label="Cash"
            value={formatCurrency(account.cash)}
            icon={<CashIcon fontSize="small" />}
            color="#388e3c"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <MetricCard
            label="Buying Power"
            value={formatCurrency(account.buying_power)}
            icon={<BuyingPowerIcon fontSize="small" />}
            color="#7b1fa2"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <MetricCard
            label="Total Realized Gains"
            value={formatCurrency(account.total_realized_gains, '$', true)}
            icon={<GainsIcon fontSize="small" />}
            color={account.total_realized_gains >= 0 ? '#2e7d32' : '#d32f2f'}
            subtitle={
              account.total_realized_gains >= 0 ? 'Profit' : 'Loss'
            }
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card variant="elevated" elevation={1} sx={{ height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              <Box
                sx={{
                  p: 0.75,
                  borderRadius: 1.5,
                  backgroundColor: '#ed6c02',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AllocationIcon fontSize="small" />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Capital Allocation
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                  {formatCurrency(account.allocated_capital)} / {formatCurrency(account.buying_power)}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={allocationPct}
                  color={allocationColor}
                  sx={{ height: 6, borderRadius: 3, mb: 0.5 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {formatCurrency(account.available_capital)} available
                </Typography>
              </Box>
            </Box>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
