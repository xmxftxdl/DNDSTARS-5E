import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DeclarativeSubclassDefinitionV1 } from './declarativeSubclassAbility'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import { registerDnd5eRulesPlugin } from './pluginApi'

const PLUGIN_ID = 'com.example.outcome-adjustment'
const SUBCLASS_ID = `${PLUGIN_ID}:outcome-shaper`
const FEATURE_ID = `${SUBCLASS_ID}.shift-outcome`
const RESOURCE_ID = 'test-fate-points'

const definition: DeclarativeSubclassDefinitionV1 = {
  schemaVersion: 1,
  id: 'outcome-shaper',
  classId: 'sorcerer',
  name: 'Outcome Shaper',
  summary: 'Synthetic post-roll adjustment fixture.',
  abilities: [{
    schemaVersion: 1,
    id: 'shift-outcome',
    name: 'Shift Outcome',
    description: 'Adjusts one completed d20 result.',
    level: 1,
    trigger: { kind: 'after-d20-roll' },
    cost: {
      economy: 'reaction',
      resources: [{ resourceId: RESOURCE_ID, amount: 1, scope: 'core' }],
    },
    targeting: {
      kind: 'single-creature',
      relation: 'any',
      rangeFeet: 30,
      requiresSight: true,
    },
    mechanic: {
      kind: 'post-d20-adjustment',
      rollKinds: ['attack', 'ability-check', 'saving-throw'],
      dieSides: 6,
      directions: ['add', 'subtract'],
    },
    effects: [],
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
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
    proficiencyBonus: 2,
    armorClass: 15,
    currentHp: 30,
    maxHp: 30,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function source(): Dnd5eCombatant {
  return combatant('source', 'player', 15, {
    level: 1,
    classId: 'sorcerer',
    subclassId: SUBCLASS_ID,
    classLevels: { sorcerer: 1 },
    subclassIds: { sorcerer: SUBCLASS_ID },
    pluginFeatureIds: [FEATURE_ID],
    classResources: { [RESOURCE_ID]: { current: 1, max: 1 } },
  })
}

function adjustment(direction: 'add' | 'subtract', roll: number) {
  return { sourceId: 'source', featureId: FEATURE_ID, direction, roll } as const
}

function state(combatants: Dnd5eCombatant[], activeId: string) {
  const result = startDnd5eHeadlessCombat('post-d20-adjustment', combatants)
  result.initiativeIndex = result.initiativeOrder.indexOf(activeId)
  result.distanceFeetByCombatantPair = {}
  for (const left of combatants) {
    for (const right of combatants) {
      if (left.id !== right.id) {
        result.distanceFeetByCombatantPair[dnd5eCombatantPairKey(left.id, right.id)] = 10
      }
    }
  }
  return result
}

describe('generic post-d20 adjustment protocol', () => {
  let dispose: (() => void) | undefined

  beforeAll(() => {
    dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: PLUGIN_ID,
        name: 'Post D20 Adjustment Test',
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

  it('turns a normal attack hit into a miss and atomically spends reaction and resource', () => {
    const attacker = combatant('attacker', 'dm', 20)
    const result = resolveDnd5eHeadlessAction(
      state([attacker, source()], attacker.id),
      {
        type: 'attack',
        actorId: attacker.id,
        targetId: 'source',
        attackModifier: 5,
        d20: 10,
        spendAction: false,
        postD20Adjustment: adjustment('subtract', 2),
        damage: { count: 1, sides: 6, bonus: 0, rolls: [6] },
      },
    )

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.source.currentHp).toBe(30)
    expect(result.state.combatants.source.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.source.classResources[RESOURCE_ID].current).toBe(0)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      actorId: attacker.id,
      d20: 10,
      total: 13,
      hit: false,
    }))
  })

  it('keeps a natural twenty critical when its total is reduced', () => {
    const attacker = combatant('attacker', 'dm', 20)
    const result = resolveDnd5eHeadlessAction(
      state([attacker, source()], attacker.id),
      {
        type: 'attack',
        actorId: attacker.id,
        targetId: 'source',
        attackModifier: 0,
        d20: 20,
        spendAction: false,
        postD20Adjustment: adjustment('subtract', 6),
        damage: { count: 1, sides: 4, bonus: 0, rolls: [2, 2] },
      },
    )

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.source.currentHp).toBe(26)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      d20: 20,
      total: 14,
      hit: true,
      critical: true,
    }))
  })

  it('can turn a failed ability check into a success', () => {
    const actor = combatant('actor', 'player', 20)
    const result = resolveDnd5eHeadlessAction(
      state([actor, source()], actor.id),
      {
        type: 'ability-check',
        actorId: actor.id,
        ability: 'str',
        d20: 10,
        dc: 15,
        spendAction: false,
        postD20Adjustment: adjustment('add', 5),
      },
    )

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved',
      actorId: actor.id,
      d20: 10,
      total: 15,
      success: true,
    }))
  })

  it('can turn a failed spell saving throw into a success', () => {
    const caster = combatant('caster', 'player', 20, {
      level: 1,
      classId: 'cleric',
      classLevels: { cleric: 1 },
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
      classSelections: { 'spell-cantrips': ['sacred-flame'] },
    })
    const target = combatant('target', 'dm', 10)
    const result = resolveDnd5eHeadlessAction(
      state([caster, source(), target], caster.id),
      {
        type: 'cast-spell',
        actorId: caster.id,
        targetId: target.id,
        spellId: 'sacred-flame',
        slotLevel: 0,
        savingThrowD20: 10,
        savingThrowPostD20Adjustment: adjustment('add', 3),
        effectRolls: [],
      },
    )

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(30)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved',
      targetId: target.id,
      d20: 10,
      total: 13,
      success: true,
    }))
  })

  it('applies the adjustment to the saving-throw reroll that is finally adopted', () => {
    const caster = combatant('caster', 'player', 20, {
      level: 1,
      classId: 'cleric',
      classLevels: { cleric: 1 },
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
      classSelections: { 'spell-cantrips': ['sacred-flame'] },
    })
    const target = combatant('target', 'dm', 10, {
      level: 9,
      classId: 'fighter',
      classLevels: { fighter: 9 },
      classResources: { fighterIndomitable: { current: 1, max: 1 } },
    })
    const result = resolveDnd5eHeadlessAction(
      state([caster, source(), target], caster.id),
      {
        type: 'cast-spell',
        actorId: caster.id,
        targetId: target.id,
        spellId: 'sacred-flame',
        slotLevel: 0,
        savingThrowD20: 1,
        savingThrowRerollD20: 10,
        savingThrowPostD20Adjustment: adjustment('add', 3),
        effectRolls: [],
      },
    )

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(30)
    expect(result.state.combatants.target.classResources.fighterIndomitable.current).toBe(0)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved',
      targetId: target.id,
      d20: 10,
      total: 13,
      success: true,
    }))
  })

  it('rejects an invalid Host die without partially spending the source', () => {
    const attacker = combatant('attacker', 'dm', 20)
    const result = resolveDnd5eHeadlessAction(
      state([attacker, source()], attacker.id),
      {
        type: 'attack',
        actorId: attacker.id,
        targetId: 'source',
        attackModifier: 5,
        d20: 10,
        spendAction: false,
        postD20Adjustment: adjustment('subtract', 7),
        damage: { count: 1, sides: 6, bonus: 0, rolls: [6] },
      },
    )

    expect(result).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
    expect(result.state.combatants.source.turn.reactionAvailable).toBe(true)
    expect(result.state.combatants.source.classResources[RESOURCE_ID].current).toBe(1)
  })
})
