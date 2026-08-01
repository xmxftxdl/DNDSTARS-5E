import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DeclarativeSubclassDefinitionV1 } from './declarativeSubclassAbility'
import {
  createDnd5eCombatant,
  dnd5eAbilityCheckRollMode,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import { dnd5eNextD20AdvantageApplies } from './nextD20Advantage'
import { dnd5eSavingThrowMode } from './passiveDefenses'
import { registerDnd5eRulesPlugin } from './pluginApi'

const PLUGIN_ID = 'com.example.next-d20'
const SUBCLASS_ID = `${PLUGIN_ID}:fortune-bearer`
const FEATURE_ID = `${SUBCLASS_ID}.prepared-fortune`
const RESOURCE_ID = `${PLUGIN_ID}:decl-fortune-bearer-prepared-fortune-uses`

const definition: DeclarativeSubclassDefinitionV1 = {
  schemaVersion: 1,
  id: 'fortune-bearer',
  classId: 'sorcerer',
  name: 'Fortune Bearer',
  summary: 'Synthetic prearmed d20 advantage fixture.',
  abilities: [{
    schemaVersion: 1,
    id: 'prepared-fortune',
    name: 'Prepared Fortune',
    description: 'Arms advantage for one later d20 roll.',
    level: 1,
    trigger: { kind: 'active-use' },
    targeting: { kind: 'self' },
    mechanic: {
      kind: 'next-d20-advantage',
      rollKinds: ['attack', 'ability-check', 'saving-throw'],
    },
    effects: [],
    limits: {
      reset: 'long-rest',
      uses: { kind: 'fixed', value: 1 },
    },
    automation: 'full',
  }],
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
    abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 18 },
    proficiencyBonus: 2,
    armorClass: 15,
    currentHp: 30,
    maxHp: 30,
    temporaryHp: 0,
    speed: 30,
    position: { x: controller === 'player' ? 0 : 5, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function actor(): Dnd5eCombatant {
  return combatant('actor', 'player', 20, {
    level: 6,
    classId: 'sorcerer',
    subclassId: SUBCLASS_ID,
    classLevels: { sorcerer: 6 },
    subclassIds: { sorcerer: SUBCLASS_ID },
    pluginFeatureIds: [FEATURE_ID],
    classResources: {
      [RESOURCE_ID]: { current: 1, max: 1 },
    },
  })
}

function state() {
  const result = startDnd5eHeadlessCombat('next-d20-combat', [
    actor(),
    combatant('target', 'dm', 10),
  ])
  result.distanceFeetByCombatantPair = { ['actor\u0000target']: 5 }
  return result
}

function activate(input = state(), transactionId = 'activate-next-d20') {
  return resolveDnd5eHeadlessAction(input, {
    type: 'plugin',
    pluginId: PLUGIN_ID,
    actionId: 'decl.fortune-bearer.prepared-fortune',
    featureId: FEATURE_ID,
    transactionId,
    actorId: 'actor',
    targetId: 'actor',
    targetIds: ['actor'],
    distanceFeet: 0,
  })
}

describe('generic prearmed next-d20 advantage protocol', () => {
  let dispose: (() => void) | undefined

  beforeAll(() => {
    dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: PLUGIN_ID,
        name: 'Next D20 Test',
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

  it('arms once, spends its resource and rejects a duplicate activation atomically', () => {
    const armed = activate()
    expect(armed.ok, armed.ok ? undefined : armed.reason).toBe(true)
    if (!armed.ok) return
    expect(armed.state.combatants.actor).toMatchObject({
      classResources: { [RESOURCE_ID]: { current: 0, max: 1 } },
      classState: {
        nextD20Advantage: {
          featureId: FEATURE_ID,
          rollKinds: ['attack', 'ability-check', 'saving-throw'],
        },
      },
    })
    const duplicate = activate(armed.state, 'duplicate-activation')
    expect(duplicate).toMatchObject({ ok: false, reason: 'invalid-plugin-action' })
    expect(duplicate.state.combatants.actor.classState.nextD20Advantage)
      .toEqual(armed.state.combatants.actor.classState.nextD20Advantage)
  })

  it('uses the higher attack die and consumes the marker after one attack', () => {
    const armed = activate()
    if (!armed.ok) throw new Error(armed.reason)
    expect(dnd5eNextD20AdvantageApplies(
      armed.state.combatants.actor,
      'attack',
    )).toBe(true)
    const attack = resolveDnd5eHeadlessAction(armed.state, {
      type: 'attack',
      actorId: 'actor',
      targetId: 'target',
      attackModifier: 0,
      d20: 5,
      d20Second: 20,
      spendAction: false,
      damage: {
        count: 1,
        sides: 4,
        bonus: 0,
        rolls: [2, 2],
        type: 'force',
      },
    })
    expect(attack.ok, attack.ok ? undefined : attack.reason).toBe(true)
    expect(attack.state.combatants.target.currentHp).toBe(26)
    expect(attack.state.combatants.actor.classState.nextD20Advantage).toBeUndefined()
    expect(attack.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed',
      actorId: 'actor',
      stateKey: 'next-d20-advantage',
      active: false,
    }))
  })

  it('applies to an ability check and consumes only after the authoritative result', () => {
    const armed = activate()
    if (!armed.ok) throw new Error(armed.reason)
    expect(dnd5eAbilityCheckRollMode(armed.state.combatants.actor, {
      ability: 'cha',
    })).toBe('advantage')
    const check = resolveDnd5eHeadlessAction(armed.state, {
      type: 'ability-check',
      actorId: 'actor',
      ability: 'cha',
      d20: 2,
      d20Second: 18,
      dc: 15,
    })
    expect(check.ok, check.ok ? undefined : check.reason).toBe(true)
    expect(check.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved',
      actorId: 'actor',
      d20: 18,
      success: true,
    }))
    expect(check.state.combatants.actor.classState.nextD20Advantage).toBeUndefined()
  })

  it('applies to a saving throw and consumes after that save', () => {
    const base = state()
    base.combatants.actor.concentrating = true
    base.combatants.actor.classState.concentrationSpellId = 'test-spell'
    const armed = activate(base)
    if (!armed.ok) throw new Error(armed.reason)
    expect(dnd5eSavingThrowMode(armed.state.combatants.actor, 'con', {
      effectVisible: true,
    })).toBe('advantage')
    const save = resolveDnd5eHeadlessAction(armed.state, {
      type: 'concentration-save',
      actorId: 'actor',
      d20: 2,
      d20Second: 18,
      dc: 15,
    })
    expect(save.ok, save.ok ? undefined : save.reason).toBe(true)
    expect(save.events).toContainEqual(expect.objectContaining({
      type: 'concentration-resolved',
      actorId: 'actor',
      d20: 18,
      success: true,
    }))
    expect(save.state.combatants.actor.classState.nextD20Advantage).toBeUndefined()
  })

  it('applies to a death saving throw and consumes after that save', () => {
    const armed = activate(state())
    if (!armed.ok) throw new Error(armed.reason)
    armed.state.combatants.actor.currentHp = 0
    const save = resolveDnd5eHeadlessAction(armed.state, {
      type: 'death-save',
      actorId: 'actor',
      d20: 2,
      d20Second: 18,
    })
    expect(save.ok, save.ok ? undefined : save.reason).toBe(true)
    expect(save.events).toContainEqual(expect.objectContaining({
      type: 'death-save-resolved',
      actorId: 'actor',
      d20: 18,
      successes: 1,
    }))
    expect(save.state.combatants.actor.classState.nextD20Advantage).toBeUndefined()
  })
})
