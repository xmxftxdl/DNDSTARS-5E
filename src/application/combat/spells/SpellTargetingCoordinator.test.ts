import { describe, expect, it } from 'vitest'
import type { Dnd5eSpellTargetingSession } from './SpellTargetingContracts'
import {
  buildSpellTargetingSubmission,
  defaultSculptedSpellTargetIds,
  parseAreaExemptionSelection,
  selectSpellModifierMode,
  shouldAutoSubmitSpellAreaSelection,
} from './SpellTargetingCoordinator'

const targeting: Dnd5eSpellTargetingSession = {
  characterId: 'character-1',
  spellId: 'magic-missile',
  slotLevel: 1,
  maximumTargets: 3,
  allowDuplicateTargets: true,
  targetTokenIds: ['enemy-1', 'enemy-1', 'enemy-2'],
  overchannel: false,
  empowered: false,
  draconicResistance: false,
  repellingBlast: false,
  canSculpt: true,
  maximumSculptedTargets: 2,
  sculptedTargetIds: [],
  sculpting: false,
  maximumCarefulTargets: 0,
  carefulTargetIds: [],
  carefulSelecting: false,
  heightenedSelecting: false,
}

describe('SpellTargetingCoordinator', () => {
  it('deduplicates authority targets while preserving projectile assignments', () => {
    const payload = buildSpellTargetingSubmission({
      targeting,
      selectedTargetIds: targeting.targetTokenIds,
      currentTokenId: 'actor-1',
      areaTargetCells: [],
    })
    expect(payload.targetTokenIds).toEqual(['enemy-1', 'enemy-2'])
    expect(payload.projectileTargetIds).toEqual(['enemy-1', 'enemy-1', 'enemy-2'])
    expect(payload.areaTargetCells).toBeUndefined()
  })

  it('does not leak a stale area preview into a creature-targeted spell', () => {
    const payload = buildSpellTargetingSubmission({
      targeting: {
        ...targeting,
        spellId: 'scorching-ray',
        targetTokenIds: ['enemy-1', 'enemy-1', 'enemy-1'],
        areaTargetCell: { col: 2, row: 3 },
        areaTargetCells: [{ col: 2, row: 3 }],
        areaTargetAngleDegrees: 45,
        areaTargetRadiusFeet: 20,
      },
      selectedTargetIds: ['enemy-1'],
      currentTokenId: 'actor-1',
      areaTargetCell: { col: 9, row: 9 },
      areaTargetCells: [{ col: 9, row: 9 }],
      areaTargetOrientation: 2,
      areaTargetAngleDegrees: 90,
    })

    expect(payload).toMatchObject({
      targetTokenId: 'enemy-1',
      targetTokenIds: ['enemy-1'],
      projectileTargetIds: ['enemy-1', 'enemy-1', 'enemy-1'],
    })
    expect(payload.areaTargetCell).toBeUndefined()
    expect(payload.areaTargetCells).toBeUndefined()
    expect(payload.areaTargetOrientation).toBeUndefined()
    expect(payload.areaTargetAngleDegrees).toBeUndefined()
    expect(payload.areaTargetRadiusFeet).toBeUndefined()
  })

  it('carries a generic rectangular template angle to the authority payload', () => {
    const payload = buildSpellTargetingSubmission({
      targeting: {
        ...targeting,
        spellId: 'local.rules:rotating-wall',
        area: { shape: 'rect', origin: 'point', widthFeet: 60, heightFeet: 5, placeRangeFeet: 120, rotatable: true },
        areaTargetAngleDegrees: 37,
      },
      selectedTargetIds: ['enemy-1'],
      currentTokenId: 'actor-1',
      areaTargetCell: { col: 8, row: 3 },
      areaTargetAngleDegrees: 37,
    })
    expect(payload).toMatchObject({
      areaTargetCell: { col: 8, row: 3 },
      areaTargetAngleDegrees: 37,
    })
  })

  it('carries every selected origin for a multi-area spell', () => {
    const areaTargetCells = [
      { col: 2, row: 1 },
      { col: 6, row: 1 },
      { col: 10, row: 1 },
      { col: 14, row: 1 },
    ]
    const payload = buildSpellTargetingSubmission({
      targeting: {
        ...targeting,
        spellId: 'meteor-swarm',
        area: { shape: 'circle', origin: 'point', radiusFeet: 40, placeRangeFeet: 5_280 },
        areaTargetCount: 4,
        areaTargetCells,
      },
      selectedTargetIds: [],
      currentTokenId: 'actor-1',
      areaTargetCell: areaTargetCells[0],
      areaTargetCells,
    })
    expect(payload.areaTargetCell).toEqual(areaTargetCells[0])
    expect(payload.areaTargetCells).toEqual(areaTargetCells)
    expect(payload.areaTargetCells).not.toBe(areaTargetCells)
  })

  it('carries the selected Dancing Lights form to the Host payload', () => {
    const payload = buildSpellTargetingSubmission({
      targeting: {
        ...targeting,
        spellId: 'dancing-lights',
        area: { shape: 'circle', origin: 'point', radiusFeet: 0, placeRangeFeet: 120 },
        areaTargetCount: 1,
        minimumAreaTargetCount: 1,
        dancingLightsForm: 'humanoid',
      },
      selectedTargetIds: [],
      currentTokenId: 'wizard-token',
      areaTargetCell: { col: 8, row: 3 },
    })
    expect(payload).toMatchObject({
      dancingLightsForm: 'humanoid',
      areaTargetCell: { col: 8, row: 3 },
    })
  })

  it('preserves the ritual request through map-object area targeting', () => {
    const payload = buildSpellTargetingSubmission({
      targeting: {
        ...targeting,
        spellId: 'magic-mouth',
        slotLevel: 2,
        ritual: true,
        magicMouth: {
          schemaVersion: 1,
          message: '钟声响起',
          trigger: '生物进入 30 尺',
          triggerMode: 'proximity',
          repeat: true,
        },
        area: { shape: 'circle', origin: 'point', radiusFeet: 30, placeRangeFeet: 30 },
        autoSubmitOnAreaSelection: true,
      },
      selectedTargetIds: [],
      currentTokenId: 'actor-1',
      areaTargetCell: { col: 8, row: 3 },
    })
    expect(payload).toMatchObject({
      spellId: 'magic-mouth',
      ritual: true,
      slotLevel: 2,
      areaTargetCell: { col: 8, row: 3 },
      magicMouth: { message: '钟声响起' },
    })
  })

  it('carries Arcane Lock authorization and password configuration to the authority payload', () => {
    const payload = buildSpellTargetingSubmission({
      targeting: {
        ...targeting,
        spellId: 'arcane-lock',
        slotLevel: 3,
        secretPhrase: '星痕开门',
        excludedAreaTargetIds: ['druid-token'],
        area: { shape: 'circle', origin: 'point', radiusFeet: 5, placeRangeFeet: 5 },
      },
      selectedTargetIds: [],
      currentTokenId: 'wizard-token',
      areaTargetCell: { col: 1, row: 2 },
    })
    expect(payload).toMatchObject({
      spellId: 'arcane-lock',
      slotLevel: 3,
      secretPhrase: '星痕开门',
      excludedAreaTargetIds: ['druid-token'],
      areaTargetCell: { col: 1, row: 2 },
    })
  })

  it('never auto-submits Dancing Lights after only its first legal light point', () => {
    const dancingLights = {
      autoSubmitOnAreaSelection: true,
      areaTargetCount: 4,
      minimumAreaTargetCount: 1,
    }
    expect(shouldAutoSubmitSpellAreaSelection(dancingLights, 1)).toBe(false)
    expect(shouldAutoSubmitSpellAreaSelection(dancingLights, 4)).toBe(false)
    expect(shouldAutoSubmitSpellAreaSelection({
      autoSubmitOnAreaSelection: true,
      areaTargetCount: 1,
      minimumAreaTargetCount: 1,
    }, 1)).toBe(true)
    expect(shouldAutoSubmitSpellAreaSelection({
      autoSubmitOnAreaSelection: true,
      areaTargetCount: 1,
      minimumAreaTargetCount: 1,
      areaExemptionMode: 'trigger',
    }, 1)).toBe(false)
  })

  it('keeps modifier modes mutually exclusive', () => {
    const result = selectSpellModifierMode({ ...targeting, autoSculpt: true, carefulSelecting: true }, 'sculpt')
    expect(result).toMatchObject({ sculpting: true, carefulSelecting: false, heightenedSelecting: false })
  })

  it('does not expose Sculpt Spells merely because the caster is eligible for it', () => {
    const eligibleButInactive = { ...targeting, autoSculpt: false }
    expect(selectSpellModifierMode(eligibleButInactive, 'sculpt')).toBe(eligibleButInactive)
  })

  it('leaves Sculpt Spells protection empty until the player chooses creatures', () => {
    expect(defaultSculptedSpellTargetIds({
      enabled: true,
      affectedTargetIds: ['enemy-1', 'ally-1', 'ally-2', 'ally-3'],
      currentTargetIds: [],
      maximumTargets: 8,
    })).toEqual([])
  })

  it('preserves valid manual protection choices and caps a 7th-level spell at eight', () => {
    expect(defaultSculptedSpellTargetIds({
      enabled: true,
      affectedTargetIds: Array.from({ length: 9 }, (_, index) => `creature-${index + 1}`),
      currentTargetIds: [
        ...Array.from({ length: 9 }, (_, index) => `creature-${index + 1}`),
        'outside-area',
      ],
      maximumTargets: 8,
    })).toEqual(Array.from({ length: 8 }, (_, index) => `creature-${index + 1}`))
  })

  it('does not add automatic choices when Sculpt Spells was not armed', () => {
    expect(defaultSculptedSpellTargetIds({
      enabled: false,
      affectedTargetIds: ['ally-1'],
      currentTargetIds: ['ally-1'],
      maximumTargets: 4,
    })).toEqual([])
  })

  it('parses an Alarm exemption list without duplicates and supports clearing it', () => {
    const candidates = ['caster', 'ally', 'enemy']
    expect(parseAreaExemptionSelection('1， 3,3', candidates)).toEqual(['caster', 'enemy'])
    expect(parseAreaExemptionSelection('0', candidates)).toEqual([])
    expect(parseAreaExemptionSelection('', candidates)).toEqual([])
  })

  it('rejects malformed or out-of-range Alarm exemption choices', () => {
    const candidates = ['caster', 'enemy']
    expect(parseAreaExemptionSelection('3', candidates)).toBeUndefined()
    expect(parseAreaExemptionSelection('1.5', candidates)).toBeUndefined()
    expect(parseAreaExemptionSelection('caster', candidates)).toBeUndefined()
  })
})
