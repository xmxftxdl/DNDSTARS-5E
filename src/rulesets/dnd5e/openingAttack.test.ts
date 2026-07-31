import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DeclarativeSubclassDefinitionV1 } from './declarativeSubclassAbility'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import {
  dnd5eOpeningAttackHasAdvantage,
  dnd5eOpeningAttackIsAutomaticCritical,
  dnd5eOpeningAttackSavingThrowRequirement,
  dnd5eTargetHasTakenFirstTurn,
} from './openingAttack'
import { registerDnd5eRulesPlugin } from './pluginApi'

const PLUGIN_ID = 'com.example.opening-attack'
const SUBCLASS_ID = `${PLUGIN_ID}:first-strike-specialist`
const ADVANTAGE_FEATURE_ID = `${SUBCLASS_ID}.early-opening`
const MULTIPLIER_FEATURE_ID = `${SUBCLASS_ID}.decisive-opening`
const COMBAT_ID = 'opening-attack-combat'
const ABILITIES = {
  str: 10,
  dex: 20,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
} as const

const definition: DeclarativeSubclassDefinitionV1 = {
  schemaVersion: 1,
  id: 'first-strike-specialist',
  classId: 'rogue',
  name: 'First Strike Specialist',
  summary: 'Synthetic opening-attack protocol fixture.',
  abilities: [
    {
      schemaVersion: 1,
      id: 'early-opening',
      name: 'Early Opening',
      description: 'Synthetic first-turn attack fixture.',
      level: 3,
      trigger: { kind: 'before-attack-roll' },
      targeting: { kind: 'single-creature', relation: 'enemy' },
      mechanic: {
        kind: 'opening-attack',
        advantageBeforeTargetFirstTurn: true,
        automaticCriticalAgainstSurprised: true,
      },
      effects: [],
      automation: 'full',
    },
    {
      schemaVersion: 1,
      id: 'decisive-opening',
      name: 'Decisive Opening',
      description: 'Synthetic surprised-hit saving throw fixture.',
      level: 17,
      trigger: { kind: 'after-attack-hit' },
      targeting: { kind: 'single-creature', relation: 'enemy' },
      mechanic: {
        kind: 'opening-attack',
        surprisedHitSavingThrow: {
          ability: 'con',
          dcAbility: 'dex',
          failureDamageMultiplier: 2,
        },
      },
      effects: [],
      automation: 'full',
    },
  ],
}

