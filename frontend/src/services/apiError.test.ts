import { describe, expect, it } from 'vitest'
import { apiErrorMessage, describeFieldError } from './apiError'

describe('api field errors', () => {
  it('names a missing required field', () => {
    expect(describeFieldError({ field: 'body → risk → sleeve_loss_limit_pct', message: 'Field required' })).toBe(
      'risk.sleeve_loss_limit_pct is required',
    )
  })

  it('joins every missing field from an API error', () => {
    const error = {
      isAxiosError: true,
      response: {
        data: {
          error: {
            message: 'Request validation failed',
            details: {
              errors: [
                { field: 'body → universe', message: 'Field required' },
                { field: 'body → risk', message: 'Field required' },
              ],
            },
          },
        },
      },
    }
    expect(apiErrorMessage(error, 'Could not save the bot.')).toBe('universe is required; risk is required')
  })

  it('keeps a message that already names the field', () => {
    expect(describeFieldError({ field: 'body → risk', message: 'risk is required' })).toBe('risk is required')
  })

  it('names fields on a FastAPI detail list', () => {
    const error = {
      isAxiosError: true,
      response: {
        data: {
          detail: [{ loc: ['body', 'name'], msg: 'Field required' }],
        },
      },
    }
    expect(apiErrorMessage(error, 'Could not save the bot.')).toBe('name is required')
  })
})
