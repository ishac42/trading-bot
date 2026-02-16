/**
 * Currency and formatting utilities
 */

/**
 * Format a number as currency
 * @param amount - The amount to format
 * @param currency - Currency symbol (default: '$')
 * @param showSign - Whether to show + sign for positive values
 * @returns Formatted currency string (e.g., "$1,234.56" or "+$1,234.56")
 */
export function formatCurrency(
  amount: number,
  currency: string = '$',
  showSign: boolean = false
): string {
  const sign = showSign && amount > 0 ? '+' : ''
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))

  return `${sign}${currency}${formatted}`
}

/**
 * Format a number as percentage
 * @param percentage - The percentage value (e.g., 2.5 for 2.5%)
 * @param showSign - Whether to show + sign for positive values
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted percentage string (e.g., "+2.50%" or "-0.90%")
 */
export function formatPercentage(
  percentage: number,
  showSign: boolean = true,
  decimals: number = 2
): string {
  if (percentage === 0) {
    return showSign ? '+0.00%' : '0.00%'
  }
  const sign = showSign ? (percentage > 0 ? '+' : '-') : ''
  const formatted = Math.abs(percentage).toFixed(decimals)
  return `${sign}${formatted}%`
}

/**
 * Format an ISO timestamp to a human-readable time string
 * @param timestamp - ISO date string
 * @returns Formatted time string (e.g., "10:23 AM")
 */
export function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Format an ISO timestamp to a relative time string
 * @param timestamp - ISO date string
 * @returns Relative time string (e.g., "2 min ago", "1h ago", "Yesterday 10:23 AM")
 */
export function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / (1000 * 60))
  const diffHr = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`

  const isYesterday =
    now.getDate() - date.getDate() === 1 &&
    now.getMonth() === date.getMonth() &&
    now.getFullYear() === date.getFullYear()

  if (isYesterday) return `Yesterday ${formatTime(timestamp)}`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Format a number with compact notation for large values
 * @param value - Number to format
 * @returns Compact formatted string (e.g., "$12.3K")
 */
export function formatCompactCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`
  }
  return formatCurrency(value)
}

/**
 * Format indicator names for display
 */
export function formatIndicators(indicators: Record<string, any>): string {
  return Object.keys(indicators).join(', ')
}

/**
 * Get a trading window string from start/end hours and minutes
 */
export function formatTradingWindow(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number
): string {
  const formatTimePart = (hour: number, minute: number) => {
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
  }
  return `${formatTimePart(startHour, startMinute)} - ${formatTimePart(endHour, endMinute)} EST`
}
