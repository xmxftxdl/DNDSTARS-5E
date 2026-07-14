import { describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { DND5E_FIGHTER_STARTING_EQUIPMENT } from './equipment'
import { FIGHTER_RESOURCE_KEYS } from './fighter'
import { prepareDnd5eFighterFeature, resolvePreparedDnd5eFighterFeature } from './fighterFeatureAction'

function fighter(): Character {
  return {
    id: 'fighter', name: '战士', player: '', avatar: '', accent: '', race: '人类', charClass: '战士', level: 5, background: '士兵', experience: 6500, reputation: 0,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, savingThrows: ['str', 'con'], skills: ['athletics'], maxHp: 44, currentHp: 20, tempHp: 0, hitDice: '5d10', ac: 18, speed: 30, initiativeBonus: 0,
    saveDC: 10, actionPoints: 2, currentAP: 2, passivePerception: 10, inspiration: 0, mana: 0, maxMana: 0, traits: [], combatSkills: [], conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    equipment: DND5E_FIGHTER_STARTING_EQUIPMENT,
    classResources: {
      [FIGHTER_RESOURCE_KEYS.secondWind]: { current: 1, max: 1 },
      [FIGHTER_RESOURCE_KEYS.actionSurge]: { current: 1, max: 1 },
    },
  }
}

function fixture(feature: 'second-wind' | 'action-surge') {
  const actor = fighter()
  const actorToken: Token = { id: 'fighter-token', label: actor.name, x: 25, y: 25, color: '', emoji: '', size: 1, type: 'player', characterId: actor.id }
  const targetToken: Token = { id: 'enemy-token', label: '哥布林', x: 75, y: 25, color: '', emoji: '', size: 1, type: 'enemy', hp: 10, maxHp: 10 }
  const map: BattleMap = { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [actorToken, targetToken] }
  const action: SharedPlayerActionState = { id: 'action', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-fighter-feature', actorTokenId: actorToken.id, characterId: actor.id, dnd5eFighterFeature: feature, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 }
  const initiativeOrder = [
    { tokenId: actorToken.id, label: actor.name, emoji: '', color: '', roll: 20 },
    { tokenId: targetToken.id, label: targetToken.label, emoji: '', color: '', roll: 10 },
  ]
  return { actor, map, action, initiativeOrder }
}

describe('D&D 5e fighter feature authority', () => {
  it('resolves Second Wind in headless, spends its short-rest resource, and never touches AP', () => {
    const input = fixture('second-wind')
    const prepared = prepareDnd5eFighterFeature({ ...input, characters: [input.actor], actionSurgeAlreadyUsed: false })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eFighterFeature({ prepared: prepared.prepared, d10: 7 })
    expect(resolved.result.ok).toBe(true)
    const actor = resolved.application?.characters.find((character) => character.id === input.actor.id)
    expect(actor).toMatchObject({ currentHp: 32, currentAP: 2 })
    expect(actor?.classResources?.[FIGHTER_RESOURCE_KEYS.secondWind]).toEqual({ current: 0, max: 1 })
  })

  it('spends Action Surge once and rejects a second use in the same turn', () => {
    const input = fixture('action-surge')
    const prepared = prepareDnd5eFighterFeature({ ...input, characters: [input.actor], actionSurgeAlreadyUsed: false })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eFighterFeature({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].classResources?.[FIGHTER_RESOURCE_KEYS.actionSurge]).toEqual({ current: 0, max: 1 })
    expect(prepareDnd5eFighterFeature({ ...input, characters: [input.actor], actionSurgeAlreadyUsed: true })).toEqual({ ok: false, reason: 'feature-already-used' })
  })
})
