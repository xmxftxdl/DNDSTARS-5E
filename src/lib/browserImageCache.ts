const browserImageCache = new Map<string, HTMLImageElement>()
const browserImageLoads = new Map<string, Promise<HTMLImageElement | undefined>>()

export function cachedBrowserImage(asset: string): HTMLImageElement | undefined {
  return browserImageCache.get(asset)
}

/**
 * Load and decode one browser image once. Callers share the same element and
 * pending request, avoiding duplicate multi-megabyte VFX decodes.
 */
export function preloadBrowserImage(asset: string): Promise<HTMLImageElement | undefined> {
  const cached = browserImageCache.get(asset)
  if (cached) return Promise.resolve(cached)
  const pending = browserImageLoads.get(asset)
  if (pending) return pending
  if (typeof Image === 'undefined') return Promise.resolve(undefined)
  const load = new Promise<HTMLImageElement | undefined>((resolve) => {
    const image = new Image()
    image.onload = () => {
      browserImageCache.set(asset, image)
      browserImageLoads.delete(asset)
      resolve(image)
    }
    image.onerror = () => {
      browserImageLoads.delete(asset)
      resolve(undefined)
    }
    image.src = asset
  })
  browserImageLoads.set(asset, load)
  return load
}
