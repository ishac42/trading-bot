import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { Modal } from './Modal'
import { Button } from './Button'

const theme = createTheme()

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
}

describe('Modal', () => {
  it('renders when open', () => {
    renderWithTheme(
      <Modal open onClose={vi.fn()}>
        Modal Content
      </Modal>
    )
    expect(screen.getByText('Modal Content')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    renderWithTheme(
      <Modal open={false} onClose={vi.fn()}>
        Modal Content
      </Modal>
    )
    expect(screen.queryByText('Modal Content')).not.toBeInTheDocument()
  })

  it('renders with title', () => {
    renderWithTheme(
      <Modal open onClose={vi.fn()} title="Test Title">
        Content
      </Modal>
    )
    expect(screen.getByText('Test Title')).toBeInTheDocument()
  })

  it('renders with actions', () => {
    renderWithTheme(
      <Modal
        open
        onClose={vi.fn()}
        actions={<Button>Confirm</Button>}
      >
        Content
      </Modal>
    )
    expect(screen.getByText('Confirm')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const handleClose = vi.fn()
    const user = userEvent.setup()
    
    renderWithTheme(
      <Modal open onClose={handleClose} title="Test">
        Content
      </Modal>
    )
    
    const closeButton = screen.getByLabelText('close')
    await user.click(closeButton)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})
