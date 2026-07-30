import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { applyDnd5eLongRestBenefits } from './campaignTimeRules'
import { createDnd5eConditionEffect } from './activeEffects'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
  type Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import {
  createDnd5eMapCombatSnapshot,
  planDnd5eMapResultApplication,
} from './mapBridge'
import { getDnd5eSrdMonster } from './monsters'
import { dnd5eStandardConditionId } from './conditions'

const abilities = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
} as const

function combatant(
  id: string,
  initiative: number,
  patch: Partial<Dnd5eCombatant> = {},
): Dnd5eCombatant {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: 'player',
    initiative,
    abilities,
    proficiencyBonus: 2,
    armorClass: 1,
    currentHp: 100,
    maxHp: 100,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function catalogMonster(
  slug: string,
  patch: Partial<Dnd5eCombatant> = {},
): Dnd5eCombatant {
  const monster = getDnd5eSrdMonster(`srd-5.1:${slug}`)
  if (!monster) throw new Error(`missing SRD monster ${slug}`)
  return combatant(slug, 30, {
    controller: 'dm',
    statBlockId: monster.id,
    creatureType: monster.creatureType,
    armorClass: monster.armorClass.value,
    currentHp: monster.hitPoints.average,
    maxHp: monster.hitPoints.average,
    abilities: monster.abilities,
    ...patch,
  })
}

function monsterAttack(input: {
  slug: 'clay-golem' | 'wight' | 'vampire-spawn' | 'vampire-vampire'
  actionId: 'slam' | 'life-drain' | 'bite'
  effectId:
    | 'slam-hit-point-maximum-reduction'
    | 'life-drain-hit-point-maximum-reduction'
    | 'bite-hit-point-maximum-reduction'
  damageRolls: number[][]
  saveD20?: number
  attackerPatch?: Partial<Dnd5eCombatant>
  targetPatch?: Partial<Dnd5eCombatant>
  additionalCombatants?: readonly Dnd5eCombatant[]
}) {
  const attacker = catalogMonster(input.slug, input.attackerPatch)
  const target = combatant('target', 20, {
    savingThrowBonuses: { con: 0 },
    ...input.targetPatch,
  })
  if (input.targetPatch?.conditions) {
    target.classState.activeEffects = input.targetPatch.conditions.map(
      (conditionLabel) => {
        const condition = dnd5eStandardConditionId(conditionLabel)
        if (!condition) throw new Error(`unknown test condition ${conditionLabel}`)
        return createDnd5eConditionEffect({
          condition,
        targetId: target.id,
        source: { kind: 'feature', rulesId: `test:${condition}` },
        })
      },
    )
    target.conditions = [...input.targetPatch.conditions]
  }
  const state = startDnd5eHeadlessCombat(
    `maximum-reduction:${input.slug}`,
    [attacker, target, ...(input.additionalCombatants ?? [])],
  )
  state.distanceFeetByCombatantPair = {
    ...state.distanceFeetByCombatantPair,
    [dnd5eCombatantPairKey(attacker.id, target.id)]: 5,
  }
  const result = resolveDnd5eHeadlessAction(state, {
    type: 'monster-action',
    actorId: attacker.id,
    actionId: input.actionId,
    rolls: [{
      targetId: target.id,
      d20: 10,
      damageRolls: input.damageRolls,
      onHitEffectRolls: [{
        effectId: input.effectId,
        ...(input.saveD20 == null ? {} : { d20: input.saveD20 }),
      }],
    }],
  })
  return { attacker, target, result }
}

function putActorOnTurn(
  state: Dnd5eHeadlessCombatState,
  actorId: string,
): void {
  state.initiativeIndex = state.initiativeOrder.indexOf(actorId)
  state.combatants[actorId].turn.actionAvailable = true
}

function character(
  patch: Partial<Character> = {},
): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id: 'hero',
    name: 'Hero',
    player: 'P1',
    avatar: '',
    accent: '',
    race: '',
    charClass: 'Fighter',
    level: 1,
    background: '',
    experience: 0,
    reputation: 0,
    abilities,
    savingThrows: [],
    skills: [],
    maxHp: 20,
    currentHp: 20,
    tempHp: 0,
    hitDice: '1d10',
    ac: 10,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 10,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    ...patch,
  }
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
    hp: 20,
    maxHp: 20,
    ...patch,
  }
}

