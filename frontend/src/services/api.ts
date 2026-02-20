import axios, { AxiosError } from 'axios'
import type { AxiosInstance } from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle common errors
    if (error.response) {
      switch (error.response.status) {
        case 401:
          localStorage.removeItem('auth_token')
          if (window.location.pathname !== '/login') {
            window.location.href = '/login'
          }
          break
        case 403:
          console.error('Forbidden: You do not have permission to access this resource')
          break
        case 404:
          console.error('Not Found: The requested resource was not found')
          break
        case 500:
          console.error('Server Error: Please try again later')
          break
        default:
          console.error('An error occurred:', error.message)
      }
    } else if (error.request) {
      console.error('Network Error: Please check your connection')
    }
    return Promise.reject(error)
  }
)

export default apiClient

// API endpoints (will be expanded as we build features)
export const api = {
  // Auth
  googleLogin: (credential: string) => apiClient.post('/auth/google', { credential }),
  getMe: () => apiClient.get('/auth/me'),

  // Health check
  health: () => apiClient.get('/health'),

  // Bots
  getBots: () => apiClient.get('/bots'),
  getBot: (id: string) => apiClient.get(`/bots/${id}`),
  createBot: (data: any) => apiClient.post('/bots', data),
  updateBot: (id: string, data: any) => apiClient.put(`/bots/${id}`, data),
  deleteBot: (id: string) => apiClient.delete(`/bots/${id}`),
  startBot: (id: string) => apiClient.post(`/bots/${id}/start`),
  stopBot: (id: string) => apiClient.post(`/bots/${id}/stop`),
  pauseBot: (id: string) => apiClient.post(`/bots/${id}/pause`),

  // Trades
  getTrades: (params?: any) => apiClient.get('/trades', { params }),
  getTrade: (id: string) => apiClient.get(`/trades/${id}`),
  getTradeStats: (params?: any) => apiClient.get('/trades/stats', { params }),

  // Positions
  getPositions: (params?: any) => apiClient.get('/positions', { params }),
  getPosition: (id: string) => apiClient.get(`/positions/${id}`),
  closePosition: (id: string, pauseBot: boolean = true) =>
    apiClient.post(`/positions/${id}/close`, null, { params: { pause_bot: pauseBot } }),
  closeUnmanagedPosition: (symbol: string, quantity: number) =>
    apiClient.post('/positions/close-unmanaged', null, { params: { symbol, quantity } }),

  // Market Data
  getMarketStatus: () => apiClient.get('/market-status'),
  getMarketData: (symbol: string) => apiClient.get(`/market-data/${symbol}`),

  // Dashboard Summary
  getSummaryStats: () => apiClient.get('/summary'),

  // Account
  getAccount: () => apiClient.get('/account'),
  reconcile: (limit?: number) => apiClient.get('/account/reconcile', { params: { limit: limit || 100 } }),

  // Unmanaged positions
  getUnmanagedPositions: () => apiClient.get('/positions/unmanaged'),

  // Settings
  getSettings: () => apiClient.get('/settings'),
  updateBrokerSettings: (data: any) => apiClient.put('/settings/broker', data),
  updateNotificationSettings: (data: any) => apiClient.put('/settings/notifications', data),
  updateDisplaySettings: (data: any) => apiClient.put('/settings/display', data),
  testBrokerConnection: () => apiClient.post('/settings/broker/test'),
  exportTradesCsv: () => apiClient.post('/settings/export/trades', null, { responseType: 'blob' }),
  exportPositionsCsv: () => apiClient.post('/settings/export/positions', null, { responseType: 'blob' }),
  clearTradeHistory: () => apiClient.delete('/settings/trades'),
  resetAllSettings: () => apiClient.post('/settings/reset'),
  getDataStats: () => apiClient.get('/settings/data-stats'),
}
