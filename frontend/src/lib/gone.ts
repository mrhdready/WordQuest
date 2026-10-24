import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ApiError } from '@/lib/api'

/**
 * 404 in einem Dialog: Set, Vokabel oder Kind ist schon weg (anderer Tab).
 * Die Listen unter `queryKeys` werden erst beim Schliessen neu geladen: ein
 * Neuladen bei offenem Dialog nimmt den Eintrag mitsamt Fokusziel weg, und
 * Dialog und Eingaben verschwinden.
 */
export function useGone(...queryKeys: string[][]) {
  const queryClient = useQueryClient()
  const [gone, setGone] = useState(false)
  return {
    gone,
    reset: () => setGone(false),
    noteError: (caught: unknown) => {
      const found = caught instanceof ApiError && caught.status === 404
      if (found) setGone(true)
      return found
    },
    closed: () => {
      if (!gone) return
      for (const queryKey of queryKeys) void queryClient.invalidateQueries({ queryKey })
    },
  }
}
