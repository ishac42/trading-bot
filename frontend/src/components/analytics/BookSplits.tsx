import React from 'react'
import { Box, Grid, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { Card, PnLDisplay } from '@/components/common'
import type { BookSplitRow } from '@/utils/bookAnalytics'

const SplitTable: React.FC<{ title: string; label: string; rows: BookSplitRow[] }> = ({
  title,
  label,
  rows,
}) => (
  <Card title={title}>
    {rows.length === 0 ? (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        No trades in this range.
      </Typography>
    ) : (
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>{label}</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>Trades</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>Expectancy</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>P&L</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.name}>
              <TableCell>{row.name}</TableCell>
              <TableCell align="right">{row.trades}</TableCell>
              <TableCell align="right">
                <PnLDisplay amount={row.expectancy} showSign size="small" />
              </TableCell>
              <TableCell align="right">
                <PnLDisplay amount={row.pnl} showSign size="small" bold />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )}
  </Card>
)

interface BookSplitsProps {
  byRegime: BookSplitRow[]
  bySession: BookSplitRow[]
  byBot: BookSplitRow[]
}

export const BookSplits: React.FC<BookSplitsProps> = ({ byRegime, bySession, byBot }) => (
  <Box>
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <SplitTable title="By regime" label="Regime" rows={byRegime} />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <SplitTable title="By session" label="Session" rows={bySession} />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <SplitTable title="By bot" label="Bot" rows={byBot} />
      </Grid>
    </Grid>
  </Box>
)
