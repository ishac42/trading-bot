import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { Card } from './Card'
import { Button } from './Button'

const theme = createTheme()

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
}

describe('Card', () => {
  it('renders children', () => {
    renderWithTheme(<Card>Test Content</Card>)
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('renders with title', () => {
    renderWithTheme(<Card title="Test Title">Content</Card>)
    expect(screen.getByText('Test Title')).toBeInTheDocument()
  })

  it('renders with actions', () => {
    renderWithTheme(
      <Card actions={<Button>Action</Button>}>Content</Card>
    )
    expect(screen.getByText('Action')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()
    
    renderWithTheme(
      <Card onClick={handleClick}>Clickable Card</Card>
    )
    
    await user.click(screen.getByText('Clickable Card'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('renders outlined variant', () => {
    renderWithTheme(<Card variant="outlined">Content</Card>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('renders elevated variant', () => {
    renderWithTheme(<Card variant="elevated">Content</Card>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('renders flat variant', () => {
    renderWithTheme(<Card variant="flat">Content</Card>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })
})
