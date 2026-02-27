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
  TablePagination,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  IconButton,
  Collapse,
  Skeleton,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { useQueryClient } from '@tanstack/react-query'
import { useActivityLogs } from '@/hooks/useActivityLogs'
import { useBots } from '@/hooks/useBots'
import { EmptyState } from '@/components/common'

const levelColors: Record<string, 'default' | 'info' | 'warning' | 'error' | 'success'> = {
  debug: 'default',
  info: 'info',
  warning: 'warning',
  error: 'error',
}

const categoryColors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
  trade: 'success',
  bot: 'primary',
  auth: 'info',
  system: 'default',
  risk: 'warning',
  error: 'error',
}

const ActivityLogPanel = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const queryClient = useQueryClient()

  const [level, setLevel] = useState('')
  const [category, setCategory] = useState('')
  const [botId, setBotId] = useState('')
  const [dateRange, setDateRange] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const { data, isLoading } = useActivityLogs({
    level,
    category,
    botId,
    dateRange,
    search,
    page,
    pageSize,
  })

  const { data: bots } = useBots()

  const getBotName = useCallback(
    (id: string) => bots?.find((b) => b.id === id)?.name || id.slice(0, 8),
    [bots]
  )

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['activity-logs'] })
  }

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage + 1)
  }

  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageSize(parseInt(e.target.value, 10))
    setPage(1)
  }

  const toggleExpand = (id: string) => {
    setExpandedRow((prev) => (prev === id ? null : id))
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Activity Log
        </Typography>
        <IconButton onClick={handleRefresh} size="small" title="Refresh">
          <RefreshIcon />
        </IconButton>
      </Box>

      {/* Filters */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          mb: 2,
        }}
      >
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>Level</InputLabel>
          <Select value={level} label="Level" onChange={(e) => { setLevel(e.target.value); setPage(1) }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="debug">Debug</MenuItem>
            <MenuItem value="info">Info</MenuItem>
            <MenuItem value="warning">Warning</MenuItem>
            <MenuItem value="error">Error</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel>Category</InputLabel>
          <Select value={category} label="Category" onChange={(e) => { setCategory(e.target.value); setPage(1) }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="trade">Trade</MenuItem>
            <MenuItem value="bot">Bot</MenuItem>
            <MenuItem value="auth">Auth</MenuItem>
            <MenuItem value="system">System</MenuItem>
            <MenuItem value="risk">Risk</MenuItem>
            <MenuItem value="error">Error</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel>Bot</InputLabel>
          <Select value={botId} label="Bot" onChange={(e) => { setBotId(e.target.value); setPage(1) }}>
            <MenuItem value="">All Bots</MenuItem>
            {bots?.map((b) => (
              <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>Date</InputLabel>
          <Select value={dateRange} label="Date" onChange={(e) => { setDateRange(e.target.value); setPage(1) }}>
            <MenuItem value="all">All Time</MenuItem>
            <MenuItem value="today">Today</MenuItem>
            <MenuItem value="week">This Week</MenuItem>
            <MenuItem value="month">This Month</MenuItem>
          </Select>
        </FormControl>

        <TextField
          size="small"
          placeholder="Search..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          sx={{ minWidth: 140 }}
        />
      </Box>

      {/* Table */}
      {isLoading ? (
        <Box>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={40} sx={{ mb: 0.5 }} />
          ))}
        </Box>
      ) : !data?.logs?.length ? (
        <EmptyState
          title="No activity logs"
          message="Activity will appear here as your bots trade and system events occur"
          variant="empty-search"
          sx={{ minHeight: 200 }}
        />
      ) : (
        <>
          <TableContainer sx={{ maxHeight: isMobile ? 400 : 520 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, width: 30 }} />
                  <TableCell sx={{ fontWeight: 600, minWidth: 130 }}>Time</TableCell>
                  <TableCell sx={{ fontWeight: 600, minWidth: 70 }}>Level</TableCell>
                  <TableCell sx={{ fontWeight: 600, minWidth: 80 }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Message</TableCell>
                  <TableCell sx={{ fontWeight: 600, minWidth: 80 }}>Bot</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <TableRow
                      hover
                      onClick={() => log.details && toggleExpand(log.id)}
                      sx={{
                        cursor: log.details ? 'pointer' : 'default',
                        '&:last-child td': { border: 0 },
                      }}
                    >
                      <TableCell sx={{ p: 0.5 }}>
                        {log.details && (
                          <IconButton size="small" sx={{ p: 0.25 }}>
                            {expandedRow === log.id ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                          </IconButton>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                          {new Date(log.timestamp).toLocaleDateString()}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.level.toUpperCase()}
                          size="small"
                          color={levelColors[log.level] || 'default'}
                          sx={{ fontWeight: 600, fontSize: '0.65rem', height: 20 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.category}
                          size="small"
                          color={categoryColors[log.category] || 'default'}
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: 20 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.8rem', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.message}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                          {log.bot_id ? getBotName(log.bot_id) : '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    {log.details && (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ py: 0, border: 0 }}>
                          <Collapse in={expandedRow === log.id} timeout="auto" unmountOnExit>
                            <Box sx={{ py: 1.5, px: 2, bgcolor: 'action.hover', borderRadius: 1, my: 0.5 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                                {JSON.stringify(log.details, null, 2)}
                              </Typography>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={data.pagination.totalItems}
            page={data.pagination.page - 1}
            rowsPerPage={data.pagination.pageSize}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
        </>
      )}
    </Box>
  )
}

export default ActivityLogPanel
