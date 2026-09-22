import type { BookSocketEvent } from '@/types'

type BookEventHandler = (payload: unknown) => void

const handlers = new Map<BookSocketEvent, Set<BookEventHandler>>()

/** In-process stand-in for the book socket while the UI runs on mocks. */
export function subscribeBookEvent(event: BookSocketEvent, handler: BookEventHandler): () => void {
  const set = handlers.get(event) ?? new Set<BookEventHandler>()
  set.add(handler)
  handlers.set(event, set)
  return () => {
    set.delete(handler)
  }
}

export function publishBookEvent(event: BookSocketEvent, payload: unknown): void {
  handlers.get(event)?.forEach((handler) => handler(payload))
}
