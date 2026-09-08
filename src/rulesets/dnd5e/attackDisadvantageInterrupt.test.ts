import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DeclarativeSubclassDefinitionV1 } from './declarativeSubclassAbility'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import { registerDnd5eRulesPlugin } from './pluginApi'

const PLUGIN_ID = 'com.example.attack-interrupt'
const SUBCLASS_ID = `${PLUGIN_ID}:light-domain`
const FEATURE_ID = `${SUBCLASS_ID}.warding-flare`
const FORCE_MISS_FEATURE_ID = `${SUBCLASS_ID}.illusory-self`
const FOLLOW_UP_FEATURE_ID = `${SUBCLASS_ID}.entropic-ward`
const RESOURCE_ID = `${PLUGIN_ID}:warding-flare-uses`

const definition: DeclarativeSubclassDefinitionV1 = {
  schemaVersion: 1,
  id: 'light-domain',
  classId: 'cleric',
  name: 'Light Domain',
  summary: 'Synthetic attack interrupt fixture.',
  resources: [{
    id: 'warding-flare-uses', label: 'Warding Flare',
    maximum: { kind: 'fixed', value: 3 }, resetOn: 'long-rest',
  }],
  abilities: [{
    schemaVersion: 1,
    id: 'warding-flare',
    name: 'Warding Flare',
    description: 'Imposes disadvantage before an incoming attack.',
    level: 1,
    trigger: { kind: 'before-attack-roll' },
    cost: { economy: 'reaction', resources: [{ resourceId: 'warding-flare-uses', amount: 1 }] },
    targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 30, requiresSight: true },
    mechanic: { kind: 'attack-disadvantage-interrupt', protects: 'self' },
    effects: [],
    automation: 'full',
  }, {
    schemaVersion: 1,
    id: 'illusory-self',
    name: 'Illusory Self',
    description: 'Forces the incoming attack to miss.',
    level: 1,
    trigger: { kind: 'before-attack-roll' },
    cost: { economy: 'reaction' },
    targeting: { kind: 'single-creature', relation: 'enemy' },
    mechanic: { kind: 'attack-disadvantage-interrupt', protects: 'self', outcome: 'automatic-miss' },
    effects: [],
    automation: 'full',
  }, {
    schemaVersion: 1,
    id: 'entropic-ward',
    name: 'Entropic Ward',
    description: 'Disadvantage followed by one attack with advantage on a miss.',
    level: 1,
    trigger: { kind: 'before-attack-roll' },
    cost: { economy: 'reaction' },
    targeting: { kind: 'single-creature', relation: 'enemy' },
    mechanic: {
      kind: 'attack-disadvantage-interrupt', protects: 'self', outcome: 'disadvantage',
      onMiss: 'next-attack-advantage-against-attacker',
    },
    effects: [],
    automation: 'full',
  }],
}

