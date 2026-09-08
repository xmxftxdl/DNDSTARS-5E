import { useEffect, useState } from 'react'

/** Keeps countdown-only renders inside the interrupt overlay instead of its map parent. */
export function useInterruptCountdownNow(
  expiresAt: number | undefined,
  fixedNow?: number,
): number {
  const [now, setNow] = useState(() => fixedNow ?? Date.now())

  useEffect(() => {
    if (fixedNow != null || expiresAt == null) return
    const tick = () => setNow(Date.now())
    const firstFrame = window.requestAnimationFrame(tick)
    const timer = window.setInterval(tick, 250)
    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.clearInterval(timer)
    }
  }, [expiresAt, fixedNow])

  return fixedNow ?? now
}
