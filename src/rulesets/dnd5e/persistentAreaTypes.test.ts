import { describe, expect, it } from 'vitest'
import {
  normalizeDnd5ePersistentAreaTriggerSnapshot,
  normalizeDnd5ePersistentAreaVerticalSnapshot,
  normalizeDnd5ePersistentAreaVisual,
} from './persistentAreaTypes'

describe('persistent area vertical snapshots', () => {
  it('normalizes bounded ground and volume declarations', () => {
    expect(normalizeDnd5ePersistentAreaVerticalSnapshot({ mode: 'ground' })).toEqual({ mode: 'ground' })
    expect(normalizeDnd5ePersistentAreaVerticalSnapshot({
      mode: 'volume', baseElevationFeet: -10, heightFeet: 40, anchorOffsetFeet: 5,
    })).toEqual({
      mode: 'volume', baseElevationFeet: -10, heightFeet: 40, anchorOffsetFeet: 5,
    })
    expect(normalizeDnd5ePersistentAreaVerticalSnapshot({
      mode: 'volume', baseElevationFeet: 15, heightFeet: 10,
    })).toEqual({ mode: 'volume', baseElevationFeet: 15, heightFeet: 10 })
  })

  it('fails closed on malformed, unbounded, or executable metadata', () => {
    for (const value of [
      { mode: 'ground', heightFeet: 5 },
      { mode: 'volume', baseElevationFeet: 0 },
      { mode: 'volume', baseElevationFeet: 0, heightFeet: 0 },
      { mode: 'volume', baseElevationFeet: 0.5, heightFeet: 10 },
      { mode: 'volume', baseElevationFeet: 0, heightFeet: 10, anchorOffsetFeet: 10_001 },
      { mode: 'volume', baseElevationFeet: 0, heightFeet: 10, run: 'eval()' },
    ]) expect(normalizeDnd5ePersistentAreaVerticalSnapshot(value)).toBeUndefined()
  })
})

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

  it('accepts the bounded Grease visual and permanent prone declaration', () => {
    expect(normalizeDnd5ePersistentAreaVisual({ preset: 'grease' })).toEqual({
      preset: 'grease', intensity: 'normal',
    })
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot({
      id: 'grease-enter', label: '油腻术·进入区域', timing: 'on-enter', oncePerRound: false,
      savingThrow: { ability: 'dex', dc: 14, onSuccess: 'none' },
      condition: { condition: 'prone', duration: { expiresAt: 'permanent' } },
    })).toMatchObject({
      timing: 'on-enter', savingThrow: { ability: 'dex', dc: 14 },
      condition: { condition: 'prone', duration: { expiresAt: 'permanent' } },
    })
  })

  it('accepts dedicated material presets for persistent spell visuals', () => {
    for (const preset of ['mage-hand', 'insect-plague', 'blade-barrier'] as const) {
      expect(normalizeDnd5ePersistentAreaVisual({ preset })).toEqual({
        preset,
        intensity: 'normal',
      })
    }
  })

  it('accepts a bounded Entangle escape check and rejects executable escape metadata', () => {
    expect(normalizeDnd5ePersistentAreaVisual({ preset: 'entangle' })).toEqual({
      preset: 'entangle', intensity: 'normal',
    })
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot({
      id: 'entangle-create',
      label: '纠缠术·植物缠绕',
      timing: 'on-create',
      savingThrow: { ability: 'str', dc: 14, onSuccess: 'none' },
      condition: {
        condition: 'restrained',
        duration: { expiresAt: 'permanent' },
        escapeCheck: { ability: 'str', alternativeAbility: 'dex', dc: 14, economy: 'action' },
      },
      skipSaveWhenSourceConditionActive: 'restrained',
      cells: [{ col: 4, row: 5 }, { col: 4, row: 6 }],
    })).toMatchObject({
      condition: {
        condition: 'restrained',
        escapeCheck: { ability: 'str', alternativeAbility: 'dex', dc: 14, economy: 'action' },
      },
      skipSaveWhenSourceConditionActive: 'restrained',
      cells: [{ col: 4, row: 5 }, { col: 4, row: 6 }],
    })
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot({
      id: 'unsafe-entangle',
      label: '不安全脱困',
      timing: 'on-create',
      condition: {
        condition: 'restrained',
        duration: { expiresAt: 'permanent' },
        escapeCheck: { ability: 'str', dc: 14, economy: 'action', run: 'eval()' },
      },
    })).toBeUndefined()
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
