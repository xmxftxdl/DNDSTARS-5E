import { describe, expect, it } from 'vitest'
import { pluginsSectionFromSearch } from './pluginsPageSection'

describe('account extension center section routing', () => {
  it('keeps the DM workshop out of account-market tabs', () => {
    expect(pluginsSectionFromSearch('?section=create')).toBeUndefined()
    expect(pluginsSectionFromSearch('?section=workshop')).toBeUndefined()
  })

  it('accepts every extension-center tab and rejects unknown values', () => {
    expect(pluginsSectionFromSearch('?section=library')).toBe('library')
    expect(pluginsSectionFromSearch('?section=catalog')).toBe('catalog')
    expect(pluginsSectionFromSearch('?section=orders')).toBe('orders')
    expect(pluginsSectionFromSearch('?section=creator')).toBe('creator')
    expect(pluginsSectionFromSearch('?section=moderation')).toBe('moderation')
    expect(pluginsSectionFromSearch('?section=unknown')).toBeUndefined()
  })
})
