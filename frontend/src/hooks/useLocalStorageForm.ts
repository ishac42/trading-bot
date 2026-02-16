import { useState, useEffect, useCallback, useRef } from 'react'

const DEBOUNCE_MS = 500

/**
 * Hook to auto-save and restore form data from localStorage.
 *
 * @param key – Unique storage key (e.g. "bot-form-create" or "bot-form-edit-123")
 * @param initialData – Default form data when nothing is stored
 * @returns [data, setData, clearSaved, hasSavedData]
 */
export function useLocalStorageForm<T>(
  key: string,
  initialData: T
): [T, React.Dispatch<React.SetStateAction<T>>, () => void, boolean] {
  const storageKey = `form_autosave_${key}`

  // Try to restore from localStorage on first render
  const [data, setData] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        return JSON.parse(stored) as T
      }
    } catch {
      // ignore corrupted storage
    }
    return initialData
  })

  const [hasSavedData] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) !== null
    } catch {
      return false
    }
  })

  // Debounced save to localStorage
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(data))
      } catch {
        // storage full or unavailable
      }
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [data, storageKey])

  const clearSaved = useCallback(() => {
    try {
      localStorage.removeItem(storageKey)
    } catch {
      // ignore
    }
  }, [storageKey])

  return [data, setData, clearSaved, hasSavedData]
}
