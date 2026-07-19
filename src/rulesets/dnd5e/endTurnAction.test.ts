import { describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { createDnd5eConditionEffect } from './activeEffects'
import { prepareDnd5ePlayerEndTurn, resolveDnd5ePlayerEndTurn } from './endTurnAction'

function barbarian(sustained: boolean): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1', id: 'barbarian', name: '野蛮人', player: '', avatar: '', accent: '',
    race: '人类', charClass: '野蛮人', level: 5, background: '', experience: 0, reputation: 0,
    abilities: { str: 16, dex: 14, con: 16, int: 8, wis: 10, cha: 8 }, savingThrows: ['str', 'con'], skills: [],
    maxHp: 55, currentHp: 55, tempHp: 0, hitDice: '5d12', ac: 15, speed: 30, initiativeBonus: 0,
    saveDC: 10, passivePerception: 10, inspiration: 0, 
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    dnd5eCombatState: { raging: true, rageTurnsRemaining: 10, rageSustainedThisTurn: sustained },
  }
}

function fixture(actor: Character) {
  const actorToken: Token = { id: 'barbarian-token', label: actor.name, x: 25, y: 25, color: '', emoji: '', size: 1, type: 'player', characterId: actor.id }
  const enemy: Token = { id: 'enemy-token', label: '敌人', x: 75, y: 25, color: '', emoji: '', size: 1, type: 'enemy', hp: 10, maxHp: 10 }
  const map: BattleMap = { id: 'map', name: 'Map', width: 200, height: 200, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [actorToken, enemy] }
  const action: SharedPlayerActionState = {
    id: 'end', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'end-turn',
    actorTokenId: actorToken.id, characterId: actor.id, round: 3, initiativeIndex: 0, seq: 1, updatedAt: 1,
  }
  const initiativeOrder = [
    { tokenId: actorToken.id, label: actorToken.label, emoji: '', color: '', roll: 20 },
    { tokenId: enemy.id, label: enemy.label, emoji: '', color: '', roll: 10 },
  ]
  return { action, map, characters: [actor], initiativeOrder }
}

describe('D&D 5e map end-turn authority bridge', () => {
  it('persists a sustained Rage countdown through the map application', () => {
    const resolved = resolveDnd5ePlayerEndTurn(fixture(barbarian(true)))
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.application.characters[0].dnd5eCombatState).toMatchObject({
      raging: true, rageTurnsRemaining: 9, rageSustainedThisTurn: false,
    })
  })

  it('ends Rage when the turn had neither an attack nor incoming damage', () => {
    const resolved = resolveDnd5ePlayerEndTurn(fixture(barbarian(false)))
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.application.characters[0].dnd5eCombatState?.raging).toBeUndefined()
    expect(resolved.result.events).toContainEqual({ type: 'class-state-changed', actorId: 'barbarian-token', stateKey: 'rage', active: false })
  })

  it('adds one persistent exhaustion level when a Frenzy ends', () => {
    const actor = barbarian(false)
    actor.exhaustionLevel = 1
    actor.dnd5eCombatState = {
      ...actor.dnd5eCombatState,
      frenzying: true,
      frenzyStartedTurnKey: 'combat:3:barbarian-token',
    }
    const resolved = resolveDnd5ePlayerEndTurn(fixture(actor))
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.application.characters[0].exhaustionLevel).toBe(2)
    expect(resolved.result.events).toContainEqual({ type: 'exhaustion-gained', actorId: 'barbarian-token', level: 2 })
  })

  it('still permits an unconscious 5e combatant to end its initiative turn', () => {
    const actor = barbarian(false)
    actor.currentHp = 0
    actor.dnd5eCombatState = undefined
    expect(resolveDnd5ePlayerEndTurn(fixture(actor))).toMatchObject({ ok: true })
  })

  it('ends Stunning Strike on the Monk\'s next turn end and persists the cleared token state', () => {
    const actor = barbarian(false)
    actor.id = 'monk'
    actor.name = '武僧'
    actor.charClass = '武僧'
    actor.level = 5
    actor.classResources = { 'dnd5e-ki': { current: 4, max: 5 } }
    actor.dnd5eCombatState = undefined
    const input = fixture(actor)
    input.map.tokens[1].dnd5eCombatState = {
      stunnedByActorId: 'barbarian-token',
      stunnedAppliedTurnKey: 'combat:2:barbarian-token',
    }

    const resolved = resolveDnd5ePlayerEndTurn(input)
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.application.map.tokens.find((entry) => entry.id === 'enemy-token')?.dnd5eCombatState)
      .toEqual({ schemaVersion: 2 })
    expect(resolved.result.events).toContainEqual({ type: 'condition-ended', targetId: 'enemy-token', condition: '震慑' })
  })

  it('does not end Stunning Strike on the same turn in which it was applied', () => {
    const actor = barbarian(false)
    actor.id = 'monk'
    actor.name = '武僧'
    actor.charClass = '武僧'
    actor.level = 5
    actor.dnd5eCombatState = undefined
    const input = fixture(actor)
    input.map.tokens[1].dnd5eCombatState = {
      stunnedByActorId: 'barbarian-token',
      stunnedAppliedTurnKey: 'combat:3:barbarian-token',
    }

    const resolved = resolveDnd5ePlayerEndTurn(input)
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.application.map.tokens.find((entry) => entry.id === 'enemy-token')?.dnd5eCombatState)
      .toMatchObject({ stunnedByActorId: 'barbarian-token', stunnedAppliedTurnKey: 'combat:3:barbarian-token' })
    expect(resolved.result.events).not.toContainEqual(expect.objectContaining({ type: 'condition-ended' }))
  })

  it('runs a persisted Sunburst repeat save for an unlinked SRD monster', () => {
    const actor = barbarian(false)
    const input = fixture(actor)
    const monster = input.map.tokens[1]
    monster.poolId = 'srd-5.1:skeleton'
    monster.dnd5eCombatState = {
      conditions: ['blinded'],
      schemaVersion: 2,
      activeEffects: [createDnd5eConditionEffect({
        id: 'sunburst:caster:enemy-token',
        condition: 'blinded',
        targetId: monster.id,
        source: { kind: 'spell', actorId: 'caster', rulesId: 'sunburst' },
        duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
        repeatSave: { ability: 'con', dc: 15, timing: 'target-turn-end', onSuccess: 'remove' },
        appliedAt: 1,
      })],
    }
    input.action = { ...input.action, actorTokenId: monster.id, characterId: '', initiativeIndex: 1 }
    const prepared = prepareDnd5ePlayerEndTurn(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      actor: undefined,
      actorName: '敌人',
      activeEffectSavingThrows: [{ mode: 'disadvantage', dc: 15 }],
    })
    const effectId = prepared.prepared.activeEffectSavingThrows[0].effect.id
    const resolved = resolveDnd5ePlayerEndTurn({
      ...input,
      activeEffectSavingThrows: [{ effectId, d20: 20, d20Second: 20 }],
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.application.map.tokens.find((token) => token.id === monster.id)?.dnd5eCombatState)
      .toMatchObject({ schemaVersion: 2 })
  })
})
