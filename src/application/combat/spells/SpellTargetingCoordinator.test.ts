import { describe, expect, it } from 'vitest'
import type { Dnd5eSpellTargetingSession } from './SpellTargetingContracts'
import {
  buildSpellTargetingSubmission,
  defaultSculptedSpellTargetIds,
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
    })
    expect(payload.targetTokenIds).toEqual(['enemy-1', 'enemy-2'])
    expect(payload.projectileTargetIds).toEqual(['enemy-1', 'enemy-1', 'enemy-2'])
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
  })

  it('keeps modifier modes mutually exclusive', () => {
    const result = selectSpellModifierMode({ ...targeting, carefulSelecting: true }, 'sculpt')
    expect(result).toMatchObject({ sculpting: true, carefulSelecting: false, heightenedSelecting: false })
  })

  it('automatically protects affected allies when Sculpt Spells was armed', () => {
    expect(defaultSculptedSpellTargetIds({
      enabled: true,
      affectedTargetIds: ['enemy-1', 'ally-1', 'ally-2', 'ally-3'],
      alliedTargetIds: ['ally-1', 'ally-2', 'ally-3'],
      currentTargetIds: [],
      maximumTargets: 2,
    })).toEqual(['ally-1', 'ally-2'])
  })

  it('preserves valid manual protection choices and never exceeds the allowance', () => {
    expect(defaultSculptedSpellTargetIds({
      enabled: true,
      affectedTargetIds: ['enemy-1', 'ally-1', 'ally-2'],
      alliedTargetIds: ['ally-1', 'ally-2'],
      currentTargetIds: ['enemy-1', 'outside-area'],
      maximumTargets: 2,
    })).toEqual(['enemy-1', 'ally-1'])
  })

  it('does not add automatic choices when Sculpt Spells was not armed', () => {
    expect(defaultSculptedSpellTargetIds({
      enabled: false,
      affectedTargetIds: ['ally-1'],
      alliedTargetIds: ['ally-1'],
      currentTargetIds: [],
      maximumTargets: 4,
    })).toEqual([])
  })
})
