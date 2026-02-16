import React, { useState, useMemo } from 'react'
import { Box, Typography, Alert } from '@mui/material'
import {
  PositionsSummary,
  PositionFilters,
  PositionsTable,
  PositionDetail,
} from '@/components/positions'
import type { PositionFilterValues } from '@/components/positions'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { EmptyState } from '@/components/common/EmptyState'
import { usePositions, useClosePosition } from '@/hooks/usePositions'
import { useRealtimePositions } from '@/hooks/useRealtimePositions'
import { useBots } from '@/hooks/useBots'
import type { Position } from '@/types'

/**
 * Positions Page
 *
 * Displays all open positions with:
 * - Summary bar (total positions, value, unrealized P&L)
 * - Filters (by bot, symbol, sort)
 * - Responsive table (desktop) / cards (mobile)
 * - Position detail modal with chart
 * - Real-time updates via WebSocket
 */
const Positions: React.FC = () => {
  // Filters state
  const [filters, setFilters] = useState<PositionFilterValues>({
    botId: '',
    symbol: '',
    sortBy: '',
  })

  // Selected position for detail modal
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(
    null
  )
  const [detailOpen, setDetailOpen] = useState(false)

  // Parse sort filter value into field + order
  const parsedSort = useMemo(() => {
    if (!filters.sortBy) return null
    const parts = filters.sortBy.split('_')
    const order = parts.pop() as 'asc' | 'desc'
    const field = parts.join('_')
    return { field, order }
  }, [filters.sortBy])

  // Fetch data
  const {
    data: positions,
    isLoading,
    isError,
    error,
  } = usePositions({
    botId: filters.botId || undefined,
    symbol: filters.symbol || undefined,
    sortBy: parsedSort?.field as any,
    sortOrder: parsedSort?.order,
  })

  const { data: bots } = useBots()
  const closePositionMutation = useClosePosition()

  // Subscribe to real-time updates
  useRealtimePositions()

  // Derive available filter options from positions data
  const availableBots = useMemo(() => {
    if (!bots) return []
    // Only include bots that have positions
    const botIdsWithPositions = new Set(
      positions?.map((p) => p.bot_id) || []
    )
    return bots
      .filter(
        (bot) =>
          botIdsWithPositions.has(bot.id) ||
          bot.status === 'running' ||
          bot.status === 'paused'
      )
      .map((bot) => ({ id: bot.id, name: bot.name }))
  }, [bots, positions])

  const availableSymbols = useMemo(() => {
    if (!positions) return []
    return [...new Set(positions.map((p) => p.symbol))].sort()
  }, [positions])

  // Handlers
  const handlePositionClick = (position: Position) => {
    setSelectedPosition(position)
    setDetailOpen(true)
  }

  const handleClosePosition = (positionId: string) => {
    closePositionMutation.mutate(positionId, {
      onSuccess: () => {
        setDetailOpen(false)
        setSelectedPosition(null)
      },
    })
  }

  const handleDetailClose = () => {
    setDetailOpen(false)
    setSelectedPosition(null)
  }

  // Loading state
  if (isLoading) {
    return (
      <Box>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            mb: { xs: 2, sm: 3 },
            fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' },
            fontWeight: 'bold',
          }}
        >
          Positions
        </Typography>
        <LoadingSpinner text="Loading positions..." />
      </Box>
    )
  }

  // Error state
  if (isError) {
    return (
      <Box>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            mb: { xs: 2, sm: 3 },
            fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' },
            fontWeight: 'bold',
          }}
        >
          Positions
        </Typography>
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load positions:{' '}
          {error instanceof Error ? error.message : 'Unknown error'}
        </Alert>
      </Box>
    )
  }

  const positionsList = positions || []

  return (
    <Box>
      {/* Page header */}
      <Typography
        variant="h4"
        component="h1"
        sx={{
          mb: { xs: 2, sm: 3 },
          fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' },
          fontWeight: 'bold',
        }}
      >
        Positions
      </Typography>

      {/* Summary cards */}
      <PositionsSummary positions={positionsList} />

      {/* Filters */}
      <PositionFilters
        filters={filters}
        onFilterChange={setFilters}
        availableBots={availableBots}
        availableSymbols={availableSymbols}
      />

      {/* Positions table or empty state */}
      {positionsList.length === 0 ? (
        <EmptyState
          title="No Open Positions"
          message={
            filters.botId || filters.symbol
              ? 'No positions match your current filters. Try adjusting the filters.'
              : 'There are no open positions right now. Positions will appear here when your bots open trades.'
          }
          variant={
            filters.botId || filters.symbol ? 'empty-search' : 'no-data'
          }
        />
      ) : (
        <PositionsTable
          positions={positionsList}
          onPositionClick={handlePositionClick}
          externalSort={parsedSort}
        />
      )}

      {/* Position detail modal */}
      <PositionDetail
        position={selectedPosition}
        open={detailOpen}
        onClose={handleDetailClose}
        onClosePosition={handleClosePosition}
        isClosing={closePositionMutation.isPending}
      />
    </Box>
  )
}

export default Positions
