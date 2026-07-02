import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import type { Character, CombatSkill } from '../types/character'
import type { SharedPlayerActionState } from './sharedCombatTypes'
import { preparePlayerAttackAction } from './playerAttackAction'

function makeSkill(patch: Partial<CombatSkill> = {}): CombatSkill {
  return {
    id: 'skill-1',
    name: 'Skill',
    emoji: '',
    description: '',
    apCost: 1,
    cooldown: 1,
    cdReduction: 0,
    remaining: 0,
    usedThisTurn: false,
    damageCount: 1,
    damageSides: 8,
    damageBonus: 0,
    tags: ['ranged'],
    ...patch,
  }
}

function makeCharacter(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero',
    currentHp: 10,
    currentAP: 2,
    combatSkills: [makeSkill()],
    combatBuffs: {},
    traits: [],
    ...patch,
  } as Character
}

function makeToken(patch: Partial<Token> = {}): Token {
  return {
    id: 'target-token',
    label: 'Target',
    x: 100,
    y: 100,
    color: '#ef4444',
    emoji: '',
    type: 'enemy',
    size: 1,
    hp: 10,
    maxHp: 10,
    ...patch,
  }
}

function makeMap(tokens = [makeToken()]): BattleMap {
  return {
    id: 'map-1',
    name: 'Test Map',
    width: 1000,
    height: 1000,
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    tokens,
  }
}

function makeAction(patch: Partial<SharedPlayerActionState> = {}): SharedPlayerActionState {
  return {
    id: 'action-1',
    mapId: 'map-1',
    combatId: 'combat-1',
    sourceMode: 'player',
    status: 'pending',
    type: 'attack-token',
    actorTokenId: 'hero-token',
    characterId: 'hero',
    targetTokenId: 'target-token',
    skillId: 'skill-1',
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: 1000,
    ...patch,
  }
}

describe('player attack action helpers', () => {
  it('prepares a valid attack request with actor, skill, and target tokens', () => {
    const result = preparePlayerAttackAction({
      action: makeAction(),
      map: makeMap(),
      characters: [makeCharacter()],
    })

    expect(result).toMatchObject({
      ok: true,
      actor: { id: 'hero' },
      skill: { id: 'skill-1' },
      targets: [{ id: 'target-token' }],
      targetIds: ['target-token'],
      waiveAp: false,
      doubleArrow: false,
      isArrowSequence: false,
    })
  })

  it('rejects invalid targets, aoe skills, dead targets, and insufficient AP', () => {
    expect(
      preparePlayerAttackAction({
        action: makeAction({ targetTokenId: undefined }),
        map: makeMap(),
        characters: [makeCharacter()],
      }),
    ).toEqual({ ok: false, reason: 'invalid-attack' })

    expect(
      preparePlayerAttackAction({
        action: makeAction(),
        map: makeMap([makeToken({ hp: 0 })]),
        characters: [makeCharacter()],
      }),
    ).toEqual({ ok: false, reason: 'invalid-attack' })

    expect(
      preparePlayerAttackAction({
        action: makeAction(),
        map: makeMap(),
        characters: [makeCharacter({ combatSkills: [makeSkill({ skillTreeId: 'whirlwindKick' })] })],
      }),
    ).toEqual({ ok: false, reason: 'invalid-attack' })

    expect(
      preparePlayerAttackAction({
        action: makeAction(),
        map: makeMap(),
        characters: [makeCharacter({ currentAP: 0 })],
      }),
    ).toEqual({ ok: false, reason: 'insufficient-ap' })
  })

  it('lets gale combo waive AP and expands repeated arrow sequence targets', () => {
    const skill = makeSkill({ skillTreeId: 'multiShot', arrowShots: 3 })
    const result = preparePlayerAttackAction({
      action: makeAction(),
      map: makeMap(),
      characters: [makeCharacter({ currentAP: 0, combatBuffs: { galeComboReady: true }, combatSkills: [skill] })],
    })

    expect(result).toMatchObject({
      ok: true,
      waiveAp: true,
      isArrowSequence: true,
    })
    expect(result.ok && result.targets.map((target) => target.id)).toEqual([
      'target-token',
      'target-token',
      'target-token',
    ])
  })

  it('detects double arrow readiness for single-arrow basic shots', () => {
    const skill = makeSkill({ skillTreeId: 'basicShot', arrowShots: 1 })
    const result = preparePlayerAttackAction({
      action: makeAction(),
      map: makeMap(),
      characters: [
        makeCharacter({
          combatBuffs: { doubleArrowReady: true },
          combatSkills: [skill],
          traits: [{ id: 'doubleArrow', name: '双箭', level: 1, uses: 1, maxUses: 2, description: '', featureKey: 'doubleArrow' }],
        }),
      ],
    })

    expect(result).toMatchObject({ ok: true, doubleArrow: true })
  })
})
