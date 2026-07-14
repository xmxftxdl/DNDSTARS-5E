import { describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { DND5E_FIGHTER_STARTING_EQUIPMENT } from './equipment'
import { prepareDnd5eEquipmentAttack, previewDnd5eEquipmentAttack, resolvePreparedDnd5eEquipmentAttack } from './equipmentAttackAction'

function fighter(): Character {
  return {
    id: 'fighter', name: '战士', player: '', avatar: '', accent: '', race: '人类', charClass: '战士', level: 5, background: '士兵', experience: 6500, reputation: 0,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, savingThrows: ['str', 'con'], skills: ['athletics'], maxHp: 44, currentHp: 44, tempHp: 0, hitDice: '1d10', ac: 10, speed: 30, initiativeBonus: 0,
    saveDC: 10, actionPoints: 2, currentAP: 2, passivePerception: 10, inspiration: 0, mana: 0, maxMana: 0, traits: [], combatSkills: [], conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    equipment: DND5E_FIGHTER_STARTING_EQUIPMENT,
  }
}

function token(patch: Partial<Token>): Token {
  return { id: 'token', label: 'Token', x: 25, y: 25, color: '', emoji: '', size: 1, type: 'enemy', hp: 20, maxHp: 20, ...patch }
}

function fixture(targetX = 75) {
  const actor = fighter()
  const actorToken = token({ id: 'fighter-token', type: 'player', characterId: actor.id, label: actor.name })
  const targetToken = token({ id: 'enemy-token', label: '哥布林', x: targetX })
  const map: BattleMap = { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [actorToken, targetToken] }
  const action: SharedPlayerActionState = { id: 'action', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-weapon-attack', actorTokenId: actorToken.id, characterId: actor.id, targetTokenId: targetToken.id, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 }
  const initiativeOrder = [
    { tokenId: actorToken.id, label: actor.name, emoji: '', color: '', roll: 20 },
    { tokenId: targetToken.id, label: targetToken.label, emoji: '', color: '', roll: 10 },
  ]
  return { actor, actorToken, targetToken, map, action, initiativeOrder }
}

describe('D&D 5e equipment attack authority', () => {
  it('validates range and resolves equipment damage through the 5e headless engine', () => {
    const input = fixture()
    const prepared = prepareDnd5eEquipmentAttack({ ...input, characters: [input.actor], attacksUsed: 0 })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ distanceFeet: 5, attackNumber: 1, attacksAllowed: 2, targetArmorClass: 10 })
    expect(previewDnd5eEquipmentAttack(prepared.prepared, 15)).toMatchObject({ hit: true, critical: false })
    const resolved = resolvePreparedDnd5eEquipmentAttack({ prepared: prepared.prepared, d20: 15, damageRolls: [5] })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((item) => item.id === input.targetToken.id)?.hp).toBe(12)
    expect(resolved.application?.characters[0].currentAP).toBe(2)
  })

  it('rejects out-of-range melee targets and a spent Attack action', () => {
    const distant = fixture(175)
    expect(prepareDnd5eEquipmentAttack({ ...distant, characters: [distant.actor], attacksUsed: 0 })).toEqual({ ok: false, reason: 'target-out-of-range' })
    const adjacent = fixture()
    expect(prepareDnd5eEquipmentAttack({ ...adjacent, characters: [adjacent.actor], attacksUsed: 2 })).toEqual({ ok: false, reason: 'attack-action-spent' })
  })
})
