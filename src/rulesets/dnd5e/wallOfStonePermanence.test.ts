import { describe, expect, it } from 'vitest'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import type { Character } from '../../types/character'
import { completeDnd5eWallOfStoneForCampaignTime } from './wallOfStonePermanence'

function stoneArea(overrides: Partial<Dnd5ePluginArea> = {}): Dnd5ePluginArea {
  return {
    id: 'stone-area', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:wall-of-stone',
    sourceKind: 'core-spell', coreSpellId: 'wall-of-stone', label: '石墙术', color: '#78716c',
    sourceCharacterId: 'wizard', sourceTokenId: 'wizard-token', cells: [{ col: 2, row: 2 }],
    createdRound: 1, expiresAfterRound: 101, concentrationId: 'wall-of-stone',
    ...overrides,
  }
}

function map(areas: Dnd5ePluginArea[]): BattleMap {
  return {
    id: 'map', name: 'Map', width: 1_000, height: 1_000, gridSize: 20,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [], dnd5ePluginAreas: areas,
  } as BattleMap
}

function wizard(overrides: Partial<Character> = {}): Character {
  return {
    id: 'wizard', name: 'Wizard', class: 'wizard', level: 20,
    concentrating: true, dnd5eWorldTimeAppliedMinute: 1_000,
    dnd5eCombatState: {
      concentrationSpellId: 'wall-of-stone', concentrationRoundsRemaining: 100,
    },
    ...overrides,
  } as Character
}

describe('Wall of Stone campaign-time permanence', () => {
  it('maintaining concentration for the full ten minutes makes the wall permanent', () => {
    const result = completeDnd5eWallOfStoneForCampaignTime({
      maps: [map([stoneArea()])], characters: [wizard()], worldMinute: 1_010,
    })
    expect(result.completedAreaIds).toEqual(['stone-area'])
    expect(result.maps[0].dnd5ePluginAreas?.[0]).toMatchObject({
      permanent: true,
      concentrationId: undefined,
      expiresAfterRound: 101,
    })
  })

  it('does not permanentize before ten minutes or after concentration broke', () => {
    const beforeDuration = completeDnd5eWallOfStoneForCampaignTime({
      maps: [map([stoneArea()])], characters: [wizard()], worldMinute: 1_009,
    })
    expect(beforeDuration.completedAreaIds).toEqual([])
    expect(beforeDuration.maps[0].dnd5ePluginAreas?.[0]?.concentrationId).toBe('wall-of-stone')

    const broken = completeDnd5eWallOfStoneForCampaignTime({
      maps: [map([stoneArea()])],
      characters: [wizard({ concentrating: false })],
      worldMinute: 1_010,
    })
    expect(broken.completedAreaIds).toEqual([])
    expect(broken.maps[0].dnd5ePluginAreas?.[0]?.permanent).toBeUndefined()
  })

  it('only converts the completing caster\'s Wall of Stone areas', () => {
    const unrelated = stoneArea({ id: 'other-wall', sourceCharacterId: 'other' })
    const fog = stoneArea({ id: 'fog', coreSpellId: 'fog-cloud', concentrationId: 'fog-cloud' })
    const result = completeDnd5eWallOfStoneForCampaignTime({
      maps: [map([stoneArea(), unrelated, fog])], characters: [wizard()], worldMinute: 1_010,
    })
    expect(result.completedAreaIds).toEqual(['stone-area'])
    expect(result.maps[0].dnd5ePluginAreas?.map((area) => ({
      id: area.id, permanent: area.permanent, concentrationId: area.concentrationId,
    }))).toEqual([
      { id: 'stone-area', permanent: true, concentrationId: undefined },
      { id: 'other-wall', permanent: undefined, concentrationId: 'wall-of-stone' },
      { id: 'fog', permanent: undefined, concentrationId: 'fog-cloud' },
    ])
  })
})
