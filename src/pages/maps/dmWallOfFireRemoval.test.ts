import { describe, expect, it } from 'vitest'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { removeWallOfFireByDm } from './dmWallOfFireRemoval'

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
})
