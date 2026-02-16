import type { ReactNode } from 'react'
import { Box, Container } from '@mui/material'
import TopBar from './TopBar'
import Navigation from './Navigation'

interface LayoutProps {
  children: ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopBar />
      <Navigation />
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
