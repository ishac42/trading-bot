import type { Trade } from '@/types'
import { getBotName } from '@/mocks/dashboardData'

/**
 * Convert trades to CSV string
 */
export function tradesToCsv(trades: Trade[]): string {
  const headers = [
    'Trade ID',
    'Timestamp',
    'Symbol',
    'Type',
    'Quantity',
    'Price',
    'Bot',
    'Status',
    'P&L',
    'Commission',
    'Order ID',
  ]

  const rows = trades.map((trade) => [
    trade.id,
    new Date(trade.timestamp).toLocaleString(),
    trade.symbol,
    trade.type.toUpperCase(),
    trade.quantity.toString(),
    trade.price.toFixed(2),
    getBotName(trade.bot_id),
    trade.status,
    trade.profit_loss !== undefined ? trade.profit_loss.toFixed(2) : '',
    trade.commission !== undefined ? trade.commission.toFixed(2) : '',
    trade.order_id || '',
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n')

  return csvContent
}

/**
 * Download a CSV string as a file
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export trades as a CSV file download
 */
export function exportTradesToCsv(trades: Trade[], filename?: string): void {
  const csv = tradesToCsv(trades)
  const defaultFilename = `trades_${new Date().toISOString().split('T')[0]}.csv`
  downloadCsv(csv, filename || defaultFilename)
}
