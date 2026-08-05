import { useCallback, useLayoutEffect, useRef } from 'react'

/**
 * Stable browser callback that always delegates to the latest render closure.
 * Unlike React Effect Events it is safe to call from user events, timers and
 * transport callbacks as well as from effects.
 */
export function useLatestCallback<Args extends unknown[], Result>(
  callback: (...args: Args) => Result,
): (...args: Args) => Result {
  const callbackRef = useRef(callback)
  useLayoutEffect(() => {
    callbackRef.current = callback
  }, [callback])
  return useCallback((...args: Args) => callbackRef.current(...args), [])
}
