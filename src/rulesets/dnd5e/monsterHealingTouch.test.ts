import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  createDnd5eConditionEffect,
  createDnd5eMechanicalEffect,
} from './activeEffects'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import { validateDnd5eMonsterSchema } from './monsterSchema'
import { planDnd5eMonsterTurn } from './monsterTurnPlanner'
import type { MonsterDecisionProvider } from './monsterDecisionProvider'
import { getDnd5eSrdMonster } from './monsters'

const abilities = { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 16 } as const

function combatant(id: string, initiative: number, patch: Record<string, unknown> = {}) {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: 'dm',
    initiative,
    abilities,
    proficiencyBonus: 4,
    armorClass: 16,
    currentHp: 100,
    maxHp: 100,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function token(patch: Partial<Token>): Token {
  return {
    id: 'token', label: 'Token', x: 0, y: 0, color: '', emoji: '', size: 1,
    type: 'enemy', hp: 10, maxHp: 10, ...patch,
  }
}

function battleMap(tokens: Token[]): BattleMap {
  return {
    id: 'map', name: 'Map', width: 200, height: 100, gridSize: 10,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens,
  }
}

function character(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero', name: 'Hero', player: 'P1', avatar: '', accent: '', race: '',
    charClass: '', level: 1, background: '', experience: 0, reputation: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [], skills: [], maxHp: 20, currentHp: 20, tempHp: 0,
    hitDice: '1d8', ac: 14, speed: 30, initiativeBonus: 0, saveDC: 10,
    passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '',
    visibleToPlayers: true, ...patch,
  }
}

