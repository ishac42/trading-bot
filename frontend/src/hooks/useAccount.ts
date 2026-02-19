import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import type { AccountInfo } from '@/types'

/**
 * Hook to fetch Alpaca account info with capital allocation data.
 */
export const useAccount = () => {
  return useQuery<AccountInfo>({
    queryKey: ['account'],
    queryFn: async () => {
      const response = await api.getAccount()
      return response.data
    },
    staleTime: 1000 * 30,
  })
}
