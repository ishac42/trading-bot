import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { queryClient } from '@/utils/queryClient'
import { ThemeProvider, useThemeContext } from '@/contexts/ThemeContext'
import ErrorBoundary from '@/components/ErrorBoundary'
import Layout from '@/components/layout/Layout'
import Dashboard from '@/pages/Dashboard'
import Bots from '@/pages/Bots'
import CreateBot from '@/pages/CreateBot'
import EditBot from '@/pages/EditBot'
import Positions from '@/pages/Positions'
import Trades from '@/pages/Trades'
import Analytics from '@/pages/Analytics'
import ThemePreview from '@/pages/ThemePreview'

function AppContent() {
  const { theme } = useThemeContext()

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/bots" element={<Bots />} />
            <Route path="/bots/create" element={<CreateBot />} />
            <Route path="/bots/:botId/edit" element={<EditBot />} />
            <Route path="/positions" element={<Positions />} />
            <Route path="/trades" element={<Trades />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/theme-preview" element={<ThemePreview />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </MuiThemeProvider>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
