import React, { useMemo, useState } from 'react'
import { Box, Typography } from '@mui/material'
import {
  PositionsSummary,
  PositionFilters,
  PositionsTable,
  PositionDetail,
} from '@/components/positions'
import type { PositionFilterValues } from '@/components/positions'
import { EmptyState } from '@/components/common/EmptyState'
import { useBook } from '@/hooks/useBook'
import { closeBookPosition } from '@/mocks/bookStore'
import type { Position } from '@/types'

const Positions: React.FC = () => {
  const { positions, bots } = useBook()
  const [filters, setFilters] = useState<PositionFilterValues>({
    botId: '',
    symbol: '',
    sortBy: '',
  })
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  const availableBots = useMemo(
    () => bots.map((bot) => ({ id: bot.id, name: bot.name })),
    [bots]
  )

  const availableSymbols = useMemo(
    () => [...new Set(positions.map((position) => position.symbol))].sort(),
    [positions]
  )

  const externalSort = useMemo(() => {
    if (!filters.sortBy) return null
    const match = filters.sortBy.match(/^(.*)_(asc|desc)$/)
    if (!match) return null
    return { field: match[1], order: match[2] }
  }, [filters.sortBy])

  const visible = useMemo(() => {
    const filtered = positions.filter((position) => {
      if (filters.botId && position.bot_id !== filters.botId) return false
      if (filters.symbol && position.symbol !== filters.symbol) return false
      return true
    })
    if (!filters.sortBy) return filtered
    const [field, order] = filters.sortBy.split(/_(asc|desc)$/)
    const direction = order === 'asc' ? 1 : -1
    return [...filtered].sort((left, right) => {
      const a = left[field as keyof Position]
      const b = right[field as keyof Position]
      if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b) * direction
      return ((Number(a) || 0) - (Number(b) || 0)) * direction
    })
  }, [positions, filters])

  const handleClosePosition = (positionId: string) => {
    setIsClosing(true)
    closeBookPosition(positionId)
    setIsClosing(false)
    setDetailOpen(false)
    setSelectedPosition(null)
  }

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

      <PositionsSummary positions={visible} />

      <PositionFilters
        filters={filters}
        onFilterChange={setFilters}
        availableBots={availableBots}
        availableSymbols={availableSymbols}
      />

      {visible.length === 0 ? (
        <EmptyState
          title="No open positions"
          message={
            filters.botId || filters.symbol
              ? 'No positions match these filters.'
              : 'The book is flat. Positions appear here when a bot is filled.'
          }
          variant={filters.botId || filters.symbol ? 'empty-search' : 'no-data'}
        />
      ) : (
        <PositionsTable
          positions={visible}
          externalSort={externalSort}
          onPositionClick={(position) => {
            setSelectedPosition(position)
            setDetailOpen(true)
          }}
        />
      )}

      <PositionDetail
        position={selectedPosition}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false)
          setSelectedPosition(null)
        }}
        onClosePosition={handleClosePosition}
        isClosing={isClosing}
      />
    </Box>
  )
}

export default Positions