function combatant(
  id: string,
  controller: Dnd5eCombatant['controller'],
  initiative: number,
  patch: Partial<Dnd5eCombatant> = {},
): Dnd5eCombatant {
  return createDnd5eCombatant({
    id,
    name: id,
    controller,
    initiative,
    abilities: ABILITIES,
    proficiencyBonus: 2,
    armorClass: 15,
    currentHp: 100,
    maxHp: 100,
    temporaryHp: 0,
    speed: 30,
    position: { x: controller === 'player' ? 0 : 5, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function stateFor(input: {
  level?: number
  targetState?: Dnd5eCombatant['classState']
} = {}) {
  const level = input.level ?? 3
  const actor = combatant('actor', 'player', 20, {
    level,
    classId: 'rogue',
    classLevels: { rogue: level },
    subclassId: SUBCLASS_ID,
    subclassIds: { rogue: SUBCLASS_ID },
    pluginFeatureIds: level >= 17
      ? [ADVANTAGE_FEATURE_ID, MULTIPLIER_FEATURE_ID]
      : [ADVANTAGE_FEATURE_ID],
    proficiencyBonus: level >= 17 ? 6 : 2,
  })
  const target = combatant('target', 'dm', 10, {
    classState: input.targetState,
  })
  const state = startDnd5eHeadlessCombat(COMBAT_ID, [actor, target])
  state.distanceFeetByCombatantPair = { ['actor\u0000target']: 5 }
  return state
}

describe('generic opening-attack Headless protocol', () => {
  let dispose: (() => void) | undefined

  beforeAll(() => {
    dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: PLUGIN_ID,
        name: 'Opening Attack Test',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Test',
        license: 'CC0-1.0',
      },
      setup(api) {
        api.registerDeclarativeSubclass(definition)
      },
    })
  })

  afterAll(() => dispose?.())

  it('grants advantage only before the target starts its first turn', () => {
    const state = stateFor()
    const actor = state.combatants.actor
    const target = state.combatants.target
    expect(dnd5eTargetHasTakenFirstTurn(state, target)).toBe(false)
    expect(dnd5eOpeningAttackHasAdvantage(state, actor, target)).toBe(true)

    const hit = resolveDnd5eHeadlessAction(state, {
      type: 'attack',
      actorId: actor.id,
      targetId: target.id,
      attackModifier: 0,
      d20: 5,
      d20Second: 15,
      damage: {
        count: 1,
        sides: 6,
        bonus: 0,
        rolls: [4],
        type: 'piercing',
      },
    })
    expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true)
    expect(hit.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      d20: 15,
      hit: true,
      critical: false,
    }))

    const later = stateFor()
    later.combatants.target.classState.turnStartResolvedTurnKey =
      `${COMBAT_ID}:1:target`
    expect(dnd5eTargetHasTakenFirstTurn(later, later.combatants.target)).toBe(true)
    expect(dnd5eOpeningAttackHasAdvantage(
      later,
      later.combatants.actor,
      later.combatants.target,
    )).toBe(false)
  })

  it('turns a hit against a currently surprised target into a critical hit', () => {
    const state = stateFor({
      targetState: { surprisedCombatId: COMBAT_ID },
    })
    expect(dnd5eOpeningAttackIsAutomaticCritical(
      state,
      state.combatants.actor,
      state.combatants.target,
    )).toBe(true)

    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack',
      actorId: 'actor',
      targetId: 'target',
      attackModifier: 0,
      d20: 5,
      d20Second: 15,
      damage: {
        count: 1,
        sides: 6,
        bonus: 0,
        rolls: [4, 3],
        type: 'piercing',
      },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    expect(result.state.combatants.target.currentHp).toBe(93)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      hit: true,
      critical: true,
    }))
  })

  it('uses a Host-provided save to multiply the complete critical-hit damage', () => {
    const state = stateFor({
      level: 17,
      targetState: { surprisedCombatId: COMBAT_ID },
    })
    expect(dnd5eOpeningAttackSavingThrowRequirement(
      state,
      state.combatants.actor,
      state.combatants.target,
    )).toMatchObject({
      featureId: MULTIPLIER_FEATURE_ID,
      ability: 'con',
      dcAbility: 'dex',
      dc: 19,
      failureDamageMultiplier: 2,
    })

    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack',
      actorId: 'actor',
      targetId: 'target',
      attackModifier: 0,
      d20: 5,
      d20Second: 15,
      openingAttackSavingThrow: { d20: 1 },
      damage: {
        count: 1,
        sides: 6,
        bonus: 2,
        rolls: [4, 3],
        type: 'piercing',
      },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    expect(result.state.combatants.target.currentHp).toBe(82)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved',
      targetId: 'target',
      ability: 'con',
      dc: 19,
      success: false,
    }))
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'declarative-subclass-ability-resolved',
      abilityId: MULTIPLIER_FEATURE_ID,
      trigger: 'after-attack-hit',
    }))
  })

  it('keeps normal damage on a successful save and rejects missing or forged dice', () => {
    const successfulState = stateFor({
      level: 17,
      targetState: { surprisedCombatId: COMBAT_ID },
    })
    const successful = resolveDnd5eHeadlessAction(successfulState, {
      type: 'attack',
      actorId: 'actor',
      targetId: 'target',
      attackModifier: 0,
      d20: 5,
      d20Second: 15,
      openingAttackSavingThrow: { d20: 20 },
      damage: {
        count: 1,
        sides: 6,
        bonus: 2,
        rolls: [4, 3],
        type: 'piercing',
      },
    })
    expect(successful.ok, successful.ok ? undefined : successful.reason).toBe(true)
    expect(successful.state.combatants.target.currentHp).toBe(91)

    const missing = resolveDnd5eHeadlessAction(stateFor({
      level: 17,
      targetState: { surprisedCombatId: COMBAT_ID },
    }), {
      type: 'attack',
      actorId: 'actor',
      targetId: 'target',
      attackModifier: 0,
      d20: 5,
      d20Second: 15,
      damage: {
        count: 1,
        sides: 6,
        bonus: 2,
        rolls: [4, 3],
        type: 'piercing',
      },
    })
    expect(missing).toMatchObject({ ok: false, reason: 'invalid-dice' })

    const forged = resolveDnd5eHeadlessAction(stateFor({
      level: 17,
      targetState: { surprisedCombatId: COMBAT_ID },
    }), {
      type: 'attack',
      actorId: 'actor',
      targetId: 'target',
      attackModifier: 0,
      d20: 5,
      d20Second: 15,
      openingAttackSavingThrow: { d20: 1, d20Second: 2 },
      damage: {
        count: 1,
        sides: 6,
        bonus: 2,
        rolls: [4, 3],
        type: 'piercing',
      },
    })
    expect(forged).toMatchObject({ ok: false, reason: 'invalid-dice' })
  })
})
