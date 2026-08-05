import { useEffect, useRef, useState } from 'react'
import Konva from 'konva'
import { cachedBrowserImage, preloadBrowserImage } from '../../lib/browserImageCache'

const STATUS_ANIM_FPS = 30

/**
 * Controlled Konva status effect animation hook.
 * - active=false stops the animation immediately.
 * - Status components are already conditionally rendered; this adds an explicit runtime gate.
 * - Mounted components only animate while active, and clear stops the animation.
 * - Frame-rate limiting skips redraws until the frame budget is reached.
 * - frame.time is still real elapsed time, so throttling does not freeze effects.
 * - The effect simply renders less often.
 *
 * getLayer reads from refs after mount.
 */
export function useStatusAnimation(
  getLayer: () => Konva.Layer | null,
  callback: (frame: { time: number } | null) => void,
  options?: { active?: boolean; fps?: number },
) {
  const active = options?.active ?? true
  const fps = options?.fps ?? STATUS_ANIM_FPS
  const callbackRef = useRef(callback)
  const getLayerRef = useRef(getLayer)

  useEffect(() => {
    callbackRef.current = callback
    getLayerRef.current = getLayer
  }, [callback, getLayer])

  useEffect(() => {
    if (!active) return
    // RAF timestamps commonly advance by a hair under 16.667 ms. Applying an
    // exact 60 fps threshold therefore skips every other callback and makes a
    // nominally 60 fps effect move in visible 30 fps steps.
    const minDelta = fps > 0 && fps < 60 ? 1000 / fps : 0
    let lastRender = -Infinity
    let anim: Konva.Animation | null = null
    let raf = 0

    const start = () => {
      const layer = getLayerRef.current()
      if (!layer) {
        // Layer may not be mounted on the first frame; retry next frame.
        raf = requestAnimationFrame(start)
        return
      }
      anim = new Konva.Animation((frame) => {
        const time = frame?.time ?? 0
        // Skip redraws until the frame budget is reached.
        if (minDelta > 0 && time - lastRender < minDelta) return false
        lastRender = time
        callbackRef.current(frame ? { time: frame.time } : null)
      }, layer)
      anim.start()
    }

    start()
    return () => {
      cancelAnimationFrame(raf)
      anim?.stop()
    }
  }, [active, fps])
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!media) return
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return reduced
}

export function useTokenBadgeImage(asset: string | undefined): HTMLImageElement | undefined {
  const [loaded, setLoaded] = useState<{ asset: string; image?: HTMLImageElement } | undefined>(() => {
    if (!asset) return undefined
    return { asset, image: cachedBrowserImage(asset) }
  })

  useEffect(() => {
    if (!asset) return
    let disposed = false
    let retryTimer = 0
    const cached = cachedBrowserImage(asset)
    if (cached) {
      queueMicrotask(() => {
        if (!disposed) setLoaded({ asset, image: cached })
      })
      return () => {
        disposed = true
      }
    }
    const load = (attempt: number) => {
      void preloadBrowserImage(asset).then((image) => {
        if (disposed) return
        if (image) {
          setLoaded({ asset, image })
          return
        }
        if (attempt >= 4) {
          setLoaded({ asset })
          return
        }
        retryTimer = window.setTimeout(() => load(attempt + 1), 180 * (attempt + 1))
      })
    }
    load(0)
    return () => {
      disposed = true
      if (retryTimer) window.clearTimeout(retryTimer)
    }
  }, [asset])

  return loaded && loaded.asset === asset ? loaded.image : undefined
}
