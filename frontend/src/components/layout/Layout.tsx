import { useEffect, useState, type ReactNode } from 'react'
import { Alert, Box, Container } from '@mui/material'
import { loadBookControl } from '@/services/bookControl'
import { loadBotProfiles } from '@/services/botProfiles'
import TopBar from './TopBar'
import Navigation from './Navigation'

interface LayoutProps {
  children: ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([loadBotProfiles(), loadBookControl()]).then(([bots, book]) => {
      if (cancelled) return
      if (!bots.ok) setLoadError(bots.message)
      else if (!book.ok) setLoadError(book.message)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopBar />
      <Navigation />
      {loadError && (
        <Container maxWidth="xl" sx={{ pt: 2 }}>
          <Alert severity="error">{loadError}</Alert>
        </Container>
      )}
      <Container
        maxWidth="xl"
        sx={{
          flex: 1,
          py: { xs: 2, sm: 3 },
          px: { xs: 1, sm: 2, md: 3 },
          width: '100%',
        }}
      >
        {children}
      </Container>
    </Box>
  )
}

export default Layout