describe('SRD monster Healing Touch', () => {
  it.each([
    ['deva', 3, 4, 2, ['curse', 'disease', 'poisoned', 'blinded', 'deafened']],
    ['planetar', 4, 6, 3, ['curse', 'disease', 'poisoned', 'blinded', 'deafened']],
    ['solar', 4, 8, 4, ['curse', 'disease', 'poisoned', 'blinded', 'deafened']],
    ['unicorn', 3, 2, 2, ['disease', 'poisoned']],
  ] as const)('publishes strict catalog data for %s', (slug, uses, count, bonus, removes) => {
    const monster = getDnd5eSrdMonster(`srd-5.1:${slug}`)!
    const action = monster.actions.find((candidate) => candidate.id === 'healing-touch')
    expect(action).toMatchObject({
      automation: 'headless',
      usage: { kind: 'per-day', max: uses },
      rule: {
        kind: 'healing-touch',
        rangeFeet: 5,
        target: 'another-living-creature',
        healing: { count, sides: 8, bonus },
        removes,
      },
    })
    expect(validateDnd5eMonsterSchema(monster)).toEqual([])
  })

  it('rejects a saved Healing Touch rule that widens its authoritative reach', () => {
    const monster = structuredClone(getDnd5eSrdMonster('srd-5.1:deva')!)
    const action = monster.actions.find((candidate) => candidate.id === 'healing-touch')!
    Reflect.set(action.rule!, 'rangeFeet', 10)
    expect(validateDnd5eMonsterSchema(monster)).toContainEqual(expect.objectContaining({
      actionId: 'healing-touch',
      code: 'invalid-stat-block',
    }))
  })

  it('heals another living creature, removes only declared effects, and spends action and use', () => {
    const effects = [
      createDnd5eConditionEffect({
        condition: 'poisoned', source: { kind: 'monster' }, targetId: 'ally',
      }),
      createDnd5eConditionEffect({
        condition: 'blinded', source: { kind: 'monster' }, targetId: 'ally',
      }),
      createDnd5eMechanicalEffect({
        definitionId: 'test:disease', label: 'Disease', source: { kind: 'monster' },
        targetId: 'ally', legacyCondition: 'disease',
      }),
      createDnd5eMechanicalEffect({
        definitionId: 'test:curse', label: 'Curse', source: { kind: 'monster' },
        targetId: 'ally', legacyCondition: 'curse',
      }),
    ]
    const deva = combatant('deva', 20, {
      statBlockId: 'srd-5.1:deva',
      classState: { monsterActionUsesByActionId: { 'healing-touch': { current: 3, max: 3 } } },
    })
    const ally = combatant('ally', 10, {
      currentHp: 20,
      position: { x: 5, y: 0 },
      classState: { activeEffects: effects },
    })
    const state = startDnd5eHeadlessCombat('healing-touch', [deva, ally])
    state.distanceFeetByCombatantPair = { ['ally\u0000deva']: 5 }
    const result = resolveDnd5eHeadlessAction(
      state,
      {
        type: 'monster-special-action', actorId: 'deva', actionId: 'healing-touch',
        targetId: 'ally', damageRolls: [8, 7, 6, 5],
      },
    )
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.ally.currentHp).toBe(48)
    expect(result.state.combatants.ally.classState.activeEffects).toBeUndefined()
    expect(result.state.combatants.deva.turn.actionAvailable).toBe(false)
    expect(result.state.combatants.deva.classState.monsterActionUsesByActionId?.['healing-touch'].current).toBe(2)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'monster-special-action-resolved', actionId: 'healing-touch',
      targetId: 'ally', healing: 28,
    }))
  })

  it('keeps conditions outside the unicorn declaration and rejects forged targets or dice without spending', () => {
    const unicorn = combatant('unicorn', 20, {
      statBlockId: 'srd-5.1:unicorn',
      classState: { monsterActionUsesByActionId: { 'healing-touch': { current: 3, max: 3 } } },
    })
    const ally = combatant('ally', 10, {
      currentHp: 50,
      position: { x: 5, y: 0 },
      classState: { activeEffects: [
        createDnd5eConditionEffect({
          condition: 'blinded', source: { kind: 'monster' }, targetId: 'ally',
        }),
        createDnd5eMechanicalEffect({
          definitionId: 'test:curse', label: 'Curse', source: { kind: 'monster' },
          targetId: 'ally', legacyCondition: 'curse',
        }),
      ] },
    })
    const state = startDnd5eHeadlessCombat('unicorn-touch', [unicorn, ally])
    state.distanceFeetByCombatantPair = { ['ally\u0000unicorn']: 5 }
    expect(resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action', actorId: 'unicorn', actionId: 'healing-touch',
      targetId: 'unicorn', damageRolls: [8, 8],
    })).toMatchObject({ ok: false })
    expect(state.combatants.unicorn.classState.monsterActionUsesByActionId?.['healing-touch'].current).toBe(3)
    expect(resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action', actorId: 'unicorn', actionId: 'healing-touch',
      targetId: 'ally', damageRolls: [9, 1],
    })).toMatchObject({ ok: false })
    expect(state.combatants.unicorn.classState.monsterActionUsesByActionId?.['healing-touch'].current).toBe(3)

    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action', actorId: 'unicorn', actionId: 'healing-touch',
      targetId: 'ally', damageRolls: [4, 4],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.ally.conditions).toContain('blinded')
    expect(result.state.combatants.ally.classState.activeEffects).toHaveLength(2)
  })

  it.each(['undead', 'construct'] as const)(
    'honors the SRD another-creature wording for a living %s target',
    (creatureType) => {
      const deva = combatant('deva', 20, {
        statBlockId: 'srd-5.1:deva',
        classState: { monsterActionUsesByActionId: { 'healing-touch': { current: 3, max: 3 } } },
      })
      const target = combatant('target', 10, {
        currentHp: 50,
        creatureType,
        position: { x: 5, y: 0 },
      })
      const state = startDnd5eHeadlessCombat(`healing-touch-${creatureType}`, [deva, target])
      state.distanceFeetByCombatantPair = { ['deva\u0000target']: 5 }
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-special-action', actorId: 'deva', actionId: 'healing-touch',
        targetId: 'target', damageRolls: [1, 1, 1, 1],
      })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.state.combatants.target.currentHp).toBe(56)
    },
  )

  it('rejects a zero-HP/dead target without consuming the daily use', () => {
    const deva = combatant('deva', 20, {
      statBlockId: 'srd-5.1:deva',
      classState: { monsterActionUsesByActionId: { 'healing-touch': { current: 3, max: 3 } } },
    })
    const target = combatant('target', 10, {
      currentHp: 0,
      position: { x: 5, y: 0 },
    })
    const state = startDnd5eHeadlessCombat('healing-touch-dead', [deva, target])
    state.distanceFeetByCombatantPair = { ['deva\u0000target']: 5 }
    expect(resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action', actorId: 'deva', actionId: 'healing-touch',
      targetId: 'target', damageRolls: [1, 1, 1, 1],
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(state.combatants.deva.classState.monsterActionUsesByActionId?.['healing-touch'].current).toBe(3)
  })

  it('planner selects only a wounded reachable ally and emits an executable special-action payload', () => {
    const deva = token({
      id: 'deva', label: 'Deva', poolId: 'srd-5.1:deva', hp: 136, maxHp: 136,
      dnd5eCombatState: {
        schemaVersion: 2,
        monsterActionUsesByActionId: { 'healing-touch': { current: 3, max: 3 } },
      },
    })
    const ally = token({ id: 'ally', label: 'Ally', type: 'enemy', x: 10, hp: 5, maxHp: 100 })
    const hostile = token({
      id: 'hostile', label: 'Hostile', type: 'player', characterId: 'hostile-character',
      x: 10, hp: 1, maxHp: 100,
    })
    const plan = planDnd5eMonsterTurn(
      battleMap([deva, ally, hostile]),
      deva,
      [character({ id: 'hostile-character', currentHp: 1, maxHp: 100 })],
      {
        decisionProvider: {
          id: 'prefer-healing-touch',
          schemaVersion: 1,
          scoreCandidate: (_context, candidate) => ({
            candidateId: candidate.id,
            score: candidate.id.startsWith('heal-touch:') ? 1_000_000 : 0,
            reasons: [],
          }),
        } satisfies MonsterDecisionProvider,
      },
    )
    expect(plan.specialAction).toEqual(expect.objectContaining({
      actionId: 'healing-touch', targetTokenId: 'ally',
      healing: { diceCount: 4, diceSides: 8, bonus: 2 },
    }))
    expect(plan.targetTokenId).toBe('ally')
  })
})
