import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import type {
  AllSettings,
  BrokerSettings,
  NotificationSettings,
  DisplaySettings,
  BrokerTestResult,
  DataStats,
} from '@/types'

export function useSettings() {
  const queryClient = useQueryClient()

  const settingsQuery = useQuery<AllSettings>({
    queryKey: ['settings'],
    queryFn: async () => (await api.getSettings()).data,
  })

  const dataStatsQuery = useQuery<DataStats>({
    queryKey: ['data-stats'],
    queryFn: async () => (await api.getDataStats()).data,
  })

  const updateBroker = useMutation({
    mutationFn: async (data: Partial<BrokerSettings>) => (await api.updateBrokerSettings(data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  })

  const updateNotifications = useMutation({
    mutationFn: async (data: NotificationSettings) => (await api.updateNotificationSettings(data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  })

  const updateDisplay = useMutation({
    mutationFn: async (data: DisplaySettings) => (await api.updateDisplaySettings(data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  })

  const testBroker = useMutation<BrokerTestResult>({
    mutationFn: async () => (await api.testBrokerConnection()).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  })

  const exportTrades = useMutation({
    mutationFn: async () => {
      const response = await api.exportTradesCsv()
      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'trades_export.csv'
      a.click()
      window.URL.revokeObjectURL(url)
    },
  })

  const exportPositions = useMutation({
    mutationFn: async () => {
      const response = await api.exportPositionsCsv()
      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'positions_export.csv'
      a.click()
      window.URL.revokeObjectURL(url)
    },
  })

  const clearTrades = useMutation({
    mutationFn: async () => (await api.clearTradeHistory()).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-stats'] })
      queryClient.invalidateQueries({ queryKey: ['trades'] })
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      queryClient.invalidateQueries({ queryKey: ['account'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
    },
  })

  const resetSettings = useMutation({
    mutationFn: async () => (await api.resetAllSettings()).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  })

  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    dataStats: dataStatsQuery.data,
    isLoadingStats: dataStatsQuery.isLoading,
    updateBroker,
    updateNotifications,
    updateDisplay,
    testBroker,
    exportTrades,
    exportPositions,
    clearTrades,
    resetSettings,
  }
}
