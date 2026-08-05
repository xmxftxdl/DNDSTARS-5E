import { describe, expect, it } from 'vitest'
import type { Dnd5eSpellTargetingSession } from './SpellTargetingContracts'
import { buildSpellTargetingSubmission, selectSpellModifierMode } from './SpellTargetingCoordinator'

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

  it('keeps modifier modes mutually exclusive', () => {
    const result = selectSpellModifierMode({ ...targeting, carefulSelecting: true }, 'sculpt')
    expect(result).toMatchObject({ sculpting: true, carefulSelecting: false, heightenedSelecting: false })
  })
})
