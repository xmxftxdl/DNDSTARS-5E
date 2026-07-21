import { describe, expect, it } from 'vitest'
import {
  normalizeDnd5ePersistentAreaTriggerSnapshot,
  normalizeDnd5ePersistentAreaVisual,
} from './persistentAreaTypes'

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

  it('requires a bounded interval for movement-distance triggers', () => {
    const base = {
      id: 'path-damage', label: '路径伤害', timing: 'on-move-distance', oncePerRound: false,
      damage: { count: 2, sides: 4, modifier: 0, type: 'piercing' },
    }
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot({
      ...base, movementIntervalFeet: 5,
    })).toMatchObject({ timing: 'on-move-distance', movementIntervalFeet: 5 })
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot(base)).toBeUndefined()
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot({
      ...base, movementIntervalFeet: 0,
    })).toBeUndefined()
  })
})
