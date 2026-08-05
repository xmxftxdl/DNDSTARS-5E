import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  APP_THEME_STORAGE_KEY,
  DEFAULT_APP_THEME,
  normalizeAppTheme,
  readStoredAppTheme,
} from './appTheme'

describe('app theme preference', () => {
  it('keeps dark mode as the default and rejects unknown values', () => {
    expect(normalizeAppTheme(undefined)).toBe(DEFAULT_APP_THEME)
    expect(normalizeAppTheme('system')).toBe(DEFAULT_APP_THEME)
    expect(normalizeAppTheme('light')).toBe('light')
  })

  it('restores a valid persisted light preference', () => {
    expect(readStoredAppTheme({
      getItem: (key) => key === APP_THEME_STORAGE_KEY ? 'light' : null,
    })).toBe('light')
  })

  it('fails closed to dark when browser storage is unavailable', () => {
    expect(readStoredAppTheme({
      getItem: () => { throw new Error('storage blocked') },
    })).toBe('dark')
  })

  it('keeps legacy pale and translucent text readable on light surfaces', () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')

    expect(css).toContain('[class^="text-slate-300/"]')
    expect(css).toContain('[class^="text-violet-"]')
    expect(css).toContain('[class^="text-cyan-"]')
    expect(css).toContain('[class^="text-emerald-"]')
    expect(css).toContain('[class^="text-amber-"]')
    expect(css).toContain('[class^="text-rose-"]')
    expect(css).toContain('[class^="bg-rose-9"]')
    expect(css).toContain('[class^="hover:text-rose-"]')
    expect(css).toContain('[class^="group-hover:text-sky-"]')
    expect(css).toContain('[class~="bg-cyan-500"], [class~="bg-cyan-600"]')
    expect(css).toContain('[class~="text-white"][class~="from-arcane-500"]')
    expect(css).toContain(':is(h1, h2, h3, h4, h5, h6, p, strong, legend, dt, dd)[class~="text-white"]')
    expect(css).toContain('color: var(--light-text-strong) !important;')
    expect(css).toContain('color: var(--light-text-subtle) !important;')
  })
})
