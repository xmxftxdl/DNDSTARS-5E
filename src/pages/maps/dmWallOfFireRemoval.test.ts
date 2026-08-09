import { describe, expect, it } from 'vitest'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { removePersistentAreaByDm, removeWallOfFireByDm } from './dmWallOfFireRemoval'

describe('DM Wall of Fire removal', () => {
  it('removes only the selected wall and ends its matching source concentration', () => {
    const character = {
      id: 'caster', name: 'Caster', concentrating: true,
      dnd5eCombatState: { concentrationSpellId: 'wall-of-fire', concentrationSpellLevel: 4, concentrationRoundsRemaining: 10 },
    } as Character
    const map = {
      id: 'map', tokens: [{ id: 'caster-token', characterId: 'caster', label: 'Caster', type: 'player', x: 0, y: 0, size: 1 }],
      dnd5ePluginAreas: [{ id: 'wall', pluginId: 'srd-5.1', featureId: 'wall', sourceKind: 'core-spell', coreSpellId: 'wall-of-fire', label: '火墙术', color: '#ff0000', sourceCharacterId: 'caster', sourceTokenId: 'caster-token', cells: [{ col: 1, row: 1 }], createdRound: 1, expiresAfterRound: 10 }],
    } as BattleMap
    const result = removeWallOfFireByDm({ map, characters: [character], areaId: 'wall' })
    expect(result?.map.dnd5ePluginAreas).toEqual([])
    expect(result?.character?.concentrating).toBe(false)
    expect(result?.character?.dnd5eCombatState?.concentrationSpellId).toBeUndefined()
  })

  it('does not end a newer concentration spell or delete non-wall areas', () => {
    const character = { id: 'caster', concentrating: true, dnd5eCombatState: { concentrationSpellId: 'bless' } } as Character
    const map = { id: 'map', tokens: [], dnd5ePluginAreas: [] } as unknown as BattleMap
    expect(removeWallOfFireByDm({ map, characters: [character], areaId: 'missing' })).toBeUndefined()
  })

  it('lets the DM remove Darkness while preserving a newer concentration', () => {
    const character = {
      id: 'caster', name: 'Caster', concentrating: true,
      dnd5eCombatState: { concentrationSpellId: 'fly', concentrationSpellLevel: 3 },
    } as Character
    const map = {
      id: 'map',
      tokens: [{ id: 'caster-token', characterId: 'caster', label: 'Caster', type: 'player', x: 0, y: 0, size: 1 }],
      dnd5ePluginAreas: [{
        id: 'darkness', pluginId: 'srd-5.1', featureId: 'darkness', sourceKind: 'core-spell',
        coreSpellId: 'darkness', concentrationId: 'darkness', label: '黑暗术', color: '#581c87',
        sourceCharacterId: 'caster', sourceTokenId: 'caster-token', cells: [{ col: 1, row: 1 }],
        createdRound: 1, expiresAfterRound: 10,
      }],
    } as BattleMap

    const result = removePersistentAreaByDm({ map, characters: [character], areaId: 'darkness' })

    expect(result?.map.dnd5ePluginAreas).toEqual([])
    expect(result?.character).toBe(character)
    expect(result?.concentrationEnded).toBe(false)
  })

  it('removes an effect-token anchor and all of its attached persistent areas', () => {
    const map = {
      id: 'map',
      tokens: [
        { id: 'caster-token', label: 'Caster', type: 'enemy', x: 0, y: 0, size: 1 },
        { id: 'effect-token', label: 'Effect', type: 'obstacle', x: 50, y: 50, size: 1, dnd5eSpellEffect: {
          schemaVersion: 1, spellId: 'flaming-sphere', sourceCharacterId: 'monster',
          sourceTokenId: 'caster-token', createdRound: 1, expiresAfterRound: 10,
          concentrationId: 'flaming-sphere',
        } },
      ],
      dnd5ePluginAreas: ['a', 'b'].map((id) => ({
        id, pluginId: 'srd-5.1', featureId: 'sphere', sourceKind: 'core-spell' as const,
        coreSpellId: 'flaming-sphere', concentrationId: 'flaming-sphere', label: '炽焰法球',
        color: '#f97316', sourceCharacterId: 'monster', sourceTokenId: 'caster-token',
        anchorMode: 'effect-token' as const, anchorTokenId: 'effect-token',
        cells: [{ col: 1, row: 1 }], createdRound: 1, expiresAfterRound: 10,
      })),
    } as BattleMap

    const result = removePersistentAreaByDm({ map, characters: [], areaId: 'a' })

    expect(result?.map.dnd5ePluginAreas).toEqual([])
    expect(result?.map.tokens.map((token) => token.id)).toEqual(['caster-token'])
  })
})