describe('monster hit-point maximum reductions', () => {
  it.each([
    {
      slug: 'clay-golem',
      actionId: 'slam',
      effect: {
        id: 'slam-hit-point-maximum-reduction',
        damageBasis: { kind: 'all-attack-damage' },
        savingThrow: { ability: 'con', dc: 15 },
        recovery: 'greater-restoration-or-other-magic',
      },
    },
    {
      slug: 'wight',
      actionId: 'life-drain',
      effect: {
        id: 'life-drain-hit-point-maximum-reduction',
        damageBasis: { kind: 'damage-type', damageType: 'necrotic' },
        savingThrow: { ability: 'con', dc: 13 },
        recovery: 'long-rest',
      },
    },
    {
      slug: 'vampire-spawn',
      actionId: 'bite',
      effect: {
        id: 'bite-hit-point-maximum-reduction',
        damageBasis: { kind: 'damage-type', damageType: 'necrotic' },
        recovery: 'long-rest',
        healSourceByAmount: true,
      },
    },
    {
      slug: 'vampire-vampire',
      actionId: 'bite',
      effect: {
        id: 'bite-hit-point-maximum-reduction',
        damageBasis: { kind: 'damage-type', damageType: 'necrotic' },
        recovery: 'long-rest',
        healSourceByAmount: true,
      },
    },
  ])('declares $slug:$actionId as a structured Headless action', ({
    slug,
    actionId,
    effect,
  }) => {
    const monster = getDnd5eSrdMonster(`srd-5.1:${slug}`)
    const action = monster?.actions.find((candidate) => candidate.id === actionId)
    expect(action).toMatchObject({
      kind: 'weapon-attack',
      automation: 'headless',
      attack: {
        onHitEffects: [expect.objectContaining(effect)],
      },
    })
  })

  it('reduces Wight Life Drain maximum HP by post-defense necrotic damage only on a failed save', () => {
    const failed = monsterAttack({
      slug: 'wight',
      actionId: 'life-drain',
      effectId: 'life-drain-hit-point-maximum-reduction',
      damageRolls: [[4]],
      saveD20: 1,
      targetPatch: { currentHp: 50, maxHp: 50 },
    })
    expect(failed.result.ok, failed.result.ok ? undefined : failed.result.reason).toBe(true)
    if (!failed.result.ok) return
    expect(failed.result.state.combatants.target).toMatchObject({
      currentHp: 44,
      maxHp: 44,
      classState: {
        hitPointMaximumReductionLedger: {
          baseMaximum: 50,
          entries: [{
            amount: 6,
            recovery: 'long-rest',
            sourceActorId: 'wight',
            sourceActionId: 'life-drain',
            damageType: 'necrotic',
          }],
        },
      },
    })
    expect(failed.result.events).toContainEqual(expect.objectContaining({
      type: 'hit-point-maximum-reduced',
      sourceId: 'wight',
      targetId: 'target',
      amount: 6,
      appliedAmount: 6,
      maximumBefore: 50,
      maximumAfter: 44,
    }))

    const succeeded = monsterAttack({
      slug: 'wight',
      actionId: 'life-drain',
      effectId: 'life-drain-hit-point-maximum-reduction',
      damageRolls: [[4]],
      saveD20: 20,
      targetPatch: { currentHp: 50, maxHp: 50 },
    })
    expect(succeeded.result.ok, succeeded.result.ok ? undefined : succeeded.result.reason).toBe(true)
    if (!succeeded.result.ok) return
    expect(succeeded.result.state.combatants.target).toMatchObject({
      currentHp: 44,
      maxHp: 50,
    })
    expect(
      succeeded.result.state.combatants.target.classState
        .hitPointMaximumReductionLedger,
    ).toBeUndefined()
  })

  it('uses the complete Clay Golem Slam damage after its Constitution save fails', () => {
    const failed = monsterAttack({
      slug: 'clay-golem',
      actionId: 'slam',
      effectId: 'slam-hit-point-maximum-reduction',
      damageRolls: [[5, 5]],
      saveD20: 1,
    })
    expect(failed.result.ok, failed.result.ok ? undefined : failed.result.reason).toBe(true)
    if (!failed.result.ok) return
    expect(failed.result.state.combatants.target).toMatchObject({
      currentHp: 85,
      maxHp: 85,
      classState: {
        hitPointMaximumReductionLedger: {
          baseMaximum: 100,
          entries: [{
            amount: 15,
            recovery: 'greater-restoration-or-other-magic',
          }],
        },
      },
    })

    const succeeded = monsterAttack({
      slug: 'clay-golem',
      actionId: 'slam',
      effectId: 'slam-hit-point-maximum-reduction',
      damageRolls: [[5, 5]],
      saveD20: 20,
    })
    expect(succeeded.result.ok, succeeded.result.ok ? undefined : succeeded.result.reason).toBe(true)
    if (!succeeded.result.ok) return
    expect(succeeded.result.state.combatants.target).toMatchObject({
      currentHp: 85,
      maxHp: 100,
    })
  })

  it('makes Vampire Spawn Bite reduce maximum HP and heal by its necrotic component', () => {
    const { result } = monsterAttack({
      slug: 'vampire-spawn',
      actionId: 'bite',
      effectId: 'bite-hit-point-maximum-reduction',
      damageRolls: [[3], [4, 5]],
      attackerPatch: { currentHp: 10 },
      targetPatch: { conditions: ['restrained'] },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target).toMatchObject({
      currentHp: 85,
      maxHp: 91,
      classState: {
        hitPointMaximumReductionLedger: {
          entries: [{ amount: 9, damageType: 'necrotic' }],
        },
      },
    })
    expect(result.state.combatants['vampire-spawn'].currentHp).toBe(19)
    expect(result.events).toContainEqual({
      type: 'healing-applied',
      targetId: 'vampire-spawn',
      amount: 9,
      hpBefore: 10,
      hpAfter: 19,
    })
  })

  it('uses actual resisted necrotic damage for Vampire Bite reduction and healing', () => {
    const { result } = monsterAttack({
      slug: 'vampire-vampire',
      actionId: 'bite',
      effectId: 'bite-hit-point-maximum-reduction',
      damageRolls: [[3], [5, 5, 5]],
      attackerPatch: { currentHp: 10 },
      targetPatch: {
        conditions: ['restrained'],
        damageResistances: ['necrotic'],
      },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target).toMatchObject({
      currentHp: 86,
      maxHp: 93,
      classState: {
        hitPointMaximumReductionLedger: {
          entries: [{ amount: 7, damageType: 'necrotic' }],
        },
      },
    })
    expect(result.state.combatants['vampire-vampire'].currentHp).toBe(17)
  })

  it('kills a target when the reduction takes its maximum HP to zero', () => {
    const { result } = monsterAttack({
      slug: 'wight',
      actionId: 'life-drain',
      effectId: 'life-drain-hit-point-maximum-reduction',
      damageRolls: [[3]],
      saveD20: 1,
      targetPatch: { currentHp: 5, maxHp: 5, usesDeathSaves: true },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target).toMatchObject({
      currentHp: 0,
      maxHp: 0,
      deathSaves: {
        successes: 0,
        failures: 3,
        stable: false,
        dead: true,
      },
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'instant-death',
      sourceId: 'wight',
      targetId: 'target',
    }))
  })

  it('caps ordinary healing at the reduced maximum instead of erasing the ledger', () => {
    const healer = combatant('cleric', 10, {
      classId: 'cleric',
      level: 1,
      abilities: { ...abilities, wis: 16 },
      classSelections: { 'spell-prepared': ['cure-wounds'] },
      classResources: {
        'dnd5e-spell-slot-1': { current: 1, max: 1 },
      },
    })
    const drained = monsterAttack({
      slug: 'wight',
      actionId: 'life-drain',
      effectId: 'life-drain-hit-point-maximum-reduction',
      damageRolls: [[4]],
      saveD20: 1,
      targetPatch: { currentHp: 43, maxHp: 50 },
      additionalCombatants: [healer],
    })
    expect(drained.result.ok, drained.result.ok ? undefined : drained.result.reason).toBe(true)
    if (!drained.result.ok) return
    putActorOnTurn(drained.result.state, healer.id)
    const healed = resolveDnd5eHeadlessAction(drained.result.state, {
      type: 'cast-spell',
      actorId: healer.id,
      targetId: 'target',
      spellId: 'cure-wounds',
      slotLevel: 1,
      effectRolls: [8],
    })
    expect(healed.ok, healed.ok ? undefined : healed.reason).toBe(true)
    if (!healed.ok) return
    expect(healed.state.combatants.target).toMatchObject({
      currentHp: 44,
      maxHp: 44,
      classState: {
        hitPointMaximumReductionLedger: {
          baseMaximum: 50,
          entries: [{ amount: 6, recovery: 'long-rest' }],
        },
      },
    })
  })

  it('clamps stale snapshot HP to its persisted reduction ledger on reconstruction', () => {
    const reconstructed = combatant('reconstructed', 10, {
      currentHp: 50,
      maxHp: 50,
      classState: {
        hitPointMaximumReductionLedger: {
          schemaVersion: 1,
          baseMaximum: 50,
          entries: [{
            id: 'persisted-life-drain',
            amount: 6,
            recovery: 'long-rest',
          }],
        },
      },
    })
    expect(reconstructed).toMatchObject({
      currentHp: 44,
      maxHp: 44,
      classState: {
        hitPointMaximumReductionLedger: {
          baseMaximum: 50,
          entries: [{ id: 'persisted-life-drain', amount: 6 }],
        },
      },
    })
  })

  it('long rest restores only reductions whose recovery says long rest', () => {
    const rested = applyDnd5eLongRestBenefits(character({
      currentHp: 1,
      maxHp: 12,
      dnd5eCombatState: {
        hitPointMaximumReductionLedger: {
          schemaVersion: 1,
          baseMaximum: 20,
          entries: [{
            id: 'life-drain',
            amount: 5,
            recovery: 'long-rest',
          }, {
            id: 'clay-slam',
            amount: 3,
            recovery: 'greater-restoration-or-other-magic',
          }],
        },
      },
    }), 960)

    expect(rested).toMatchObject({
      currentHp: 17,
      maxHp: 17,
      dnd5eCombatState: {
        hitPointMaximumReductionLedger: {
          baseMaximum: 20,
          entries: [{
            id: 'clay-slam',
            amount: 3,
            recovery: 'greater-restoration-or-other-magic',
          }],
        },
      },
    })
  })

  it('round-trips the effective maximum and ledger through the map bridge', () => {
    const hero = character()
    const wight = token({
      id: 'wight-token',
      label: 'Wight',
      poolId: 'srd-5.1:wight',
      x: 0,
      y: 0,
      hp: 45,
      maxHp: 45,
    })
    const heroToken = token({
      id: 'hero-token',
      label: hero.name,
      type: 'player',
      characterId: hero.id,
      x: 10,
      y: 0,
      hp: hero.currentHp,
      maxHp: hero.maxHp,
    })
    const map: BattleMap = {
      id: 'maximum-reduction-map',
      name: 'Maximum reduction',
      width: 100,
      height: 100,
      gridSize: 10,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [wight, heroToken],
    }
    const initiativeOrder = [{
      tokenId: wight.id,
      label: wight.label,
      emoji: '',
      color: '',
      roll: 20,
    }, {
      tokenId: heroToken.id,
      label: heroToken.label,
      emoji: '',
      color: '',
      roll: 10,
    }]
    const snapshot = createDnd5eMapCombatSnapshot({
      combatId: 'maximum-reduction-map',
      map,
      characters: [hero],
      initiativeOrder,
    })
    const drained = resolveDnd5eHeadlessAction(snapshot.state, {
      type: 'monster-action',
      actorId: wight.id,
      actionId: 'life-drain',
      rolls: [{
        targetId: heroToken.id,
        d20: 10,
        damageRolls: [[4]],
        onHitEffectRolls: [{
          effectId: 'life-drain-hit-point-maximum-reduction',
          d20: 1,
        }],
      }],
    })
    expect(drained.ok, drained.ok ? undefined : drained.reason).toBe(true)
    if (!drained.ok) return

    const plan = planDnd5eMapResultApplication({
      state: drained.state,
      map,
      characters: [hero],
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
    })
    expect(plan.characters[0]).toMatchObject({
      currentHp: 14,
      maxHp: 14,
      dnd5eCombatState: {
        hitPointMaximumReductionLedger: {
          baseMaximum: 20,
          entries: [{ amount: 6, recovery: 'long-rest' }],
        },
      },
    })

    const reconnected = createDnd5eMapCombatSnapshot({
      combatId: 'maximum-reduction-map',
      map: plan.map,
      characters: plan.characters,
      initiativeOrder,
    })
    expect(reconnected.state.combatants[heroToken.id]).toMatchObject({
      currentHp: 14,
      maxHp: 14,
      classState: {
        hitPointMaximumReductionLedger: {
          baseMaximum: 20,
          entries: [{ amount: 6, recovery: 'long-rest' }],
        },
      },
    })
  })
})
