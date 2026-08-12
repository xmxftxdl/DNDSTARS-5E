export const HTML_CACHE_CONTROL: 'no-cache'
export const IMMUTABLE_BUILD_CACHE_CONTROL: 'public, max-age=31536000, immutable'
export const REVALIDATED_STATIC_CACHE_CONTROL: 'public, max-age=0, must-revalidate'

export function staticCacheControl(filePath: string): string
