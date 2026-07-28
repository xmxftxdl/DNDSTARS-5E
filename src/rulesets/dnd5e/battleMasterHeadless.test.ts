import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { DeclarativeSubclassDefinitionV1 } from './declarativeSubclassAbility'
import {
  createDnd5eCombatant,
  dnd5eTargetArmorClassForAttack,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eActionResult,
  type Dnd5eCombatant,
  type Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import { registerDnd5eRulesPlugin } from './pluginApi'

const PLUGIN_ID = 'local.doco.battle-master-headless-test'
const SUBCLASS_ID = `${PLUGIN_ID}:battle-master-2014`
const RESOURCE_ID = `${PLUGIN_ID}:superiority-dice`
const ABILITIES = { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 10 }
let stateSequence = 0

function featureId(maneuver: string): string {
  return `${SUBCLASS_ID}.maneuver-${maneuver}`
}

function combatant(
  id: string,
  controller: 'player' | 'dm',
  initiative: number,
  patch: Partial<Dnd5eCombatant> = {},
): Dnd5eCombatant {
  return createDnd5eCombatant({
    id,
    name: id,
    controller,
    initiative,
    abilities: ABILITIES,
    proficiencyBonus: 3,
    armorClass: 14,
    currentHp: 40,
    maxHp: 40,
    temporaryHp: 0,
    speed: 30,
    position: { x: controller === 'player' ? 0 : 5, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function battleMaster(
  id = 'fighter',
  maneuvers: readonly string[] = [],
  patch: Partial<Dnd5eCombatant> = {},
): Dnd5eCombatant {
  const pluginFeatureIds = maneuvers.map(featureId)
  return combatant(id, 'player', 20, {
    level: 15,
    classId: 'fighter',
    subclassId: SUBCLASS_ID,
    classLevels: { fighter: 15 },
    subclassIds: { fighter: SUBCLASS_ID },
    classSelections: {
      [`${SUBCLASS_ID}/maneuvers`]: [...maneuvers],
    },
    pluginFeatureIds,
    classResources: { [RESOURCE_ID]: { current: 6, max: 6 } },
    mainWeaponId: 'longsword',
    ...patch,
  })
}

function stateWith(
  creatures: readonly Dnd5eCombatant[],
  distances: readonly [string, string, number][] = [],
): Dnd5eHeadlessCombatState {
  stateSequence += 1
  const state = startDnd5eHeadlessCombat(`battle-master-${stateSequence}`, creatures)
  state.distanceFeetByCombatantPair = Object.fromEntries(distances.map(([first, second, distance]) => [
    [first, second].sort().join('\u0000'),
    distance,
  ]))
  return state
}

function success(result: Dnd5eActionResult): Dnd5eActionResult & { ok: true } {
  expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
  if (!result.ok) throw new Error(result.reason)
  return result
}

function superiorityRoll(maneuver: string, value: number) {
  const rollId = maneuver === 'precision-attack'
    ? 'superiority-attack-bonus'
    : maneuver === 'sweeping-attack'
      ? 'superiority-sweep-damage'
      : maneuver === 'parry'
        ? 'superiority-reduction'
        : 'superiority-damage'
  return {
    [featureId(maneuver)]: {
      [rollId]: { values: [value], modifier: 0, total: value },
    },
  }
}

function weaponAttack(
  state: Dnd5eHeadlessCombatState,
  maneuver: string,
  input: {
    actorId?: string
    targetId?: string
    d20?: number
    d20Second?: number
    attackModifier?: number
    die?: number
    payload?: Record<string, unknown>
    mode?: 'normal' | 'advantage' | 'disadvantage'
    damageRoll?: number
    reachFeet?: number
  } = {},
): Dnd5eActionResult {
  const id = featureId(maneuver)
  return resolveDnd5eHeadlessAction(state, {
    type: 'attack',
    actorId: input.actorId ?? 'fighter',
    targetId: input.targetId ?? 'enemy',
    attackModifier: input.attackModifier ?? 5,
    d20: input.d20 ?? 15,
    d20Second: input.d20Second,
    mode: input.mode,
    spendAction: false,
    declarativeIntentFeatureIds: [id],
    declarativeIntentRolls: superiorityRoll(maneuver, input.die ?? 6),
    declarativeIntentPayloads: input.payload
      ? { [id]: input.payload }
      : undefined,
    classDamageContext: {
      weaponId: 'longsword',
      mode: 'melee',
      reachFeet: input.reachFeet ?? 5,
      finesse: false,
      strengthBased: true,
      weaponDamageSides: 8,
      damageType: 'slashing',
      adjacentEnemyOfTarget: false,
    },
    damage: {
      count: 1,
      sides: 8,
      bonus: 0,
      rolls: [input.damageRoll ?? 3],
      type: 'slashing',
    },
  })
}

let unregister: (() => void) | undefined

beforeAll(() => {
  const definition = JSON.parse(readFileSync(new URL(
    '../../../examples/battle-master-local-collection/subclasses.json',
    import.meta.url,
  ), 'utf8'))[0] as DeclarativeSubclassDefinitionV1
  unregister = registerDnd5eRulesPlugin({
    manifest: {
      id: PLUGIN_ID,
      name: 'Battle Master Headless Test',
      version: '1.0.0',
      apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1',
      publisher: 'Local test',
      license: 'Private local use',
    },
    setup(api) {
      api.registerDeclarativeSubclass(definition)
    },
  })
})

afterAll(() => unregister?.())

describe('Battle Master 2014 Headless settlement', () => {
  it('settles disarming, pushing, trip and menacing saves authoritatively', () => {
    const disarm = success(weaponAttack(stateWith([
      battleMaster('fighter', ['disarming-attack']),
      combatant('enemy', 'dm', 10, { mainWeaponId: 'enemy-sword' }),
    ]), 'disarming-attack', {
      payload: { savingThrow: { d20: 1 } },
    }))
    expect(disarm.state.combatants.enemy.classState.battleMasterDroppedWeaponIds)
      .toContain('enemy-sword')
    disarm.state.initiativeIndex = disarm.state.initiativeOrder.indexOf('enemy')
    expect(resolveDnd5eHeadlessAction(disarm.state, {
      type: 'attack',
      actorId: 'enemy',
      targetId: 'fighter',
      attackModifier: 5,
      d20: 15,
      spendAction: false,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [3], type: 'slashing' },
      classDamageContext: {
        weaponId: 'enemy-sword', mode: 'melee', reachFeet: 5, finesse: false, strengthBased: true,
        weaponDamageSides: 8, damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

    const push = success(weaponAttack(stateWith([
      battleMaster('fighter', ['pushing-attack']),
      combatant('enemy', 'dm', 10),
    ]), 'pushing-attack', {
      payload: {
        savingThrow: { d20: 1 },
        destination: { x: 20, y: 0 },
        distanceFeet: 15,
      },
    }))
    expect(push.state.combatants.enemy.position).toEqual({ x: 20, y: 0 })
    expect(push.events).toContainEqual(expect.objectContaining({
      type: 'moved',
      actorId: 'enemy',
      distance: 15,
    }))

    const trip = success(weaponAttack(stateWith([
      battleMaster('fighter', ['trip-attack']),
      combatant('enemy', 'dm', 10),
    ]), 'trip-attack', {
      payload: { savingThrow: { d20: 1 } },
    }))
    expect(trip.state.combatants.enemy.conditions).toContain('prone')

    const menace = success(weaponAttack(stateWith([
      battleMaster('fighter', ['menacing-attack']),
      combatant('enemy', 'dm', 10),
    ]), 'menacing-attack', {
      payload: { savingThrow: { d20: 1 } },
    }))
    expect(menace.state.combatants.enemy.conditions).toContain('frightened')
    expect(menace.events).toContainEqual(expect.objectContaining({
      type: 'battle-master-maneuver-resolved',
      maneuver: 'menacing-attack',
      saveSucceeded: false,
    }))
  })

  it('applies and consumes Distracting Strike, and enforces Goading Attack disadvantage', () => {
    const distractingState = stateWith([
      battleMaster('fighter', ['distracting-strike']),
      combatant('ally', 'player', 15, { position: { x: 0, y: 5 } }),
      combatant('enemy', 'dm', 10),
    ], [
      ['fighter', 'enemy', 5],
      ['ally', 'enemy', 5],
    ])
    const distracting = success(weaponAttack(distractingState, 'distracting-strike'))
    const allyAttack = success(resolveDnd5eHeadlessAction(distracting.state, {
      type: 'opportunity-attack',
      actorId: 'ally',
      targetId: 'enemy',
      attackModifier: 3,
      d20: 2,
      d20Second: 18,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [2], type: 'piercing' },
      classDamageContext: {
        weaponId: 'spear', mode: 'melee', reachFeet: 5, finesse: false, strengthBased: true,
        weaponDamageSides: 6, damageType: 'piercing', adjacentEnemyOfTarget: false,
      },
    }))
    expect(allyAttack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      actorId: 'ally',
      targetId: 'enemy',
      d20: 18,
      hit: true,
    }))
    expect((allyAttack.state.combatants.enemy.classState.activeEffects ?? []).some((effect) =>
      effect.modifiers?.nextAttackAdvantageByOtherThanSource === true
    )).toBe(false)

    const goadingState = stateWith([
      battleMaster('fighter', ['goading-attack']),
      combatant('ally', 'player', 15, { position: { x: 0, y: 5 } }),
      combatant('enemy', 'dm', 10),
    ], [
      ['fighter', 'enemy', 5],
      ['ally', 'enemy', 5],
    ])
    const goading = success(weaponAttack(goadingState, 'goading-attack', {
      payload: { savingThrow: { d20: 1 } },
    }))
    goading.state.initiativeIndex = goading.state.initiativeOrder.indexOf('enemy')
    const goadedAttack = success(resolveDnd5eHeadlessAction(goading.state, {
      type: 'attack',
      actorId: 'enemy',
      targetId: 'ally',
      attackModifier: 5,
      d20: 18,
      d20Second: 2,
      spendAction: false,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [2], type: 'slashing' },
      classDamageContext: {
        weaponId: 'enemy-sword', mode: 'melee', reachFeet: 5, finesse: false, strengthBased: true,
        weaponDamageSides: 6, damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
    }))
    expect(goadedAttack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      actorId: 'enemy',
      targetId: 'ally',
      d20: 2,
      hit: false,
    }))
  })

  it('moves an ally with Maneuvering Attack and resolves Sweeping Attack against a second enemy', () => {
    const maneuvering = success(weaponAttack(stateWith([
      battleMaster('fighter', ['maneuvering-attack']),
      combatant('ally', 'player', 15, { position: { x: 0, y: 5 } }),
      combatant('enemy', 'dm', 10),
    ]), 'maneuvering-attack', {
      payload: {
        secondaryTargetId: 'ally',
        destination: { x: 15, y: 5 },
        distanceFeet: 15,
      },
    }))
    expect(maneuvering.state.combatants.ally.position).toEqual({ x: 15, y: 5 })
    expect(maneuvering.state.combatants.ally.turn.reactionAvailable).toBe(false)

    const sweeping = success(weaponAttack(stateWith([
      battleMaster('fighter', ['sweeping-attack']),
      combatant('enemy', 'dm', 10),
      combatant('enemy-two', 'dm', 5, { armorClass: 5, position: { x: 5, y: 5 } }),
    ], [
      ['fighter', 'enemy', 5],
      ['fighter', 'enemy-two', 5],
      ['enemy', 'enemy-two', 5],
    ]), 'sweeping-attack', {
      die: 6,
      payload: { secondaryTargetId: 'enemy-two' },
    }))
    expect(sweeping.state.combatants['enemy-two'].currentHp).toBe(34)
    expect(sweeping.events).toContainEqual(expect.objectContaining({
      type: 'battle-master-maneuver-resolved',
      maneuver: 'sweeping-attack',
      secondaryTargetId: 'enemy-two',
    }))
  })

  it('settles Feinting, Lunging and Precision Attack at their distinct roll timings', () => {
    const feinting = success(weaponAttack(stateWith([
      battleMaster('fighter', ['feinting-attack']),
      combatant('enemy', 'dm', 10, { armorClass: 16 }),
    ], [['fighter', 'enemy', 5]]), 'feinting-attack', {
      d20: 2,
      d20Second: 18,
      die: 5,
    }))
    expect(feinting.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      d20: 18,
      hit: true,
    }))
    expect(feinting.state.combatants.fighter.turn.bonusActionAvailable).toBe(false)

    const lunging = success(weaponAttack(stateWith([
      battleMaster('fighter', ['lunging-attack']),
      combatant('enemy', 'dm', 10),
    ], [['fighter', 'enemy', 10]]), 'lunging-attack', {
      die: 4,
    }))
    expect(lunging.state.combatants.enemy.currentHp).toBe(33)

    const precision = success(weaponAttack(stateWith([
      battleMaster('fighter', ['precision-attack']),
      combatant('enemy', 'dm', 10, { armorClass: 16 }),
    ], [['fighter', 'enemy', 5]]), 'precision-attack', {
      d20: 8,
      attackModifier: 5,
      die: 4,
    }))
    expect(precision.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      total: 17,
      hit: true,
    }))
    expect(precision.state.combatants.fighter.classResources[RESOURCE_ID].current).toBe(5)
  })

  it('reduces damage with Parry and makes the reaction attack for Riposte', () => {
    const parryState = stateWith([
      combatant('enemy', 'dm', 20),
      battleMaster('fighter', ['parry'], {
        initiative: 10,
        armorClass: 14,
        classResources: { [RESOURCE_ID]: { current: 2, max: 6 } },
      }),
    ], [['enemy', 'fighter', 5]])
    const parry = success(resolveDnd5eHeadlessAction(parryState, {
      type: 'attack',
      actorId: 'enemy',
      targetId: 'fighter',
      attackModifier: 5,
      d20: 15,
      spendAction: false,
      declarativeTargetReaction: {
        featureId: featureId('parry'),
        rolls: {
          'superiority-reduction': { values: [6], modifier: 0, total: 6 },
        },
      },
      damage: { count: 1, sides: 10, bonus: 0, rolls: [10], type: 'slashing' },
      classDamageContext: {
        weaponId: 'enemy-sword', mode: 'melee', reachFeet: 5, finesse: false, strengthBased: true,
        weaponDamageSides: 10, damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
    }))
    expect(parry.state.combatants.fighter.currentHp).toBe(38)
    expect(parry.state.combatants.fighter.turn.reactionAvailable).toBe(false)
    expect(parry.state.combatants.fighter.classResources[RESOURCE_ID].current).toBe(1)

    const riposteState = stateWith([
      combatant('enemy', 'dm', 20),
      battleMaster('fighter', ['riposte'], {
        initiative: 10,
        classResources: { [RESOURCE_ID]: { current: 2, max: 6 } },
      }),
    ], [['enemy', 'fighter', 5]])
    const riposte = success(resolveDnd5eHeadlessAction(riposteState, {
      type: 'attack',
      actorId: 'enemy',
      targetId: 'fighter',
      attackModifier: 0,
      d20: 1,
      spendAction: false,
      declarativeTargetReaction: {
        featureId: featureId('riposte'),
        rolls: {
          'superiority-damage': { values: [5], modifier: 0, total: 5 },
        },
        weaponAttack: {
          attackModifier: 5,
          d20: 15,
          damage: { count: 1, sides: 8, bonus: 0, rolls: [3], type: 'slashing' },
          classDamageContext: {
            weaponId: 'longsword', mode: 'melee', reachFeet: 5, finesse: false, strengthBased: true,
            weaponDamageSides: 8, damageType: 'slashing', adjacentEnemyOfTarget: false,
          },
        },
      },
      damage: { count: 1, sides: 8, bonus: 0, rolls: [], type: 'slashing' },
      classDamageContext: {
        weaponId: 'enemy-sword', mode: 'melee', reachFeet: 5, finesse: false, strengthBased: true,
        weaponDamageSides: 8, damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
    }))
    expect(riposte.state.combatants.enemy.currentHp).toBe(32)
    expect(riposte.state.combatants.fighter.turn.reactionAvailable).toBe(false)
    expect(riposte.state.combatants.fighter.classResources[RESOURCE_ID].current).toBe(1)
  })

  it('settles Commander’s Strike, Evasive Footwork, Rally and Relentless', () => {
    const commanderId = featureId('commanders-strike')
    const commander = success(resolveDnd5eHeadlessAction(stateWith([
      battleMaster('fighter', ['commanders-strike']),
      combatant('ally', 'player', 15, { mainWeaponId: 'spear' }),
      combatant('enemy', 'dm', 10),
    ], [
      ['fighter', 'ally', 5],
      ['ally', 'enemy', 5],
    ]), {
      type: 'plugin',
      pluginId: PLUGIN_ID,
      actionId: 'decl.battle-master-2014.maneuver-commanders-strike',
      featureId: commanderId,
      transactionId: 'commander',
      actorId: 'fighter',
      targetId: 'ally',
      targetIds: ['ally'],
      distanceFeet: 5,
      rolls: {
        'superiority-damage': { values: [5, 4], modifier: 0, total: 9 },
      },
      payload: {
        enemyTargetId: 'enemy',
        weaponAttack: {
          attackModifier: 5,
          d20: 20,
          damage: { count: 1, sides: 6, bonus: 0, rolls: [3, 3], type: 'piercing' },
          classDamageContext: {
            weaponId: 'spear', mode: 'melee', reachFeet: 5, finesse: false, strengthBased: true,
            weaponDamageSides: 6, damageType: 'piercing', adjacentEnemyOfTarget: false,
          },
        },
      },
    }))
    expect(commander.state.combatants.enemy.currentHp).toBe(25)
    expect(commander.state.combatants.fighter.turn.actionAvailable).toBe(false)
    expect(commander.state.combatants.fighter.turn.bonusActionAvailable).toBe(false)
    expect(commander.state.combatants.ally.turn.reactionAvailable).toBe(false)

    const evasiveId = featureId('evasive-footwork')
    const evasive = success(resolveDnd5eHeadlessAction(stateWith([
      battleMaster('fighter', ['evasive-footwork']),
      combatant('enemy', 'dm', 10),
    ]), {
      type: 'plugin',
      pluginId: PLUGIN_ID,
      actionId: 'decl.battle-master-2014.maneuver-evasive-footwork',
      featureId: evasiveId,
      transactionId: 'evasive',
      actorId: 'fighter',
      targetId: 'fighter',
      targetIds: ['fighter'],
      distanceFeet: 0,
      rolls: {
        'superiority-ac': { values: [6], modifier: 0, total: 6 },
      },
    }))
    expect(dnd5eTargetArmorClassForAttack(evasive.state, 'enemy', 'fighter')).toBe(20)
    const moved = success(resolveDnd5eHeadlessAction(evasive.state, {
      type: 'move',
      actorId: 'fighter',
      to: { x: 5, y: 0 },
      distance: 5,
    }))
    expect(dnd5eTargetArmorClassForAttack(moved.state, 'enemy', 'fighter')).toBe(14)

    const rallyId = featureId('rally')
    const rally = success(resolveDnd5eHeadlessAction(stateWith([
      battleMaster('fighter', ['rally']),
      combatant('ally', 'player', 10),
    ], [['fighter', 'ally', 5]]), {
      type: 'plugin',
      pluginId: PLUGIN_ID,
      actionId: 'decl.battle-master-2014.maneuver-rally',
      featureId: rallyId,
      transactionId: 'rally',
      actorId: 'fighter',
      targetId: 'ally',
      targetIds: ['ally'],
      distanceFeet: 5,
      rolls: {
        'rally-temporary-hit-points': { values: [8], modifier: 0, total: 8 },
      },
    }))
    expect(rally.state.combatants.ally.temporaryHp).toBe(8)

    const relentlessId = `${SUBCLASS_ID}.relentless`
    const relentlessFighter = battleMaster('fighter', [], {
      pluginFeatureIds: [relentlessId],
      classResources: { [RESOURCE_ID]: { current: 0, max: 6 } },
    })
    const relentless = success(resolveDnd5eHeadlessAction(stateWith([
      relentlessFighter,
      combatant('enemy', 'dm', 10),
    ]), {
      type: 'begin-turn',
      actorId: 'fighter',
    }))
    expect(relentless.state.combatants.fighter.classResources[RESOURCE_ID].current).toBe(1)
    expect(relentless.events).toContainEqual(expect.objectContaining({
      type: 'class-resource-restored',
      actorId: 'fighter',
      resourceKey: RESOURCE_ID,
      current: 1,
    }))
  })
})
