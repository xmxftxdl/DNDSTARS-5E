import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  parseDnd5eDeclarativeRulesPackageV1,
  type DeclarativeSubclassDefinitionV1,
} from './declarativeSubclassAbility'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  dnd5ePostSpellRandomTablePlan,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import { registerDnd5eRulesPlugin } from './pluginApi'

const PLUGIN_ID = 'com.example.post-spell-table'
const SUBCLASS_ID = `${PLUGIN_ID}:anomaly-caster`
const TABLE_FEATURE_ID = `${SUBCLASS_ID}.table-check`
const LINKED_USE_RESOURCE_ID = `${PLUGIN_ID}:decl-anomaly-caster-fortune-uses`

const definition: DeclarativeSubclassDefinitionV1 = {
  schemaVersion: 1,
  id: 'anomaly-caster',
  classId: 'sorcerer',
  name: 'Anomaly Caster',
  summary: 'Synthetic Host-authoritative post-spell random-table fixture.',
  abilities: [{
    schemaVersion: 1,
    id: 'table-check',
    name: 'Post-Spell Table Check',
    description: 'Checks a random table after a qualifying spell.',
    level: 1,
    trigger: { kind: 'after-spell-cast' },
    targeting: { kind: 'self' },
    mechanic: {
      kind: 'post-spell-random-table',
      spellcastingClassId: 'sorcerer',
      minimumSpellLevel: 1,
      triggerDieSides: 20,
      triggerValues: [1],
      tableDieSides: 100,
      forceTableWhenUsesEmptyAbilityId: 'fortune',
      restoreUsesAbilityIdOnTable: 'fortune',
      outcomes: [{
        id: 'synthetic-centered-spell',
        minimum: 42,
        maximum: 43,
        effect: {
          kind: 'self-centered-core-spell',
          spellId: 'fireball',
          slotLevel: 3,
        },
      }],
    },
    effects: [],
    automation: 'partial',
  }, {
    schemaVersion: 1,
    id: 'fortune',
    name: 'Fortune',
    description: 'Synthetic linked-use fixture.',
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

function actor(linkedUseCurrent = 1): Dnd5eCombatant {
  return combatant('actor', 'player', 20, {
    level: 5,
    classId: 'sorcerer',
    subclassId: SUBCLASS_ID,
    classLevels: { sorcerer: 5 },
    subclassIds: { sorcerer: SUBCLASS_ID },
    classSelections: { 'spell-known': ['magic-missile', 'counterspell', 'shield'] },
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 18 },
    proficiencyBonus: 3,
    pluginFeatureIds: [TABLE_FEATURE_ID, `${SUBCLASS_ID}.fortune`],
    classResources: {
      'dnd5e-spell-slot-1': { current: 1, max: 1 },
      'dnd5e-spell-slot-3': { current: 1, max: 1 },
      [LINKED_USE_RESOURCE_ID]: { current: linkedUseCurrent, max: 1 },
    },
  })
}

function state(linkedUseCurrent = 1) {
  const result = startDnd5eHeadlessCombat('post-spell-table-combat', [
    actor(linkedUseCurrent),
    combatant('nearby', 'dm', 10),
    combatant('far', 'dm', 5),
  ])
  result.distanceFeetByCombatantPair = {
    [dnd5eCombatantPairKey('actor', 'nearby')]: 15,
    [dnd5eCombatantPairKey('actor', 'far')]: 25,
  }
  return result
}

function pendingState(linkedUseCurrent = 1) {
  const result = state(linkedUseCurrent)
  result.combatants.actor.classState.postSpellRandomTableCheck = {
    featureId: TABLE_FEATURE_ID,
    spellId: 'magic-missile',
    spellLevel: 1,
    slotLevel: 1,
    castingClassId: 'sorcerer',
    forceTable: linkedUseCurrent === 0,
  }
  return result
}

describe('Host-authoritative post-spell random table', () => {
  let dispose: (() => void) | undefined

  beforeAll(() => {
    dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: PLUGIN_ID,
        name: 'Post Spell Table Test',
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

  it('validates table bounds and rejects overlapping JSON outcome ranges', () => {
    const packageValue = (subclass: DeclarativeSubclassDefinitionV1) => ({
      format: 'dndstars5e-declarative',
      schemaVersion: 1,
      manifest: {
        id: PLUGIN_ID,
        name: 'Post Spell Table Test',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Test',
        license: 'CC0-1.0',
      },
      subclasses: [subclass],
    })
    const bytes = (value: unknown) =>
      new TextEncoder().encode(JSON.stringify(value)).buffer as ArrayBuffer
    expect(parseDnd5eDeclarativeRulesPackageV1(bytes(packageValue(definition))))
      .toMatchObject({ subclasses: [{ id: 'anomaly-caster' }] })

    const tableAbility = definition.abilities[0]!
    if (tableAbility.mechanic?.kind !== 'post-spell-random-table') {
      throw new Error('invalid test fixture')
    }
    const invalid: DeclarativeSubclassDefinitionV1 = {
      ...definition,
      abilities: [{
        ...tableAbility,
        mechanic: {
          ...tableAbility.mechanic,
          outcomes: [
            ...tableAbility.mechanic.outcomes,
            { id: 'overlap', minimum: 43, maximum: 44 },
          ],
        },
      }, ...definition.abilities.slice(1)],
    }
    expect(() => parseDnd5eDeclarativeRulesPackageV1(bytes(packageValue(invalid))))
      .toThrow('random table outcome ranges overlap')
  })

  it('arms a Host check after a qualifying Sorcerer spell without coupling to a named subclass', () => {
    const resolved = resolveDnd5eHeadlessAction(state(), {
      type: 'cast-spell',
      actorId: 'actor',
      targetId: 'nearby',
      targetIds: ['nearby'],
      projectileTargetIds: ['nearby', 'nearby', 'nearby'],
      spellId: 'magic-missile',
      slotLevel: 1,
      effectRolls: [1, 1, 1],
    })

    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants.actor.classState.postSpellRandomTableCheck).toEqual({
      featureId: TABLE_FEATURE_ID,
      spellId: 'magic-missile',
      spellLevel: 1,
      slotLevel: 1,
      castingClassId: 'sorcerer',
      forceTable: false,
    })
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: 'post-spell-random-table-check-required',
      actorId: 'actor',
      triggerDieSides: 20,
      triggerValues: [1],
      tableDieSides: 100,
    }))
  })

  it('clears the pending check when the trigger die does not activate the table', () => {
    const resolved = resolveDnd5eHeadlessAction(pendingState(), {
      type: 'resolve-post-spell-random-table',
      actorId: 'actor',
      featureId: TABLE_FEATURE_ID,
      triggerRoll: 2,
    })

    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    expect(resolved.state.combatants.actor.classState.postSpellRandomTableCheck).toBeUndefined()
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: 'post-spell-random-table-check-resolved',
      triggered: false,
    }))
  })

  it('arms and resolves off turn after a Sorcerer counterspell reaction', () => {
    const input = state()
    const caster = input.combatants.nearby
    caster.classId = 'wizard'
    caster.level = 5
    caster.classLevels = { wizard: 5 }
    caster.classSelections = { 'spell-cantrips': ['fire-bolt'] }
    input.initiativeIndex = input.initiativeOrder.indexOf(caster.id)
    const cast = resolveDnd5eHeadlessAction(input, {
      type: 'cast-spell',
      actorId: caster.id,
      targetId: 'actor',
      spellId: 'fire-bolt',
      slotLevel: 0,
      d20: 20,
      effectRolls: [1, 1],
      counterspellReaction: {
        actorId: 'actor',
        slotLevel: 3,
      },
    })

    expect(cast.ok, cast.ok ? undefined : cast.reason).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.actor.classState.postSpellRandomTableCheck)
      .toMatchObject({ spellId: 'counterspell', spellLevel: 3, castingClassId: 'sorcerer' })
    expect(cast.events).toContainEqual(expect.objectContaining({
      type: 'post-spell-random-table-check-required',
      actorId: 'actor',
      spellId: 'counterspell',
    }))

    const noTable = resolveDnd5eHeadlessAction(cast.state, {
      type: 'resolve-post-spell-random-table',
      actorId: 'actor',
      featureId: TABLE_FEATURE_ID,
      triggerRoll: 2,
    })
    expect(noTable.ok, noTable.ok ? undefined : noTable.reason).toBe(true)
  })

  it('arms off turn after a Sorcerer shield reaction', () => {
    const input = state()
    input.distanceFeetByCombatantPair = {
      ...input.distanceFeetByCombatantPair,
      [dnd5eCombatantPairKey('actor', 'nearby')]: 5,
    }
    const attack = resolveDnd5eHeadlessAction(input, {
      type: 'opportunity-attack',
      actorId: 'nearby',
      targetId: 'actor',
      attackModifier: 2,
      d20: 14,
      shieldSpellReaction: true,
      damage: {
        count: 1,
        sides: 4,
        bonus: 0,
        rolls: [1],
        type: 'slashing',
      },
    })

    expect(attack.ok, attack.ok ? undefined : attack.reason).toBe(true)
    if (!attack.ok) return
    expect(attack.state.combatants.actor.classState.postSpellRandomTableCheck)
      .toMatchObject({ spellId: 'shield', spellLevel: 1, castingClassId: 'sorcerer' })
    expect(attack.state.combatants.actor.classResources['dnd5e-spell-slot-1'].current).toBe(0)
  })

  it('resolves a self-centered core fireball with one shared damage roll and per-target saves', () => {
    const input = pendingState()
    const plan = dnd5ePostSpellRandomTablePlan(input, 'actor', TABLE_FEATURE_ID, 1, 42)
    expect(plan?.effect).toEqual({
      spellId: 'fireball',
      slotLevel: 3,
      targetIds: ['actor', 'nearby'],
      saveAbility: 'dex',
      saveDc: 15,
      damageDice: { count: 8, sides: 6 },
    })

    const resolved = resolveDnd5eHeadlessAction(input, {
      type: 'resolve-post-spell-random-table',
      actorId: 'actor',
      featureId: TABLE_FEATURE_ID,
      triggerRoll: 1,
      tableRoll: 42,
      resolution: {
        schemaVersion: 1,
        targetIds: ['actor', 'nearby'],
        targetSavingThrows: [
          { targetId: 'actor', d20: 1 },
          { targetId: 'nearby', d20: 20 },
        ],
        effectRolls: Array(8).fill(1),
      },
    })

    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants.actor.currentHp).toBe(32)
    expect(resolved.state.combatants.nearby.currentHp).toBe(36)
    expect(resolved.state.combatants.far.currentHp).toBe(40)
    expect(resolved.state.combatants.actor.classResources['dnd5e-spell-slot-1'].current).toBe(1)
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: 'post-spell-random-table-outcome-resolved',
      tableRoll: 42,
      automation: 'full',
      spellId: 'fireball',
      targetIds: ['actor', 'nearby'],
    }))
  })

  it('forces the table and restores the linked expended use', () => {
    const input = pendingState(0)
    const resolved = resolveDnd5eHeadlessAction(input, {
      type: 'resolve-post-spell-random-table',
      actorId: 'actor',
      featureId: TABLE_FEATURE_ID,
      tableRoll: 50,
    })

    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants.actor.classResources[LINKED_USE_RESOURCE_ID]).toEqual({
      current: 1,
      max: 1,
    })
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: 'post-spell-random-table-outcome-resolved',
      tableRoll: 50,
      automation: 'manual',
    }))
    expect(resolved.state.combatants.actor.classState.postSpellRandomTableManualAdjudication)
      .toMatchObject({
        featureId: TABLE_FEATURE_ID,
        sourceSpellId: 'magic-missile',
        tableRoll: 50,
      })
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: 'post-spell-random-table-manual-adjudication-required',
      actorId: 'actor',
      tableRoll: 50,
    }))
  })

  it('pauses every other Headless action until the DM applies the final effects', () => {
    const tableResult = resolveDnd5eHeadlessAction(pendingState(), {
      type: 'resolve-post-spell-random-table',
      actorId: 'actor',
      featureId: TABLE_FEATURE_ID,
      triggerRoll: 1,
      tableRoll: 50,
    })
    expect(tableResult.ok, tableResult.ok ? undefined : tableResult.reason).toBe(true)
    if (!tableResult.ok) return
    const pending = tableResult.state.combatants.actor.classState.postSpellRandomTableManualAdjudication
    expect(pending).toBeDefined()
    if (!pending) return

    const blocked = resolveDnd5eHeadlessAction(tableResult.state, {
      type: 'end-turn',
      actorId: 'actor',
    })
    expect(blocked).toMatchObject({ ok: false, reason: 'dm-adjudication-pending' })

    const adjudicated = resolveDnd5eHeadlessAction(tableResult.state, {
      type: 'resolve-post-spell-random-table-manual-adjudication',
      actorId: 'actor',
      adjudicationId: pending.id,
      decision: 'approved',
      effects: [{
        targetId: 'nearby',
        operation: 'damage',
        amount: 7,
        addCondition: 'poisoned',
      }, {
        targetId: 'actor',
        operation: 'temporary-hit-points',
        amount: 4,
      }],
      note: 'Host final values',
    })
    expect(adjudicated.ok, adjudicated.ok ? undefined : adjudicated.reason).toBe(true)
    if (!adjudicated.ok) return
    expect(adjudicated.state.combatants.actor.classState.postSpellRandomTableManualAdjudication)
      .toBeUndefined()
    expect(adjudicated.state.combatants.nearby.currentHp).toBe(33)
    expect(adjudicated.state.combatants.nearby.conditions).toContain('poisoned')
    expect(adjudicated.state.combatants.actor.temporaryHp).toBe(4)
    expect(adjudicated.events).toContainEqual(expect.objectContaining({
      type: 'post-spell-random-table-manual-adjudication-resolved',
      decision: 'approved',
      effectCount: 2,
      note: 'Host final values',
    }))
  })

  it('lets the DM skip an unmapped result and rejects forged adjudication IDs atomically', () => {
    const tableResult = resolveDnd5eHeadlessAction(pendingState(), {
      type: 'resolve-post-spell-random-table',
      actorId: 'actor',
      featureId: TABLE_FEATURE_ID,
      triggerRoll: 1,
      tableRoll: 50,
    })
    expect(tableResult.ok, tableResult.ok ? undefined : tableResult.reason).toBe(true)
    if (!tableResult.ok) return
    const pending = tableResult.state.combatants.actor.classState.postSpellRandomTableManualAdjudication
    expect(pending).toBeDefined()
    if (!pending) return

    const forged = resolveDnd5eHeadlessAction(tableResult.state, {
      type: 'resolve-post-spell-random-table-manual-adjudication',
      actorId: 'actor',
      adjudicationId: `${pending.id}:forged`,
      decision: 'cancelled',
      effects: [],
    })
    expect(forged).toMatchObject({ ok: false, reason: 'dm-adjudication-pending' })
    expect(forged.state.combatants.actor.classState.postSpellRandomTableManualAdjudication)
      .toEqual(pending)

    const skipped = resolveDnd5eHeadlessAction(tableResult.state, {
      type: 'resolve-post-spell-random-table-manual-adjudication',
      actorId: 'actor',
      adjudicationId: pending.id,
      decision: 'cancelled',
      effects: [],
      note: 'DM skipped',
    })
    expect(skipped.ok, skipped.ok ? undefined : skipped.reason).toBe(true)
    if (!skipped.ok) return
    expect(skipped.state.combatants.actor.classState.postSpellRandomTableManualAdjudication)
      .toBeUndefined()
    expect(skipped.events).toContainEqual(expect.objectContaining({
      type: 'post-spell-random-table-manual-adjudication-resolved',
      decision: 'cancelled',
      effectCount: 0,
    }))
  })

  it('rejects omitted area targets and forged ownership without mutating the authoritative state', () => {
    const input = pendingState()
    const omittedSelf = resolveDnd5eHeadlessAction(input, {
      type: 'resolve-post-spell-random-table',
      actorId: 'actor',
      featureId: TABLE_FEATURE_ID,
      triggerRoll: 1,
      tableRoll: 42,
      resolution: {
        schemaVersion: 1,
        targetIds: ['nearby'],
        targetSavingThrows: [{ targetId: 'nearby', d20: 20 }],
        effectRolls: Array(8).fill(1),
      },
    })
    expect(omittedSelf).toMatchObject({ ok: false, reason: 'invalid-dice' })
    expect(omittedSelf.state.combatants.actor.currentHp).toBe(40)
    expect(omittedSelf.state.combatants.actor.classState.postSpellRandomTableCheck)
      .toEqual(input.combatants.actor.classState.postSpellRandomTableCheck)

    const forged = pendingState()
    forged.combatants.actor.pluginFeatureIds = []
    expect(dnd5ePostSpellRandomTablePlan(
      forged,
      'actor',
      TABLE_FEATURE_ID,
      1,
      7,
    )).toBeUndefined()
  })
})
