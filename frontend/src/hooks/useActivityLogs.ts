import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { ActivityLogEntry, ActivityLogPagination } from '@/types'

interface ActivityLogResponse {
  logs: ActivityLogEntry[]
  pagination: ActivityLogPagination
}

interface UseActivityLogsParams {
  level?: string
  category?: string
  botId?: string
  dateRange?: string
  search?: string
  page?: number
  pageSize?: number
}

export function useActivityLogs(params: UseActivityLogsParams = {}) {
  const { level = '', category = '', botId = '', dateRange = 'all', search = '', page = 1, pageSize = 50 } = params

  return useQuery<ActivityLogResponse>({
    queryKey: ['activity-logs', level, category, botId, dateRange, search, page, pageSize],
    queryFn: async () => {
      const { data } = await api.getActivityLogs({
        level,
        category,
        botId,
        dateRange,
        search,
        page,
        pageSize,
      })
      return data
    },
    placeholderData: keepPreviousData,
    refetchInterval: 15000,
  })
}
