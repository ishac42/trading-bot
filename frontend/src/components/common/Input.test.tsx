import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { Input } from './Input'

const theme = createTheme()

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
}

describe('Input', () => {
  it('renders with label', () => {
    renderWithTheme(<Input label="Test Label" />)
    expect(screen.getByLabelText('Test Label')).toBeInTheDocument()
  })

  it('shows required indicator', () => {
    renderWithTheme(<Input label="Required Field" required />)
    // MUI automatically adds asterisk when required=true
    const input = screen.getByLabelText(/Required Field/)
    expect(input).toHaveAttribute('required')
  })

  it('shows error state', () => {
    renderWithTheme(
      <Input label="Test" error helperText="Error message" />
    )
    expect(screen.getByText('Error message')).toBeInTheDocument()
  })

  it('renders with value', () => {
    renderWithTheme(<Input label="Test" value="Test Value" />)
    expect(screen.getByDisplayValue('Test Value')).toBeInTheDocument()
  })

  it('hides required indicator when showRequiredIndicator is false', () => {
    renderWithTheme(
      <Input label="Test" required showRequiredIndicator={false} />
    )
    // When showRequiredIndicator is false, required should not be set on TextField
    const input = screen.getByLabelText(/Test/)
    expect(input).not.toHaveAttribute('required')
  })
})
