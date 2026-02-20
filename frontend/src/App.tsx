import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { queryClient } from '@/utils/queryClient'
import { ThemeProvider, useThemeContext } from '@/contexts/ThemeContext'
import { AuthProvider } from '@/contexts/AuthContext'
import ErrorBoundary from '@/components/ErrorBoundary'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Layout from '@/components/layout/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Bots from '@/pages/Bots'
import CreateBot from '@/pages/CreateBot'
import EditBot from '@/pages/EditBot'
import Positions from '@/pages/Positions'
import Trades from '@/pages/Trades'
import Analytics from '@/pages/Analytics'
import Settings from '@/pages/Settings'
import ThemePreview from '@/pages/ThemePreview'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

function AppContent() {
  const { theme } = useThemeContext()

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/bots" element={<Bots />} />
                    <Route path="/bots/create" element={<CreateBot />} />
                    <Route path="/bots/:botId/edit" element={<EditBot />} />
                    <Route path="/positions" element={<Positions />} />
                    <Route path="/trades" element={<Trades />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/theme-preview" element={<ThemePreview />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </MuiThemeProvider>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          <AuthProvider>
            <ThemeProvider>
              <AppContent />
            </ThemeProvider>
          </AuthProvider>
        </GoogleOAuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
