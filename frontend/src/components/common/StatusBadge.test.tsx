import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { StatusBadge } from './StatusBadge'

const theme = createTheme()

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
}

describe('StatusBadge', () => {
  it('renders with running status', () => {
    renderWithTheme(<StatusBadge status="running" />)
    expect(screen.getByText('Running')).toBeInTheDocument()
  })

  it('renders with paused status', () => {
    renderWithTheme(<StatusBadge status="paused" />)
    expect(screen.getByText('Paused')).toBeInTheDocument()
  })

  it('renders with stopped status', () => {
    renderWithTheme(<StatusBadge status="stopped" />)
    expect(screen.getByText('Stopped')).toBeInTheDocument()
  })

  it('renders with error status', () => {
    renderWithTheme(<StatusBadge status="error" />)
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('hides label when showLabel is false', () => {
    renderWithTheme(<StatusBadge status="running" showLabel={false} />)
    expect(screen.queryByText('Running')).not.toBeInTheDocument()
  })

  it('renders dot variant', () => {
    renderWithTheme(<StatusBadge status="running" variant="dot" />)
    const statusElement = screen.getByRole('status')
    expect(statusElement).toBeInTheDocument()
  })

  it('renders chip variant', () => {
    renderWithTheme(<StatusBadge status="running" variant="chip" />)
    expect(screen.getByText('Running')).toBeInTheDocument()
  })

  it('renders badge variant (default)', () => {
    renderWithTheme(<StatusBadge status="running" variant="badge" />)
    expect(screen.getByText('Running')).toBeInTheDocument()
  })

  it('has correct ARIA label', () => {
    renderWithTheme(<StatusBadge status="running" />)
    const statusElement = screen.getByRole('status')
    expect(statusElement).toHaveAttribute('aria-label', 'Status: Running')
  })
})
