import path from 'node:path'

export const HTML_CACHE_CONTROL = 'no-cache'
export const IMMUTABLE_BUILD_CACHE_CONTROL = 'public, max-age=31536000, immutable'
export const REVALIDATED_STATIC_CACHE_CONTROL = 'public, max-age=0, must-revalidate'

const HASHED_BUILD_ASSET_PATTERN = /\/assets\/[^/]+-[a-z0-9_-]{8}\.[^/.]+$/i

export function staticCacheControl(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.html') return HTML_CACHE_CONTROL
  const normalizedPath = filePath.replaceAll('\\', '/')
  if (HASHED_BUILD_ASSET_PATTERN.test(normalizedPath)) return IMMUTABLE_BUILD_CACHE_CONTROL
  return REVALIDATED_STATIC_CACHE_CONTROL
}
