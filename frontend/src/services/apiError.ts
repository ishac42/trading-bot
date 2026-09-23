import axios from 'axios'

type FieldError = {
  field?: string
  loc?: Array<string | number>
  message?: string
  msg?: string
}

function fieldPath(item: FieldError): string {
  const raw = item.field
    ? item.field.split(' → ')
    : Array.isArray(item.loc)
      ? item.loc.map(String)
      : []
  return raw.filter((part) => part && part !== 'body' && part !== 'query' && part !== 'path' && part !== 'response').join('.')
}

export function describeFieldError(item: FieldError): string {
  const message = item.message || item.msg || ''
  const field = fieldPath(item)
  if (!message) return field ? `${field} is required` : ''
  if (!field) return message
  if (message === 'Field required') return `${field} is required`
  if (message.includes(field)) return message
  return `${field}: ${message}`
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback
  const data = error.response?.data as {
    detail?: FieldError[]
    error?: { message?: string; details?: { errors?: FieldError[]; fields?: string[] } }
  }
  const errors = data?.error?.details?.errors ?? (Array.isArray(data?.detail) ? data.detail : undefined)
  const described = (errors ?? []).map(describeFieldError).filter(Boolean)
  if (described.length) return described.join('; ')
  const named = data?.error?.details?.fields?.filter(Boolean) ?? []
  const message = data?.error?.message
  if (message && named.length && !named.some((field) => message.includes(field))) {
    return `${message}: ${named.join(', ')}`
  }
  if (message) return message
  return fallback
}
