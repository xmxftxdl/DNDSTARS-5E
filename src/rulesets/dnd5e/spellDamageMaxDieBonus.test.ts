import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  declarativeAbilityCompatibilityV1,
  validateDeclarativeSubclassAbilityV1,
  type DeclarativeSubclassDefinitionV1,
} from './declarativeSubclassAbility'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  resolveDnd5ePersistentAreaTrigger,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import { registerDnd5eRulesPlugin } from './pluginApi'

const PLUGIN_ID = 'com.example.maximum-die-rider'
const SUBCLASS_ID = `${PLUGIN_ID}:maximum-die-fixture`
const FEATURE_ID = `${SUBCLASS_ID}.maximum-die-rider`

const definition: DeclarativeSubclassDefinitionV1 = {
  schemaVersion: 1,
  id: 'maximum-die-fixture',
  classId: 'sorcerer',
  name: 'Maximum Die Fixture',
  summary: 'Synthetic fixture for a Host-owned spell damage rider.',
  abilities: [{
    schemaVersion: 1,
    id: 'maximum-die-rider',
    name: 'Maximum Die Rider',
    description: 'Adds Host-rolled dice to one qualifying spell damage group.',
    level: 4,
    trigger: { kind: 'after-spell-cast' },
    targeting: { kind: 'self' },
    mechanic: {
      kind: 'spell-damage-max-die-bonus',
      spellcastingClassId: 'sorcerer',
      additionalDice: 2,
    },
    effects: [],
    limits: { oncePerTurn: true },
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
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2,
    armorClass: 12,
    currentHp: 40,
    maxHp: 40,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function state() {
  return startDnd5eHeadlessCombat('maximum-die-rider-combat', [
    combatant('actor', 'player', 20, {
      level: 9,
      classId: 'sorcerer',
      subclassId: SUBCLASS_ID,
      classLevels: { sorcerer: 9 },
      subclassIds: { sorcerer: SUBCLASS_ID },
      classSelections: {
        'spell-cantrips': ['fire-bolt'],
        'spell-known': ['magic-missile', 'scorching-ray', 'ice-storm'],
        metamagic: ['empowered'],
      },
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 18 },
      proficiencyBonus: 4,
      pluginFeatureIds: [FEATURE_ID],
      classResources: {
        'dnd5e-spell-slot-1': { current: 1, max: 1 },
        'dnd5e-spell-slot-2': { current: 1, max: 1 },
        'dnd5e-spell-slot-4': { current: 1, max: 1 },
        'dnd5e-sorcery-points': { current: 9, max: 9 },
      },
    }),
    combatant('target', 'dm', 10),
  ])
}

describe('Host-authoritative spell maximum-die damage rider', () => {
  let dispose: (() => void) | undefined

  beforeAll(() => {
    dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: PLUGIN_ID,
        name: 'Maximum Die Rider Test',
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

  it('validates the closed mechanic and compiles it as fully Host-managed', () => {
    const ability = definition.abilities[0]
    expect(() => validateDeclarativeSubclassAbilityV1(ability)).not.toThrow()
    expect(declarativeAbilityCompatibilityV1(ability)).toMatchObject({
      effective: 'full',
      reasons: [],
    })
    expect(() => validateDeclarativeSubclassAbilityV1({
      ...ability,
      mechanic: { ...ability.mechanic, additionalDice: 0 },
    })).toThrow('spell damage maximum die bonus declaration is invalid')
  })

  it('adds the Host rolls to one ordinary spell damage roll and records the turn ledger', () => {
    const result = resolveDnd5eHeadlessAction(state(), {
      type: 'cast-spell',
      actorId: 'actor',
      castingClassId: 'sorcerer',
      targetId: 'target',
      spellId: 'fire-bolt',
      slotLevel: 0,
      d20: 10,
      effectRolls: [10, 1],
      spellDamageMaxDieBonus: {
        featureId: FEATURE_ID,
        group: 'effect',
        dieIndex: 0,
        bonusRolls: [2, 3],
      },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(24)
    expect(result.state.combatants.actor.classState.declarativeUsedTurnKeys?.[FEATURE_ID])
      .toBe('maximum-die-rider-combat:1:actor')
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'spell-damage-max-die-bonus-applied',
      featureId: FEATURE_ID,
      group: 'effect',
      dieSides: 10,
      rolls: [2, 3],
      amount: 5,
    }))
  })

  it('binds a repeated projectile bonus to exactly one projectile', () => {
    const result = resolveDnd5eHeadlessAction(state(), {
      type: 'cast-spell',
      actorId: 'actor',
      castingClassId: 'sorcerer',
      targetId: 'target',
      targetIds: ['target'],
      projectileTargetIds: ['target', 'target', 'target'],
      spellId: 'magic-missile',
      slotLevel: 1,
      effectRolls: [4, 1, 1],
      spellDamageMaxDieBonus: {
        featureId: FEATURE_ID,
        group: 'projectile',
        targetId: 'target',
        projectileIndex: 0,
        dieIndex: 0,
        bonusRolls: [2, 3],
      },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(26)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'spell-damage-max-die-bonus-applied',
      group: 'projectile',
      projectileIndex: 0,
      amount: 5,
    }))
  })

  it('checks the final adopted damage dice after an authoritative reroll', () => {
    const result = resolveDnd5eHeadlessAction(state(), {
      type: 'cast-spell',
      actorId: 'actor',
      castingClassId: 'sorcerer',
      targetId: 'target',
      spellId: 'fire-bolt',
      slotLevel: 0,
      d20: 10,
      empowered: true,
      empoweredRerolls: [{
        group: 'effect',
        dieIndex: 1,
        reroll: 10,
      }],
      effectRolls: [1, 1],
      spellDamageMaxDieBonus: {
        featureId: FEATURE_ID,
        group: 'effect',
        dieIndex: 1,
        bonusRolls: [2, 3],
      },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(24)
    expect(result.state.combatants.actor.classResources['dnd5e-sorcery-points'].current).toBe(8)
  })

  it('binds the rider to one attack in a sequenced multi-attack spell', () => {
    const targetAttacks = [0, 1, 2].map(() => ({
      targetId: 'target',
      d20: 10,
      effectRolls: [6, 1],
    }))
    const result = resolveDnd5eHeadlessAction(state(), {
      type: 'cast-spell',
      actorId: 'actor',
      castingClassId: 'sorcerer',
      targetId: 'target',
      targetIds: ['target'],
      projectileTargetIds: ['target', 'target', 'target'],
      spellId: 'scorching-ray',
      slotLevel: 2,
      targetAttacks,
      effectRolls: [],
      spellDamageMaxDieBonus: {
        featureId: FEATURE_ID,
        group: 'target-attack',
        targetId: 'target',
        attackIndex: 1,
        dieIndex: 0,
        bonusRolls: [2, 3],
      },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(14)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'spell-damage-max-die-bonus-applied',
      group: 'target-attack',
      attackIndex: 1,
      amount: 5,
    }))
  })

  it('binds the rider to one damage type in a compound damage spell', () => {
    const result = resolveDnd5eHeadlessAction(state(), {
      type: 'cast-spell',
      actorId: 'actor',
      castingClassId: 'sorcerer',
      targetId: 'target',
      targetIds: ['target'],
      spellId: 'ice-storm',
      slotLevel: 4,
      savingThrowD20: 1,
      effectRolls: [1, 1],
      additionalEffectRolls: [[6, 1, 1, 1]],
      spellDamageMaxDieBonus: {
        featureId: FEATURE_ID,
        group: 'additional-effect',
        componentIndex: 0,
        dieIndex: 0,
        bonusRolls: [2, 3],
      },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(24)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'spell-damage-max-die-bonus-applied',
      group: 'additional-effect',
      componentIndex: 0,
      dieSides: 6,
      amount: 5,
    }))
  })

  it('applies on a later Host-settled core spell area trigger', () => {
    const areaState = state()
    areaState.combatants.actor.concentrating = true
    areaState.combatants.actor.classState.concentrationSpellId = 'wall-of-fire'
    areaState.combatants.actor.classState.concentrationSpellLevel = 4
    const result = resolveDnd5ePersistentAreaTrigger(areaState, {
      areaId: 'core-spell-area:test',
      areaSourceKind: 'core-spell',
      coreSpellId: 'wall-of-fire',
      castingClassId: 'sorcerer',
      sourceId: 'actor',
      targetId: 'target',
      trigger: {
        id: 'later-damage',
        label: 'Later damage',
        timing: 'turn-end',
        damage: { count: 5, sides: 8, type: 'fire' },
      },
      damageRolls: [8, 1, 1, 1, 1],
      spellDamageMaxDieBonus: {
        featureId: FEATURE_ID,
        group: 'persistent-area',
        targetId: 'target',
        dieIndex: 0,
        bonusRolls: [2, 3],
      },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(23)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'spell-damage-max-die-bonus-applied',
      group: 'persistent-area',
      targetId: 'target',
      amount: 5,
    }))
  })

  it('rejects non-maximum source dice, invalid Host rolls, and a second use in the same turn', () => {
    const nonMaximum = resolveDnd5eHeadlessAction(state(), {
      type: 'cast-spell',
      actorId: 'actor',
      castingClassId: 'sorcerer',
      targetId: 'target',
      targetIds: ['target'],
      projectileTargetIds: ['target', 'target', 'target'],
      spellId: 'magic-missile',
      slotLevel: 1,
      effectRolls: [3, 1, 1],
      spellDamageMaxDieBonus: {
        featureId: FEATURE_ID,
        group: 'projectile',
        targetId: 'target',
        projectileIndex: 0,
        dieIndex: 0,
        bonusRolls: [2, 3],
      },
    })
    expect(nonMaximum).toMatchObject({ ok: false, reason: 'invalid-dice' })

    const first = resolveDnd5eHeadlessAction(state(), {
      type: 'cast-spell',
      actorId: 'actor',
      castingClassId: 'sorcerer',
      targetId: 'target',
      targetIds: ['target'],
      projectileTargetIds: ['target', 'target', 'target'],
      spellId: 'magic-missile',
      slotLevel: 1,
      effectRolls: [4, 1, 1],
      spellDamageMaxDieBonus: {
        featureId: FEATURE_ID,
        group: 'projectile',
        targetId: 'target',
        projectileIndex: 0,
        dieIndex: 0,
        bonusRolls: [2, 3],
      },
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    first.state.combatants.actor.turn.actionAvailable = true
    first.state.combatants.actor.classResources['dnd5e-spell-slot-1'].current = 1
    const repeated = resolveDnd5eHeadlessAction(first.state, {
      type: 'cast-spell',
      actorId: 'actor',
      castingClassId: 'sorcerer',
      targetId: 'target',
      targetIds: ['target'],
      projectileTargetIds: ['target', 'target', 'target'],
      spellId: 'magic-missile',
      slotLevel: 1,
      effectRolls: [4, 1, 1],
      spellDamageMaxDieBonus: {
        featureId: FEATURE_ID,
        group: 'projectile',
        targetId: 'target',
        projectileIndex: 0,
        dieIndex: 0,
        bonusRolls: [2, 3],
      },
    })
    expect(repeated).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })
})
