import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { Bot, BotFormData } from '@/types'
import { mockBots } from '@/mocks/dashboardData'

const USE_MOCK = false // Toggle to false when backend is available

/**
 * Hook to fetch all bots
 */
export const useBots = () => {
  return useQuery<Bot[]>({
    queryKey: ['bots'],
    queryFn: async () => {
      if (USE_MOCK) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        return mockBots
      }
      const response = await api.getBots()
      return response.data
    },
    staleTime: 1000 * 30,
  })
}

/**
 * Hook to fetch a single bot by ID
 */
export const useBot = (botId: string | undefined) => {
  return useQuery<Bot>({
    queryKey: ['bot', botId],
    enabled: !!botId,
    queryFn: async () => {
      if (USE_MOCK) {
        await new Promise((resolve) => setTimeout(resolve, 300))
        const bot = mockBots.find((b) => b.id === botId)
        if (!bot) throw new Error('Bot not found')
        return bot
      }
      const response = await api.getBot(botId!)
      return response.data
    },
    staleTime: 1000 * 30,
  })
}

/**
 * Hook to fetch active bots only (running + paused)
 */
export const useActiveBots = () => {
  const query = useBots()
  const activeBots = query.data?.filter(
    (bot) => bot.status === 'running' || bot.status === 'paused'
  )
  return {
    ...query,
    data: activeBots,
  }
}

/**
 * Hook to create a new bot
 */
export const useCreateBot = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: BotFormData) => {
      if (USE_MOCK) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        const newBot: Bot = {
          id: `bot-${Date.now()}`,
          ...data,
          status: 'stopped',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_active: false,
          error_count: 0,
        }
        // Add to mock data (won't persist across page refreshes)
        mockBots.push(newBot)
        return newBot
      }
      const response = await api.createBot(data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      queryClient.invalidateQueries({ queryKey: ['summaryStats'] })
    },
  })
}

/**
 * Hook to update an existing bot
 */
export const useUpdateBot = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: BotFormData }) => {
      if (USE_MOCK) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        const idx = mockBots.findIndex((b) => b.id === id)
        if (idx === -1) throw new Error('Bot not found')
        mockBots[idx] = {
          ...mockBots[idx],
          ...data,
          updated_at: new Date().toISOString(),
        }
        return mockBots[idx]
      }
      const response = await api.updateBot(id, data)
      return response.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      queryClient.invalidateQueries({ queryKey: ['bot', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['summaryStats'] })
    },
  })
}

/**
 * Hook to delete a bot
 */
export const useDeleteBot = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (botId: string) => {
      if (USE_MOCK) {
        await new Promise((resolve) => setTimeout(resolve, 400))
        const idx = mockBots.findIndex((b) => b.id === botId)
        if (idx !== -1) mockBots.splice(idx, 1)
        return { success: true }
      }
      const response = await api.deleteBot(botId)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      queryClient.invalidateQueries({ queryKey: ['summaryStats'] })
    },
  })
}

/**
 * Hook to start a bot
 */
export const useStartBot = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (botId: string) => {
      if (USE_MOCK) {
        await new Promise((resolve) => setTimeout(resolve, 300))
        const bot = mockBots.find((b) => b.id === botId)
        if (bot) {
          bot.status = 'running'
          bot.is_active = true
        }
        return { success: true }
      }
      const response = await api.startBot(botId)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      queryClient.invalidateQueries({ queryKey: ['summaryStats'] })
    },
  })
}

/**
 * Hook to stop a bot
 */
export const useStopBot = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (botId: string) => {
      if (USE_MOCK) {
        await new Promise((resolve) => setTimeout(resolve, 300))
        const bot = mockBots.find((b) => b.id === botId)
        if (bot) {
          bot.status = 'stopped'
          bot.is_active = false
        }
        return { success: true }
      }
      const response = await api.stopBot(botId)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      queryClient.invalidateQueries({ queryKey: ['summaryStats'] })
    },
  })
}

/**
 * Hook to pause a bot
 */
export const usePauseBot = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (botId: string) => {
      if (USE_MOCK) {
        await new Promise((resolve) => setTimeout(resolve, 300))
        const bot = mockBots.find((b) => b.id === botId)
        if (bot) {
          bot.status = 'paused'
        }
        return { success: true }
      }
      const response = await api.pauseBot(botId)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] })
      queryClient.invalidateQueries({ queryKey: ['summaryStats'] })
    },
  })
}