describe('generic attack disadvantage Interrupt', () => {
  let dispose: (() => void) | undefined

  beforeAll(() => {
    dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: PLUGIN_ID, name: 'Attack Interrupt Test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0-1.0',
      },
      setup(api) { api.registerDeclarativeSubclass(definition) },
    })
  })

  afterAll(() => dispose?.())

  it('spends the declared reaction and resource and imposes disadvantage', () => {
    const attacker = createDnd5eCombatant({
      id: 'attacker', name: 'Attacker', controller: 'dm', initiative: 20,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 2, armorClass: 15, currentHp: 30, maxHp: 30, temporaryHp: 0,
      speed: 30, position: { x: 0, y: 0 }, concentrating: false,
    })
    const cleric = createDnd5eCombatant({
      id: 'cleric', name: 'Cleric', controller: 'player', initiative: 10,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
      proficiencyBonus: 2, armorClass: 15, currentHp: 30, maxHp: 30, temporaryHp: 0,
      speed: 30, position: { x: 0, y: 0 }, concentrating: false,
      level: 1, classId: 'cleric', subclassId: SUBCLASS_ID,
      classLevels: { cleric: 1 }, subclassIds: { cleric: SUBCLASS_ID },
      pluginFeatureIds: [FEATURE_ID], classResources: { [RESOURCE_ID]: { current: 1, max: 3 } },
    })
    const state = startDnd5eHeadlessCombat('attack-interrupt', [attacker, cleric])
    state.initiativeIndex = state.initiativeOrder.indexOf(attacker.id)
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(attacker.id, cleric.id)]: 10,
      [dnd5eCombatantPairKey(cleric.id, attacker.id)]: 10,
    }

    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: attacker.id, targetId: cleric.id, attackModifier: 5,
      d20: 18, d20Second: 2, mode: 'normal', spendAction: false,
      protectionReactionActorId: cleric.id,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [6] },
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.cleric.currentHp).toBe(30)
    expect(result.state.combatants.cleric.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.cleric.classResources[RESOURCE_ID].current).toBe(0)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: attacker.id, targetId: cleric.id, d20: 2, hit: false,
    }))
  })

  it('can force an incoming attack to miss through the same closed Interrupt primitive', () => {
    const attacker = createDnd5eCombatant({
      id: 'force-attacker', name: 'Attacker', controller: 'dm', initiative: 20,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 2, armorClass: 15, currentHp: 30, maxHp: 30, temporaryHp: 0,
      speed: 30, position: { x: 0, y: 0 }, concentrating: false,
    })
    const defender = createDnd5eCombatant({
      id: 'force-defender', name: 'Defender', controller: 'player', initiative: 10,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
      proficiencyBonus: 2, armorClass: 10, currentHp: 30, maxHp: 30, temporaryHp: 0,
      speed: 30, position: { x: 0, y: 0 }, concentrating: false,
      level: 1, classId: 'cleric', subclassId: SUBCLASS_ID,
      classLevels: { cleric: 1 }, subclassIds: { cleric: SUBCLASS_ID },
      pluginFeatureIds: [FORCE_MISS_FEATURE_ID],
    })
    const state = startDnd5eHeadlessCombat('force-miss', [attacker, defender])
    state.initiativeIndex = state.initiativeOrder.indexOf(attacker.id)
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: attacker.id, targetId: defender.id, attackModifier: 20,
      d20: 20, d20Second: 20, mode: 'normal', spendAction: false,
      protectionReactionActorId: defender.id,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [6] },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[defender.id].currentHp).toBe(30)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: attacker.id, targetId: defender.id, hit: false,
    }))
  })

  it('grants and consumes the declared one-shot counterattack advantage after a miss', () => {
    const attacker = createDnd5eCombatant({
      id: 'entropy-attacker', name: 'Attacker', controller: 'dm', initiative: 20,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 2, armorClass: 10, currentHp: 30, maxHp: 30, temporaryHp: 0,
      speed: 30, position: { x: 0, y: 0 }, concentrating: false,
    })
    const defender = createDnd5eCombatant({
      id: 'entropy-defender', name: 'Defender', controller: 'player', initiative: 10,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
      proficiencyBonus: 2, armorClass: 15, currentHp: 30, maxHp: 30, temporaryHp: 0,
      speed: 30, position: { x: 0, y: 0 }, concentrating: false,
      level: 1, classId: 'cleric', subclassId: SUBCLASS_ID,
      classLevels: { cleric: 1 }, subclassIds: { cleric: SUBCLASS_ID },
      pluginFeatureIds: [FOLLOW_UP_FEATURE_ID],
    })
    const state = startDnd5eHeadlessCombat('follow-up-advantage', [attacker, defender])
    state.initiativeIndex = state.initiativeOrder.indexOf(attacker.id)
    const defended = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: attacker.id, targetId: defender.id, attackModifier: 0,
      d20: 18, d20Second: 2, mode: 'normal', spendAction: false,
      protectionReactionActorId: defender.id,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [6] },
    })
    expect(defended.ok, defended.ok ? undefined : defended.reason).toBe(true)
    if (!defended.ok) return
    expect(defended.state.combatants[defender.id].classState.declarativeNextAttackAdvantage).toEqual({
      featureId: FOLLOW_UP_FEATURE_ID, targetId: attacker.id,
    })
    defended.state.initiativeIndex = defended.state.initiativeOrder.indexOf(defender.id)
    const counterattack = resolveDnd5eHeadlessAction(defended.state, {
      type: 'attack', actorId: defender.id, targetId: attacker.id, attackModifier: 0,
      d20: 2, d20Second: 18, mode: 'normal', spendAction: false,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [6] },
    })
    expect(counterattack.ok, counterattack.ok ? undefined : counterattack.reason).toBe(true)
    if (!counterattack.ok) return
    expect(counterattack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: defender.id, targetId: attacker.id, d20: 18, hit: true,
    }))
    expect(counterattack.state.combatants[defender.id].classState.declarativeNextAttackAdvantage).toBeUndefined()
  })
})
