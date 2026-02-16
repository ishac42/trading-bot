import { describe, it, expect } from 'vitest'
import { formatCurrency, formatPercentage } from './formatters'

describe('formatters', () => {
  describe('formatCurrency', () => {
    it('formats positive amount', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56')
    })

    it('formats negative amount', () => {
      expect(formatCurrency(-45.23)).toBe('$45.23')
    })

    it('formats zero', () => {
      expect(formatCurrency(0)).toBe('$0.00')
    })

    it('shows sign when showSign is true', () => {
      expect(formatCurrency(1234.56, '$', true)).toBe('+$1,234.56')
    })

    it('formats with custom currency', () => {
      expect(formatCurrency(100, '€')).toBe('€100.00')
    })

    it('handles large numbers', () => {
      expect(formatCurrency(1234567.89)).toBe('$1,234,567.89')
    })
  })

  describe('formatPercentage', () => {
    it('formats positive percentage', () => {
      expect(formatPercentage(2.5)).toBe('+2.50%')
    })

    it('formats negative percentage', () => {
      expect(formatPercentage(-0.9)).toBe('-0.90%')
    })

    it('formats zero percentage', () => {
      expect(formatPercentage(0)).toBe('+0.00%')
    })

    it('hides sign when showSign is false', () => {
      expect(formatPercentage(2.5, false)).toBe('2.50%')
    })

    it('formats with custom decimals', () => {
      expect(formatPercentage(2.567, true, 1)).toBe('+2.6%')
    })
  })
})
