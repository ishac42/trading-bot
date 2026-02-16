import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { PnLDisplay } from './PnLDisplay'

const theme = createTheme()

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
}

describe('PnLDisplay', () => {
  it('renders positive amount', () => {
    renderWithTheme(<PnLDisplay amount={1234.56} />)
    expect(screen.getByText('$1,234.56')).toBeInTheDocument()
  })

  it('renders negative amount', () => {
    renderWithTheme(<PnLDisplay amount={-45.23} />)
    expect(screen.getByText('$45.23')).toBeInTheDocument()
  })

  it('renders zero amount', () => {
    renderWithTheme(<PnLDisplay amount={0} />)
    expect(screen.getByText('$0.00')).toBeInTheDocument()
  })

  it('renders with percentage', () => {
    renderWithTheme(<PnLDisplay amount={1234.56} percentage={2.5} />)
    expect(screen.getByText('$1,234.56')).toBeInTheDocument()
    // Percentage text is split across elements, use regex to match
    expect(screen.getByText(/2\.50%/)).toBeInTheDocument()
  })

  it('renders with negative percentage', () => {
    renderWithTheme(<PnLDisplay amount={-45.23} percentage={-0.9} />)
    expect(screen.getByText('$45.23')).toBeInTheDocument()
    // Percentage text is split across elements, use regex to match
    expect(screen.getByText(/0\.90%/)).toBeInTheDocument()
  })

  it('shows sign when showSign is true', () => {
    renderWithTheme(<PnLDisplay amount={1234.56} showSign />)
    expect(screen.getByText('+$1,234.56')).toBeInTheDocument()
  })

  it('renders with different sizes', () => {
    const { rerender } = renderWithTheme(<PnLDisplay amount={100} size="small" />)
    expect(screen.getByText('$100.00')).toBeInTheDocument()

    rerender(
      <ThemeProvider theme={theme}>
        <PnLDisplay amount={100} size="large" />
      </ThemeProvider>
    )
    expect(screen.getByText('$100.00')).toBeInTheDocument()
  })
})
