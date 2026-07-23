import { afterEach, describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { createDnd5eConditionEffect } from './activeEffects'
import { buildDnd5eCustomMonster, createDnd5eCustomMonsterDraft, createDnd5eCustomMonsterMechanicDraft } from './customMonsterWorkshop'
import { prepareDnd5ePlayerEndTurn, resolveDnd5ePlayerEndTurn } from './endTurnAction'
import { setDnd5eRoomMonsterCatalog } from './monsters'

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
  afterEach(() => setDnd5eRoomMonsterCatalog([]))

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

  it('resolves monster regeneration and recharge at the next turn boundary', () => {
    const input = fixture(barbarian(false))
    const troll = input.map.tokens[1]
    troll.poolId = 'srd-5.1:troll'
    troll.hp = 20
    troll.maxHp = 84

    const regenerated = resolveDnd5ePlayerEndTurn(input)
    expect(regenerated.ok).toBe(true)
    if (!regenerated.ok) return
    expect(regenerated.application.map.tokens.find((token) => token.id === troll.id)?.hp).toBe(30)
    expect(regenerated.result.events).toContainEqual({
      type: 'monster-regenerated', actorId: troll.id, amount: 10, hpAfter: 30,
    })

    troll.poolId = 'srd-5.1:adult-black-dragon'
    troll.hp = 195
    troll.maxHp = 195
    troll.dnd5eCombatState = { monsterRechargeReadyByActionId: { 'acid-breath': false } }
    const prepared = prepareDnd5ePlayerEndTurn(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.nextMonsterRechargeRolls).toEqual([expect.objectContaining({
      actorId: troll.id, actionId: 'acid-breath', dieSides: 6, minimum: 5,
    })])
    const recharged = resolveDnd5ePlayerEndTurn({
      ...input,
      nextMonsterRechargeRolls: [{ actorId: troll.id, actionId: 'acid-breath', roll: 5 }],
    })
    expect(recharged.ok).toBe(true)
    if (!recharged.ok) return
    expect(recharged.application.map.tokens.find((token) => token.id === troll.id)?.dnd5eCombatState)
      .toMatchObject({ monsterRechargeReadyByActionId: { 'acid-breath': true } })
    expect(recharged.result.events).toContainEqual({
      type: 'monster-recharge-resolved', actorId: troll.id, actionId: 'acid-breath', roll: 5, ready: true,
    })
  })

  it('rolls and applies an eligible custom monster healing mechanism exactly once per combat', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.name = '浴血守卫'
    draft.hitPointsAverage = 30
    draft.headlessMechanics = [{
      ...createDnd5eCustomMonsterMechanicDraft(),
      id: 'bloodied-recovery',
      name: '浴血恢复',
      hpPercentageAtOrBelow: 50,
      healingDice: '2d6',
      limit: 'once-per-combat',
    }]
    const monster = buildDnd5eCustomMonster(draft)
    setDnd5eRoomMonsterCatalog([monster])
    const input = fixture(barbarian(false))
    const monsterToken = input.map.tokens[1]
    monsterToken.poolId = monster.id
    monsterToken.hp = 10
    monsterToken.maxHp = 30

    const prepared = prepareDnd5ePlayerEndTurn(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.nextMonsterMechanicRolls).toEqual([{
      actorId: monsterToken.id,
      actorName: monsterToken.label,
      mechanicId: 'bloodied-recovery',
      mechanicName: '浴血恢复',
      effects: [{ effectId: 'effect-0', effectName: '治疗', count: 2, sides: 6, bonus: 0 }],
    }])
    expect(resolveDnd5ePlayerEndTurn(input)).toEqual({ ok: false, reason: 'invalid-action' })

    const resolved = resolveDnd5ePlayerEndTurn({
      ...input,
      nextMonsterMechanicRolls: [{
        actorId: monsterToken.id,
        mechanicId: 'bloodied-recovery',
        effectRolls: [{ effectId: 'effect-0', rolls: [3, 4] }],
      }],
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.application.map.tokens.find((token) => token.id === monsterToken.id)?.hp).toBe(17)
    expect(resolved.result.events).toContainEqual({
      type: 'monster-mechanic-v2-triggered',
      actorId: monsterToken.id,
      mechanicId: 'bloodied-recovery',
      mechanicName: '浴血恢复',
      trigger: 'turn-start',
      outcomes: [{ effectId: 'effect-0', kind: 'healing', targetId: monsterToken.id, amount: 7 }],
    })

    const nextInput = {
      ...input,
      map: resolved.application.map,
      action: { ...input.action, round: input.action.round + 1, seq: input.action.seq + 1 },
    }
    const preparedAgain = prepareDnd5ePlayerEndTurn(nextInput)
    expect(preparedAgain.ok).toBe(true)
    if (!preparedAgain.ok) return
    expect(preparedAgain.prepared.nextMonsterMechanicRolls).toEqual([])
  })

  it('applies V2 temporary hit points and a standard condition at the monster turn end', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.name = '暮影守卫'
    draft.headlessMechanics = [{
      ...createDnd5eCustomMonsterMechanicDraft(),
      id: 'shadow-ward',
      name: '暮影护持',
      trigger: 'turn-end',
      effectKind: 'temporary-hit-points',
      healingDice: '1d8+2',
      hpPercentageAtOrBelow: 100,
      limit: 'once-per-turn',
      preservedEffects: [
        { id: 'effect-0', kind: 'temporary-hit-points', target: 'self', dice: { count: 1, sides: 8, bonus: 2 } },
        { id: 'warded', kind: 'standard-condition', target: 'self', condition: 'invisible', duration: { kind: 'until-source-turn-start' } },
      ],
    }]
    const monster = buildDnd5eCustomMonster(draft)
    setDnd5eRoomMonsterCatalog([monster])
    const input = fixture(barbarian(false))
    const monsterToken = input.map.tokens[1]
    monsterToken.poolId = monster.id
    monsterToken.hp = monster.hitPoints.average
    monsterToken.maxHp = monster.hitPoints.average
    input.initiativeOrder = [input.initiativeOrder[1], input.initiativeOrder[0]]
    input.action = {
      ...input.action,
      id: 'monster-end',
      sourceMode: 'dm',
      actorTokenId: monsterToken.id,
      characterId: '',
      initiativeIndex: 0,
    }

    const prepared = prepareDnd5ePlayerEndTurn(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.currentMonsterMechanicRolls).toEqual([expect.objectContaining({
      actorId: monsterToken.id,
      mechanicId: 'shadow-ward',
      effects: [{ effectId: 'effect-0', effectName: '临时生命', count: 1, sides: 8, bonus: 2 }],
    })])
    const resolved = resolveDnd5ePlayerEndTurn({
      ...input,
      currentMonsterMechanicRolls: [{
        actorId: monsterToken.id,
        mechanicId: 'shadow-ward',
        effectRolls: [{ effectId: 'effect-0', rolls: [6] }],
      }],
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    const settledMonster = resolved.application.map.tokens.find((entry) => entry.id === monsterToken.id)
    expect(settledMonster?.dnd5eCombatState?.temporaryHp).toBe(8)
    expect(settledMonster?.dnd5eCombatState?.activeEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({ standardCondition: 'invisible' }),
    ]))
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'monster-mechanic-v2-triggered', mechanicId: 'shadow-ward', trigger: 'turn-end',
    }))
  })

  it('keeps V1 monster healing mechanisms executable with their legacy roll payload', () => {
    const base = buildDnd5eCustomMonster(createDnd5eCustomMonsterDraft())
    const monster = {
      ...base,
      headlessMechanics: [{
        schemaVersion: 1 as const,
        id: 'legacy-recovery',
        name: '旧版恢复',
        event: 'turn-start' as const,
        predicates: { hpPercentageAtOrBelow: 100, requiresPositiveHp: true },
        effect: { kind: 'healing' as const, dice: { count: 1, sides: 6, bonus: 0 } },
        limit: 'once-per-combat' as const,
        automation: 'headless' as const,
      }],
    }
    setDnd5eRoomMonsterCatalog([monster])
    const input = fixture(barbarian(false))
    const monsterToken = input.map.tokens[1]
    monsterToken.poolId = monster.id
    monsterToken.hp = 4
    monsterToken.maxHp = monster.hitPoints.average
    const resolved = resolveDnd5ePlayerEndTurn({
      ...input,
      nextMonsterMechanicRolls: [{
        actorId: monsterToken.id,
        mechanicId: 'legacy-recovery',
        rolls: [5],
      }],
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.result.events).toContainEqual({
      type: 'monster-mechanic-triggered', actorId: monsterToken.id,
      mechanicId: 'legacy-recovery', mechanicName: '旧版恢复', amount: 5, hpAfter: 9,
    })
  })

  it('suppresses troll regeneration after acid or fire damage state', () => {
    const input = fixture(barbarian(false))
    const troll = input.map.tokens[1]
    troll.poolId = 'srd-5.1:troll'
    troll.hp = 20
    troll.maxHp = 84
    troll.dnd5eCombatState = { monsterRegenerationSuppressedDamageTypes: ['fire'] }

    const resolved = resolveDnd5ePlayerEndTurn(input)
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.application.map.tokens.find((token) => token.id === troll.id)?.hp).toBe(20)
    expect(resolved.result.events).toContainEqual({
      type: 'monster-regeneration-suppressed', actorId: troll.id, damageTypes: ['fire'], died: false,
    })
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
