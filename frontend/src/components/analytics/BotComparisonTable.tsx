import React, { useState } from 'react'
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Chip,
  Skeleton,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import { Card, PnLDisplay, StatusBadge } from '@/components/common'
import { formatCurrency } from '@/utils/formatters'
import type { BotPerformanceData } from '@/types'

interface BotComparisonTableProps {
  data: BotPerformanceData[] | undefined
  isLoading: boolean
}

type SortField = 'botName' | 'totalPnL' | 'winRate' | 'totalTrades' | 'profitFactor' | 'returnOnCapital'
type SortDir = 'asc' | 'desc'

/**
 * BotComparisonTable Component
 *
 * Table view for comparing bot performance with sortable columns.
 * Shows P&L, win rate, trades, profit factor, and ROC for each bot.
 */
export const BotComparisonTable: React.FC<BotComparisonTableProps> = ({
  data,
  isLoading,
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [sortField, setSortField] = useState<SortField>('totalPnL')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  if (isLoading) {
    return (
      <Card title="Bot Performance Details">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="rectangular"
            height={48}
            sx={{ borderRadius: 1, mb: 1 }}
          />
        ))}
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card title="Bot Performance Details">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 120,
            color: 'text.secondary',
          }}
        >
          <Typography variant="body2">No bot data available</Typography>
        </Box>
      </Card>
    )
  }

  const sortedData = [...data].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    switch (sortField) {
      case 'botName':
        return dir * a.botName.localeCompare(b.botName)
      case 'totalPnL':
        return dir * (a.totalPnL - b.totalPnL)
      case 'winRate':
        return dir * (a.winRate - b.winRate)
      case 'totalTrades':
        return dir * (a.totalTrades - b.totalTrades)
      case 'profitFactor':
        return dir * (a.profitFactor - b.profitFactor)
      case 'returnOnCapital':
        return dir * (a.returnOnCapital - b.returnOnCapital)
      default:
        return 0
    }
  })

  const SortHeader: React.FC<{
    field: SortField
    label: string
    align?: 'left' | 'right'
  }> = ({ field, label, align = 'right' }) => (
    <TableCell align={align} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
      <TableSortLabel
        active={sortField === field}
        direction={sortField === field ? sortDir : 'desc'}
        onClick={() => handleSort(field)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  )

  return (
    <Card title="Bot Performance Details">
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <SortHeader field="botName" label="Bot" align="left" />
              {!isMobile && (
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              )}
              <SortHeader field="totalPnL" label="P&L" />
              <SortHeader field="winRate" label="Win Rate" />
              <SortHeader field="totalTrades" label="Trades" />
              {!isMobile && (
                <>
                  <SortHeader field="profitFactor" label="PF" />
                  <SortHeader field="returnOnCapital" label="ROC" />
                </>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedData.map((bot) => (
              <TableRow
                key={bot.botId}
                sx={{
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <TableCell>
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{
                      maxWidth: isMobile ? 100 : 180,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {bot.botName}
                  </Typography>
                </TableCell>
                {!isMobile && (
                  <TableCell>
                    <StatusBadge
                      status={bot.status as any}
                      size="small"
                    />
                  </TableCell>
                )}
                <TableCell align="right">
                  <PnLDisplay
                    amount={bot.totalPnL}
                    showSign
                    size="small"
                    bold
                  />
                </TableCell>
                <TableCell align="right">
                  <Chip
                    label={`${bot.winRate}%`}
                    size="small"
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      height: 24,
                      bgcolor:
                        bot.winRate >= 50
                          ? `${theme.palette.success.main}20`
                          : `${theme.palette.error.main}20`,
                      color:
                        bot.winRate >= 50
                          ? theme.palette.success.main
                          : theme.palette.error.main,
                    }}
                  />
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">
                    {bot.totalTrades}
                    {!isMobile && (
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 0.5 }}
                      >
                        ({bot.winningTrades}W/{bot.losingTrades}L)
                      </Typography>
                    )}
                  </Typography>
                </TableCell>
                {!isMobile && (
                  <>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        color={
                          bot.profitFactor >= 1.5
                            ? 'success.main'
                            : bot.profitFactor >= 1
                              ? 'warning.main'
                              : 'error.main'
                        }
                        fontWeight={500}
                      >
                        {bot.profitFactor >= 999
                          ? '∞'
                          : bot.profitFactor.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        color={
                          bot.returnOnCapital >= 0
                            ? 'success.main'
                            : 'error.main'
                        }
                        fontWeight={500}
                      >
                        {bot.returnOnCapital >= 0 ? '+' : ''}
                        {bot.returnOnCapital.toFixed(2)}%
                      </Typography>
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  )
}
