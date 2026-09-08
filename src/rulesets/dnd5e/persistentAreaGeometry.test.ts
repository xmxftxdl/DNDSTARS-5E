import { describe, expect, it } from 'vitest'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import {
  dnd5ePersistentAreaAffectsTokenVerticallyAt,
  dnd5ePersistentAreaOccupantModifiersAt,
} from './persistentAreaGeometry'

const map: BattleMap = {
  id: 'legacy-core-area-z',
  name: 'Legacy core area Z',
  width: 100,
  height: 100,
  gridSize: 10,
  gridOffsetX: 0,
  gridOffsetY: 0,
  showGrid: true,
  feetPerCell: 5,
  tokens: [],
}

function token(elevationFeet: number): Token {
  return {
    id: `target-${elevationFeet}`,
    label: 'Target',
    x: 5,
    y: 5,
    elevationFeet,
    color: '',
    emoji: '',
    size: 1,
    type: 'enemy',
  }
}

function legacyArea(coreSpellId: string): Dnd5ePluginArea {
  return {
    id: `legacy-${coreSpellId}`,
    pluginId: 'dnd5e-core-spells',
    featureId: coreSpellId,
    sourceKind: 'core-spell',
    coreSpellId,
    label: coreSpellId,
    color: '#fff',
    sourceCharacterId: 'caster',
    sourceTokenId: 'caster-token',
    cells: [{ col: 0, row: 0 }],
    anchorCell: { col: 0, row: 0 },
    anchorMode: 'fixed',
    createdRound: 1,
    expiresAfterRound: 10,
  }
}

describe('legacy persistent-area vertical migration', () => {
  it('infers the finite Moonbeam column instead of an unbounded Z column', () => {
    const area = legacyArea('moonbeam')
    expect(dnd5ePersistentAreaAffectsTokenVerticallyAt({
      area,
      map,
      token: token(39),
      position: { x: 5, y: 5 },
    })).toBe(true)
    expect(dnd5ePersistentAreaAffectsTokenVerticallyAt({
      area,
      map,
      token: token(41),
      position: { x: 5, y: 5 },
    })).toBe(false)
  })

  it('infers legacy surface spells as ground-only', () => {
    const area = legacyArea('grease')
    expect(dnd5ePersistentAreaAffectsTokenVerticallyAt({
      area,
      map,
      token: token(0),
      position: { x: 5, y: 5 },
    })).toBe(true)
    expect(dnd5ePersistentAreaAffectsTokenVerticallyAt({
      area,
      map,
      token: token(10),
      position: { x: 5, y: 5 },
    })).toBe(false)
  })

  it('projects silence occupant rules only while the whole token is contained in the volume', () => {
    const silence: Dnd5ePluginArea = {
      ...legacyArea('silence'),
      cells: [{ col: 0, row: 0 }],
      vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 20 },
      occupantModifiers: {
        containment: 'fully-contained',
        preventsVerbalComponents: true,
        damageImmunities: ['thunder'],
      },
    }
    const inside = token(0)
    expect(dnd5ePersistentAreaOccupantModifiersAt({
      map: { ...map, tokens: [inside], dnd5ePluginAreas: [silence] },
      token: inside,
      position: inside,
    })).toMatchObject({ preventsVerbalComponents: true, damageImmunities: ['thunder'] })

    const tooLarge = { ...inside, id: 'large', size: 2 }
    expect(dnd5ePersistentAreaOccupantModifiersAt({
      map: { ...map, tokens: [tooLarge], dnd5ePluginAreas: [silence] },
      token: tooLarge,
      position: tooLarge,
    })).toMatchObject({ preventsVerbalComponents: false, damageImmunities: [] })
  })

  it('projects source-qualified typed protection from eligible areas', () => {
    const ward: Dnd5ePluginArea = {
      ...legacyArea('magic-circle'),
      occupantModifiers: {
        attacksAgainstOccupantDisadvantageCreatureTypes: ['fiend'],
        conditionImmunitiesBySourceCreatureType: [{
          conditions: ['charmed'], sourceCreatureTypes: ['fiend'],
        }],
        savingThrowAdvantagesBySourceCreatureType: [{
          conditions: ['any'], sourceCreatureTypes: ['fiend'],
        }],
      },
    }
    const inside = token(0)
    expect(dnd5ePersistentAreaOccupantModifiersAt({
      map: { ...map, tokens: [inside], dnd5ePluginAreas: [ward] },
      token: inside,
      position: inside,
    })).toMatchObject({
      attacksAgainstOccupantDisadvantageCreatureTypes: ['fiend'],
      attacksAgainstOccupantDisadvantageSources: [{
        areaId: 'legacy-magic-circle', label: 'magic-circle', creatureTypes: ['fiend'],
      }],
      conditionImmunitiesBySourceCreatureType: [{
        conditions: ['charmed'], sourceCreatureTypes: ['fiend'],
      }],
      savingThrowAdvantagesBySourceCreatureType: [{
        conditions: ['any'], sourceCreatureTypes: ['fiend'],
      }],
    })
  })

  it('keeps a Reverse Gravity target supported exactly at the volume top', () => {
    const reverseGravity: Dnd5ePluginArea = {
      ...legacyArea('reverse-gravity'),
      vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 100 },
      occupantModifiers: { magicallyHeldAloft: true },
    }
    const atTop = token(100)
    const aboveTop = token(100.01)
    expect(dnd5ePersistentAreaOccupantModifiersAt({
      map: { ...map, tokens: [atTop], dnd5ePluginAreas: [reverseGravity] },
      token: atTop,
      position: atTop,
    }).magicallyHeldAloft).toBe(true)
    expect(dnd5ePersistentAreaOccupantModifiersAt({
      map: { ...map, tokens: [aboveTop], dnd5ePluginAreas: [reverseGravity] },
      token: aboveTop,
      position: aboveTop,
    }).magicallyHeldAloft).toBe(false)
  })
})
