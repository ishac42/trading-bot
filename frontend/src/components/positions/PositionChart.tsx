import { Box, Typography } from '@mui/material'
import type { Position } from '@/types'

interface PositionChartProps {
  position: Position
}

export const PositionChart: React.FC<PositionChartProps> = ({ position }) => {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Price Chart
      </Typography>
      <Typography variant="body2" color="text.secondary">
        No price history for {position.symbol} yet.
      </Typography>
    </Box>
  )
}
