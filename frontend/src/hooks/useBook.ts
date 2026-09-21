import { useSyncExternalStore } from 'react'
import { getBookState, subscribeBook } from '@/mocks/bookStore'

export function useBook() {
  return useSyncExternalStore(subscribeBook, getBookState, getBookState)
}
