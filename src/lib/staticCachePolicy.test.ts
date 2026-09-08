import { describe, expect, it } from 'vitest'
import {
  HTML_CACHE_CONTROL,
  IMMUTABLE_BUILD_CACHE_CONTROL,
  REVALIDATED_STATIC_CACHE_CONTROL,
  staticCacheControl,
} from '../../scripts/static-cache-policy.mjs'

describe('production static cache policy', () => {
  it('always revalidates the SPA shell so deployments become visible immediately', () => {
    expect(staticCacheControl('C:/app/dist/index.html')).toBe(HTML_CACHE_CONTROL)
  })

  it('caches content-hashed Vite assets immutably', () => {
    expect(staticCacheControl('C:/app/dist/assets/MapsPage-Cw38ahPJ.js'))
      .toBe(IMMUTABLE_BUILD_CACHE_CONTROL)
    expect(staticCacheControl('C:/app/dist/assets/main-D2l2xaUa.css'))
      .toBe(IMMUTABLE_BUILD_CACHE_CONTROL)
  })

  it('keeps non-hashed public files revalidated instead of freezing them for a year', () => {
    expect(staticCacheControl('C:/app/dist/runtime-assets/art-asset-pack.json'))
      .toBe(REVALIDATED_STATIC_CACHE_CONTROL)
  })
})
