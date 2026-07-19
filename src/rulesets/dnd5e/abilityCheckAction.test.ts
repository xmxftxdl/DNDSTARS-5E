import { describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { prepareDnd5eAbilityCheck, previewPreparedDnd5eAbilityCheck, resolvePreparedDnd5eAbilityCheck } from './abilityCheckAction'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'

function bard(): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1', id: 'bard', name: '诗人', player: '', avatar: '', accent: '',
    race: '人类', charClass: '吟游诗人', level: 14, background: '', experience: 0, reputation: 0,
    abilities: { str: 8, dex: 14, con: 12, int: 10, wis: 10, cha: 18 }, savingThrows: ['dex', 'cha'],
    skills: ['performance'], maxHp: 70, currentHp: 70, tempHp: 0, hitDice: '14d8', ac: 14, speed: 30,
    initiativeBonus: 0, saveDC: 17, passivePerception: 10, inspiration: 0,
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    dnd5eClassChoices: { classes: { bard: { subclass: 'lore', selections: { expertise: ['performance'] } } } },
    classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 4 } },
  }
}

function fixture(payload: NonNullable<SharedPlayerActionState['dnd5eAbilityCheck']>) {
  const actor = bard()
  const actorToken: Token = { id: 'bard-token', label: actor.name, x: 25, y: 25, color: '', emoji: '', size: 1, type: 'player', characterId: actor.id }
  const enemyToken: Token = { id: 'enemy-token', label: '敌人', x: 75, y: 25, color: '', emoji: '', size: 1, type: 'enemy', hp: 10, maxHp: 10 }
  const map: BattleMap = { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [actorToken, enemyToken] }
  const action: SharedPlayerActionState = {
    id: 'check', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending',
    type: 'dnd5e-ability-check', actorTokenId: actorToken.id, characterId: actor.id,
    dnd5eAbilityCheck: payload, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
  }
  const initiativeOrder = [
    { tokenId: actorToken.id, label: actor.name, emoji: '', color: '', roll: 20 },
    { tokenId: enemyToken.id, label: enemyToken.label, emoji: '', color: '', roll: 10 },
  ]
  return { actor, action, map, initiativeOrder }
}

describe('D&D 5e ability-check authority bridge', () => {
  it('previews and persists Peerless Skill through the map bridge', () => {
    const input = fixture({ ability: 'cha', skill: 'performance', dc: 20 })
    const prepared = prepareDnd5eAbilityCheck({
      ...input, characters: [input.actor], turnEconomy: createDnd5eTurnEconomyCounts('turn'),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(previewPreparedDnd5eAbilityCheck(prepared.prepared, 2)).toMatchObject({ total: 16, success: false })
    const resolved = resolvePreparedDnd5eAbilityCheck({ prepared: prepared.prepared, d20: 2, peerlessSkillRoll: 6 })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-bardic-inspiration']).toEqual({ current: 1, max: 4 })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', total: 22, success: true, peerlessSkillApplied: 6,
    }))
  })

  it('rejects a mismatched skill ability and an unavailable action', () => {
    const invalid = fixture({ ability: 'str', skill: 'performance', dc: 10 })
    expect(prepareDnd5eAbilityCheck({ ...invalid, characters: [invalid.actor] })).toEqual({ ok: false, reason: 'invalid-action' })

    const actionCheck = fixture({ ability: 'cha', dc: 10, spendAction: true })
    const economy = createDnd5eTurnEconomyCounts('turn')
    economy.action.current = 0
    expect(prepareDnd5eAbilityCheck({
      ...actionCheck, characters: [actionCheck.actor], turnEconomy: economy,
    })).toEqual({ ok: false, reason: 'action-unavailable' })
  })
})
