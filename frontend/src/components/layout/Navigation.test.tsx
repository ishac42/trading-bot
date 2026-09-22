import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import Navigation from './Navigation'

describe('Navigation', () => {
  it('shows Bots and Settings in the primary tabs', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <Navigation />
        </MemoryRouter>
      </ThemeProvider>
    )

    expect(screen.getByRole('tab', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Bots' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Positions' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Trades' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Analytics' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Theme Preview' })).not.toBeInTheDocument()
  })
})
