import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { Button } from './Button'
import { Delete as DeleteIcon } from '@mui/icons-material'

const theme = createTheme()

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
}

describe('Button', () => {
  it('renders with text', () => {
    renderWithTheme(<Button>Click Me</Button>)
    expect(screen.getByText('Click Me')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()
    
    renderWithTheme(<Button onClick={handleClick}>Click Me</Button>)
    
    await user.click(screen.getByText('Click Me'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('renders primary variant', () => {
    renderWithTheme(<Button variant="primary">Primary</Button>)
    expect(screen.getByText('Primary')).toBeInTheDocument()
  })

  it('renders secondary variant', () => {
    renderWithTheme(<Button variant="secondary">Secondary</Button>)
    expect(screen.getByText('Secondary')).toBeInTheDocument()
  })

  it('renders danger variant', () => {
    renderWithTheme(<Button variant="danger">Danger</Button>)
    expect(screen.getByText('Danger')).toBeInTheDocument()
  })

  it('renders text variant', () => {
    renderWithTheme(<Button variant="text">Text</Button>)
    expect(screen.getByText('Text')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    renderWithTheme(<Button loading>Loading</Button>)
    expect(screen.getByText('Loading')).toBeInTheDocument()
    // Should be disabled when loading
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('renders with start icon', () => {
    renderWithTheme(<Button startIcon={<DeleteIcon />}>Delete</Button>)
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('is disabled when disabled prop is true', () => {
    renderWithTheme(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
