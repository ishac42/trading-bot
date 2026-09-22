import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { PositionsSummary } from '@/components/positions/PositionsSummary'
import { PositionsTable } from '@/components/positions/PositionsTable'
import { getBookState, setBookScenario } from '@/mocks/bookStore'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
})

beforeEach(() => {
  setBookScenario('empty')
  setBookScenario('normal')
})

function renderPositions() {
  const positions = getBookState().positions
  return render(
    <ThemeProvider theme={createTheme()}>
      <PositionsSummary positions={positions} />
      <PositionsTable positions={positions} onPositionClick={() => {}} />
    </ThemeProvider>
  )
}

describe('Positions', () => {
  it('lists each open row with its bot profile and stop-risk', () => {
    renderPositions()

    expect(screen.getByText('NVDA')).toBeInTheDocument()
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getAllByText('Liquid leaders').length).toBeGreaterThan(0)
    expect(screen.getByText('Open stop-risk')).toBeInTheDocument()
    expect(screen.getByText('$51.16')).toBeInTheDocument()
  })

  it('closes one position and leaves the bot profile in place', () => {
    const view = renderPositions()

    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Close position' }))

    view.rerender(
      <ThemeProvider theme={createTheme()}>
        <PositionsSummary positions={getBookState().positions} />
        <PositionsTable positions={getBookState().positions} onPositionClick={() => {}} />
      </ThemeProvider>
    )

    expect(screen.queryByText('AAPL')).not.toBeInTheDocument()
    expect(screen.getByText('NVDA')).toBeInTheDocument()
    expect(screen.getByText('Liquid leaders')).toBeInTheDocument()
    expect(screen.getByText('$21.76')).toBeInTheDocument()
  })
})
