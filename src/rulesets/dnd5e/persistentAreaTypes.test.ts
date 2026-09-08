import { describe, expect, it } from 'vitest'
import {
  normalizeDnd5ePersistentAreaBlocking,
  normalizeDnd5ePersistentAreaTurnLifecycle,
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

describe('persistent area staged wind and target policy', () => {
  it('normalizes closed fog dispersal stages and rejects object damage targets', () => {
    expect(normalizeDnd5ePersistentAreaTurnLifecycle({
      timing: 'source-turn-start',
      stages: [{ atAdvance: 4, dispersesFogAndMist: true }],
    })).toMatchObject({
      stages: [{ atAdvance: 4, dispersesFogAndMist: true }],
    })
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot({
      id: 'acid-rain', label: '酸雨', timing: 'source-turn-start',
      targetKinds: ['creature', 'object'],
      damage: { count: 1, sides: 6, type: 'acid' },
    })).toBeUndefined()
  })

  it('rejects executable wind stages and non-damaging object triggers', () => {
    expect(normalizeDnd5ePersistentAreaTurnLifecycle({
      timing: 'source-turn-start',
      stages: [{ atAdvance: 4, dispersesFogAndMist: true, run: 'eval()' }],
    })).toBeUndefined()
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot({
      id: 'object-notice', label: '物体通知', timing: 'on-create',
      targetKinds: ['object'],
      notification: { delivery: 'mental-to-source', message: 'seen' },
    })).toBeUndefined()
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
    for (const preset of [
      'mage-hand', 'insect-plague', 'blade-barrier', 'silent-image', 'unseen-servant', 'mislead',
      'project-image',
    ] as const) {
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

  it('normalizes data-only mental and audible notifications without accepting executable metadata', () => {
    const base = {
      id: 'alarm-enter', label: '警报', timing: 'on-enter', oncePerRound: false,
    }
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot({
      ...base, notification: { delivery: 'mental-to-source' },
    })).toMatchObject({ notification: { delivery: 'mental-to-source' } })
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot({
      ...base, notification: { delivery: 'audible', audibleRadiusFeet: 60 },
    })).toMatchObject({ notification: { delivery: 'audible', audibleRadiusFeet: 60 } })
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot({
      ...base, notification: { delivery: 'audible' },
    })).toBeUndefined()
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot({
      ...base, notification: { delivery: 'mental-to-source', run: 'eval()' },
    })).toBeUndefined()
  })

  it('accepts save-only lifetime triggers for zone-style knowledge effects', () => {
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot({
      id: 'truth-save', label: '诚实之域豁免', timing: 'on-enter',
      oncePerTarget: true,
      savingThrow: { ability: 'cha', dc: 15, onSuccess: 'none', magical: true },
    })).toMatchObject({
      oncePerRound: false, oncePerTurn: false, oncePerTarget: true,
      savingThrow: { ability: 'cha', dc: 15 },
    })
  })

  it('accepts only bounded source-turn target choices', () => {
    const trigger = {
      id: 'storm-choice', label: '第三轮闪电', timing: 'source-turn-start',
      maximumTotalUses: 6, sourceChoosesTargets: true,
      damage: { count: 10, sides: 6, modifier: 0, type: 'lightning' },
    }
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot(trigger)).toMatchObject({
      timing: 'source-turn-start', maximumTotalUses: 6, sourceChoosesTargets: true,
    })
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot({
      ...trigger, timing: 'turn-start',
    })).toBeUndefined()
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot({
      ...trigger, maximumTotalUses: undefined,
    })).toBeUndefined()
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot({
      ...trigger, sourceChoosesTargets: 'yes',
    })).toBeUndefined()
  })

  it('normalizes concentration-ending Constitution saves and rejects malformed variants', () => {
    const trigger = {
      id: 'sleet-storm-concentration-turn-start',
      label: '雪雨暴·专注干扰',
      timing: 'turn-start',
      oncePerTurn: true,
      savingThrow: { ability: 'con', dc: 15, onSuccess: 'none' },
      endTargetConcentrationOnFailedSave: true,
    }
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot(trigger)).toMatchObject({
      savingThrow: { ability: 'con', dc: 15 },
      endTargetConcentrationOnFailedSave: true,
    })
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot({
      ...trigger,
      savingThrow: { ability: 'dex', dc: 15, onSuccess: 'none' },
    })).toBeUndefined()
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot({
      ...trigger,
      endTargetConcentrationOnFailedSave: 'yes',
    })).toBeUndefined()
  })
})

describe('persistent area boundary permissions', () => {
  it('normalizes Host-derived occupant entry and directional ray policies', () => {
    expect(normalizeDnd5ePersistentAreaBlocking({
      movement: true,
      movementMode: 'enter',
      entryPermission: 'occupants-at-creation',
      authorizedTokenIds: ['caster-token', 'ally-token'],
      blocksTeleportationEntry: true,
      vision: true,
      visionMode: 'outside-in',
      lineOfEffect: true,
      lineOfEffectMode: 'boundary',
    })).toEqual({
      movement: true,
      movementMode: 'enter',
      includedCreatureTypes: undefined,
      excludedCreatureTypes: undefined,
      excludeSourceToken: false,
      entryPermission: 'occupants-at-creation',
      authorizedTokenIds: ['caster-token', 'ally-token'],
      blocksTeleportationEntry: true,
      blocksTeleportationExit: false,
      teleportationExitSavingThrow: undefined,
      vision: true,
      visionMode: 'outside-in',
      lineOfEffect: true,
      lineOfEffectMode: 'boundary',
    })
  })

  it('rejects client-supplied authorization without the bounded policy and executable metadata', () => {
    expect(normalizeDnd5ePersistentAreaBlocking({
      movement: true,
      authorizedTokenIds: ['intruder'],
    })).toBeUndefined()
    expect(normalizeDnd5ePersistentAreaBlocking({
      movement: true,
      entryPermission: 'occupants-at-creation',
      authorizedTokenIds: ['caster'],
      authorize: 'eval()',
    })).toBeUndefined()
  })

  it('normalizes only bounded teleport-exit saves attached to an exit ward', () => {
    expect(normalizeDnd5ePersistentAreaBlocking({
      blocksTeleportationExit: true,
      teleportationExitSavingThrow: { ability: 'cha', dc: 17 },
    })).toMatchObject({
      blocksTeleportationExit: true,
      teleportationExitSavingThrow: { ability: 'cha', dc: 17 },
    })
    expect(normalizeDnd5ePersistentAreaBlocking({
      movement: true,
      teleportationExitSavingThrow: { ability: 'cha', dc: 17 },
    })).toBeUndefined()
    expect(normalizeDnd5ePersistentAreaBlocking({
      blocksTeleportationExit: true,
      teleportationExitSavingThrow: { ability: 'cha', dc: 'eval()' },
    })).toBeUndefined()
  })
})
