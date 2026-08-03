import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import {
  createDnd5eCombatant,
  dnd5eAbilityCheckRollMode,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import {
  DND5E_MONSTER_BERSERK_TURN_START_ROLL_ID,
} from './monsterGenericAbilities'
import { selectDnd5eMonsterPreferredTarget } from './monsterAutomation'
import { planDnd5eMonsterTurn } from './monsterTurnPlanner'
import { getDnd5eSrdMonsterBySlug } from './monsters'

function combatant(input: {
  id: string
  controller: 'dm' | 'player'
  initiative: number
  statBlockId?: string
  currentHp?: number
  maxHp?: number
  classState?: Partial<Dnd5eCombatant['classState']>
  classId?: Dnd5eCombatant['classId']
}): Dnd5eCombatant {
  return createDnd5eCombatant({
    id: input.id,
    name: input.id,
    controller: input.controller,
    initiative: input.initiative,
    abilities: { str: 19, dex: 9, con: 18, int: 6, wis: 10, cha: 5 },
    proficiencyBonus: 3,
    armorClass: input.statBlockId ? 9 : 16,
    currentHp: input.currentHp ?? 40,
    maxHp: input.maxHp ?? 40,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    statBlockId: input.statBlockId,
    classState: input.classState,
    classId: input.classId,
  })
}

function damageFleshGolem(input: {
  currentHp: number
  damage: number
  damageType: 'fire' | 'lightning'
  classState?: Partial<Dnd5eCombatant['classState']>
}) {
  const state = startDnd5eHeadlessCombat('flesh-golem-damage', [
    combatant({ id: 'hero', controller: 'player', initiative: 20, classId: 'wizard' }),
    combatant({
      id: 'golem',
      controller: 'dm',
      initiative: 10,
      statBlockId: 'srd-5.1:flesh-golem',
      currentHp: input.currentHp,
      maxHp: 93,
      classState: input.classState,
    }),
  ])
  return resolveDnd5eHeadlessAction(state, {
    type: 'attack',
    actorId: 'hero',
    targetId: 'golem',
    attackModifier: 20,
    d20: 10,
    spendAction: false,
    damage: {
      count: 1,
      sides: 100,
      bonus: 0,
      rolls: [input.damage],
      type: input.damageType,
    },
  })
}

function token(patch: Partial<Token>): Token {
  return {
    id: 'token',
    label: 'Token',
    x: 0,
    y: 0,
    color: '',
    emoji: '',
    size: 1,
    type: 'enemy',
    hp: 10,
    maxHp: 10,
    ...patch,
  }
}

describe('Flesh Golem Headless automation', () => {
  it('declares every combat trait and its Multiattack as Headless', () => {
    const golem = getDnd5eSrdMonsterBySlug('flesh-golem')
    expect(golem).toBeDefined()
    expect(golem?.traits.map((trait) => trait.rule?.kind)).toEqual([
      'berserk',
      'damage-aversion',
      'immutable-form',
      'damage-absorption',
      'magic-resistance',
      'magic-weapons',
    ])
    expect(golem?.traits.every((trait) => trait.automation === 'headless')).toBe(true)
    expect(golem?.actions.find((action) => action.id === 'multiattack')).toMatchObject({
      automation: 'headless',
      sequence: ['slam', 'slam'],
    })
    expect(combatant({
      id: 'golem', controller: 'dm', initiative: 10,
      statBlockId: 'srd-5.1:flesh-golem', currentHp: 93, maxHp: 93,
    }).immutableForm).toBe(true)
  })

  it('turns lightning damage into healing and ends Berserk at full HP', () => {
    const result = damageFleshGolem({
      currentHp: 88,
      damage: 10,
      damageType: 'lightning',
      classState: { monsterBerserk: true },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.golem.currentHp).toBe(93)
    expect(result.state.combatants.golem.classState.monsterBerserk).toBeUndefined()
    expect(result.events).toContainEqual({
      type: 'monster-damage-absorbed',
      actorId: 'golem',
      damageType: 'lightning',
      amount: 10,
      healing: 5,
    })
    expect(result.events).toContainEqual({
      type: 'monster-berserk-ended',
      actorId: 'golem',
      reason: 'fully-healed',
    })
  })

  it('applies fire aversion to attacks and checks until the golem turn ends', () => {
    const damaged = damageFleshGolem({
      currentHp: 93,
      damage: 5,
      damageType: 'fire',
    })
    expect(damaged.ok, damaged.ok ? undefined : damaged.reason).toBe(true)
    if (!damaged.ok) return
    const golem = damaged.state.combatants.golem
    expect(golem.classState.monsterDamageAversionActive).toBe(true)
    expect(golem.classState.monsterDamageAversionSourceActorId).toBe('hero')
    expect(dnd5eAbilityCheckRollMode(golem, { ability: 'wis' })).toBe('disadvantage')

    const advanced = resolveDnd5eHeadlessAction(damaged.state, {
      type: 'end-turn', actorId: 'hero',
    })
    expect(advanced.ok, advanced.ok ? undefined : advanced.reason).toBe(true)
    if (!advanced.ok) return
    const ended = resolveDnd5eHeadlessAction(advanced.state, {
      type: 'end-turn', actorId: 'golem',
    })
    expect(ended.ok, ended.ok ? undefined : ended.reason).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.golem.classState.monsterDamageAversionActive).toBeUndefined()
    expect(ended.state.combatants.golem.classState.monsterDamageAversionSourceActorId).toBeUndefined()
    expect(ended.events).toContainEqual({
      type: 'monster-damage-aversion-ended', actorId: 'golem',
    })
  })

  it('requires and resolves the low-HP d6 Berserk roll at turn start', () => {
    const state = startDnd5eHeadlessCombat('flesh-golem-berserk', [
      combatant({
        id: 'golem', controller: 'dm', initiative: 20,
        statBlockId: 'srd-5.1:flesh-golem', currentHp: 40, maxHp: 93,
      }),
      combatant({ id: 'hero', controller: 'player', initiative: 10 }),
    ])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'begin-turn',
      actorId: 'golem',
      nextMonsterRechargeRolls: [{
        actorId: 'golem',
        actionId: DND5E_MONSTER_BERSERK_TURN_START_ROLL_ID,
        roll: 6,
      }],
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.golem.classState.monsterBerserk).toBe(true)
    expect(result.events).toContainEqual({
      type: 'monster-berserk-resolved', actorId: 'golem', roll: 6, berserk: true,
    })
  })

  it('targets a nearer allied creature while Berserk', () => {
    const monster = getDnd5eSrdMonsterBySlug('flesh-golem')!
    const golem = token({
      id: 'golem', label: monster.name, poolId: monster.id,
      hp: 40, maxHp: 93,
      dnd5eCombatState: { monsterBerserk: true },
    })
    const nearbyAlly = token({ id: 'nearby-ally', x: 10, hp: 20, maxHp: 20 })
    const distantHero = token({ id: 'hero', type: 'player', x: 60, hp: 20, maxHp: 20 })
    const map: BattleMap = {
      id: 'flesh-golem-berserk-targeting',
      name: 'Flesh Golem Berserk',
      width: 200,
      height: 100,
      gridSize: 10,
      feetPerCell: 5,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      tokens: [golem, nearbyAlly, distantHero],
    }
    expect(selectDnd5eMonsterPreferredTarget({ map, enemy: golem, monster })?.id)
      .toBe(nearbyAlly.id)
    expect(planDnd5eMonsterTurn(map, golem).targetTokenId).toBe(nearbyAlly.id)
  })
})
