import { describe, expect, it } from 'vitest'
import { normalizeDnd5ePersistentAreaVisual } from './persistentAreaTypes'

describe('persistent area visual declarations', () => {
  it('normalizes the bounded toxic-cloud renderer declaration', () => {
    expect(normalizeDnd5ePersistentAreaVisual({ preset: 'toxic-cloud' })).toEqual({
      preset: 'toxic-cloud',
      intensity: 'normal',
    })
    expect(normalizeDnd5ePersistentAreaVisual({ preset: 'toxic-cloud', intensity: 'strong' })).toEqual({
      preset: 'toxic-cloud',
      intensity: 'strong',
    })
  })

  it('fails closed on arbitrary renderers and unbounded values', () => {
    expect(normalizeDnd5ePersistentAreaVisual({ preset: 'custom-shader', sksl: 'while(true){}' })).toBeUndefined()
    expect(normalizeDnd5ePersistentAreaVisual({ preset: 'toxic-cloud', intensity: 999 })).toBeUndefined()
  })
})
