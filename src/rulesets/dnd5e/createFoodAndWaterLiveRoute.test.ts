import { describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import { normalizeCharacter } from '../../store/characters'
import type { BattleMap, Token } from '../../store/maps'
import { ensureDnd5eCoreSpellActivitiesRegisteredV1 } from './activities/dnd5eCoreSpellActivities'
import {
  prepareDnd5ePluginSpellCast,
  resolvePreparedDnd5ePluginSpellCast,
} from './pluginSpellTransaction'

describe('Create Food and Water live spell route', () => {
  it('settles the spell wrapper and exposes both Host inventory grants', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const actor = normalizeCharacter({
      id: 'create-food-cleric', name: '造粮术测试牧师', player: '', charClass: '牧师',
      level: 20, maxHp: 100, currentHp: 100, equipment: {},
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 20, cha: 10 },
      dnd5eClassLevels: { cleric: 20 },
      dnd5eClassChoices: {
        classes: { cleric: { selections: { 'spell-prepared': ['create-food-and-water'] } } },
      },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const actorToken: Token = {
      id: 'create-food-cleric-token', label: actor.name, x: 25, y: 25,
      color: '', emoji: '', size: 1, type: 'player', characterId: actor.id,
      hp: actor.currentHp, maxHp: actor.maxHp,
    }
    const map: BattleMap = {
      id: 'create-food-map', name: 'Create Food Map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken],
    }
    const action: SharedPlayerActionState = {
      id: 'create-food-live-wrapper', mapId: map.id,
      sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast',
      actorTokenId: actorToken.id, characterId: actor.id,
      targetTokenId: actorToken.id, targetTokenIds: [actorToken.id],
      dnd5eSpellCast: {
        spellId: 'create-food-and-water', castingClassId: 'cleric', slotLevel: 3,
        targetTokenId: actorToken.id, targetTokenIds: [actorToken.id],
      },
      round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
    }
    const prepared = prepareDnd5ePluginSpellCast({
      action, map, characters: [actor],
      initiativeOrder: [{ tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20 }],
      roomRequiredPlugins: [],
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: {} })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants[actorToken.id]?.classResources['dnd5e-spell-slot-3']?.current).toBe(0)
    expect(resolved.result.activityHandoffs?.inventoryGrants).toEqual([
      expect.objectContaining({
        templateId: 'srd-5.1:item:conjured-food-portion', quantity: 15, expiresAfterMinutes: 1_440,
      }),
      expect.objectContaining({
        templateId: 'srd-5.1:item:conjured-water-gallon', quantity: 30, expiresAfterMinutes: undefined,
      }),
    ])
  })
})
