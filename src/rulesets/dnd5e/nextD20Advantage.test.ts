import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { validateDeclarativeSubclassDefinitionV1, type DeclarativeSubclassDefinitionV1 } from './declarativeSubclassAbility'
import {
  createDnd5eCombatant,
  dnd5eAbilityCheckRollMode,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import { consumeDnd5eNextD20Advantages, dnd5eNextD20AdvantageApplies } from './nextD20Advantage'
import { dnd5eSavingThrowMode } from './passiveDefenses'
import { registerDnd5eRulesPlugin, dnd5ePluginFeatureDefinition } from './pluginApi'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'
import { compileDnd5eActivityHeadlessAction } from './activities/dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './activities/dnd5eActivityFeatureActionAdapter'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './activities/dnd5eActivityCombatAuthority'

const PLUGIN_ID = 'com.example.next-d20'
const SUBCLASS_ID = `${PLUGIN_ID}:fortune-bearer`
const FEATURE_ID = `${SUBCLASS_ID}.prepared-fortune`
const RESOURCE_ID = `${PLUGIN_ID}:decl-fortune-bearer-prepared-fortune-uses`

const sequentialSaves: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'sequential-saves', name: 'Sequential saves', activation: { kind: 'free' },
  automation: automationCapabilityFromLegacyStatus('full'), target: { kind: 'self' },
  legacySource: { kind: 'feature', id: 'sequential-saves' },
  checks: [
    { id: 'first', kind: 'saving-throw', rollId: 'first', scope: 'per-target', ability: 'wis',
      dc: { kind: 'constant', value: 12 }, rollMode: 'host-derived', automaticSuccessIfConditionImmune: 'charmed' },
    { id: 'second', kind: 'saving-throw', rollId: 'second', scope: 'per-target', ability: 'wis',
      dc: { kind: 'constant', value: 12 }, rollMode: 'host-derived' },
  ],
  outcomes: [{ id: 'failed', when: { kind: 'check', checkId: 'second', result: 'failure' }, operations: [
    { id: 'damage', kind: 'damage', target: 'target', damageType: 'force', amount: { kind: 'constant', value: 5 } },
  ] }],
}

const actorSequences: Dnd5eActivityDefinitionV1[] = (['ability-check', 'concentration-check', 'opposed-ability-check'] as const).map(kind => ({
  ...sequentialSaves, id: `sequence-${kind}`, legacySource: { kind: 'feature', id: `sequence-${kind}` },
  target: kind === 'opposed-ability-check' ? { kind: 'creature', relation: 'any', count: 1 } : { kind: 'self' },
  checks: ['first', 'second'].map(id => kind === 'opposed-ability-check'
    ? { id, kind, rollId: id, opposedRollId: `${id}-defense`, scope: 'per-target', sourceAbility: 'wis',
      sourceModifier: { kind: 'constant', value: 0 }, sourceRollMode: 'host-derived', targetRollMode: 'host-derived', targetOptions: [{ ability: 'wis' }] }
    : { id, kind, rollId: id, scope: 'shared', ability: 'con', dc: { kind: 'constant', value: 12 }, rollMode: 'host-derived' }),
}))

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

const timedDefinition: DeclarativeSubclassDefinitionV1 = {
  ...definition, id: 'timed-fortune', abilities: definition.abilities.map(ability => ({ ...ability,
    mechanic: { kind: 'next-d20-advantage', rollKinds: ['attack', 'ability-check', 'saving-throw'], expiresAt: 'next-turn-start' },
  })),
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
  let disposeActivities: (() => void) | undefined

  beforeAll(() => {
    disposeActivities = registerDnd5eActivityPackage({ packageId: PLUGIN_ID, packageVersion: '1.0.0', activities: [sequentialSaves, ...actorSequences] }).dispose
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
        api.registerDeclarativeSubclass(timedDefinition)
        for (const activity of [sequentialSaves, ...actorSequences]) {
          api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
          api.registerFeature({ id: activity.id, name: activity.name, description: 'Synthetic sequence',
            summary: 'Synthetic sequence', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) })
        }
      },
    })
  })

  afterAll(() => { dispose?.(); disposeActivities?.() })

  it.each(['compiled', 'direct'] as const)('orders actor and opposed checks with saving-throw concentration semantics (%s)', route => {
    for (const { activity, pending } of actorSequences.flatMap(activity =>
      (activity.checks![0].kind === 'concentration-check' ? [false, true] : [false]).map(pending => ({ activity, pending })))) {
      const initial = activate().state
      const opposed = activity.checks![0].kind === 'opposed-ability-check'
      const concentration = activity.checks![0].kind === 'concentration-check'
      initial.combatants.actor.classState.nextD20Advantage!.rollKinds = [concentration ? 'saving-throw' : 'ability-check']
      if (pending) {
        initial.combatants.actor.classState.nextD20Advantage = undefined
        initial.combatants.actor.classState.concentrationCheckDisadvantagePendingSourceId = 'target'
      }
      initial.combatants.actor.pluginFeatureIds = [...initial.combatants.actor.pluginFeatureIds!, `${PLUGIN_ID}:${activity.id}`]
      initial.combatants.actor.savingThrowBonuses.con = 7
      if (opposed) initial.combatants.target = { ...structuredClone(initial.combatants.actor), id: 'target', name: 'target', controller: 'dm' }
      const targetId = opposed ? 'target' : 'actor'
      const rolls = Object.fromEntries(['first', 'second'].flatMap(id => [
        [opposed ? `${id}:target` : id, { values: pending ? [18, 2] : [2, 18], modifier: 0, total: 20 }],
        ...(opposed ? [[`${id}-defense:target`, { values: [3, 16], modifier: 0, total: 19 }]] : []),
      ]))
      const before = structuredClone(initial)
      const cast = route === 'compiled'
        ? { phase: 'commit' as const, result: resolveDnd5eHeadlessAction(initial, { type: 'plugin', pluginId: PLUGIN_ID,
          actionId: activity.id, featureId: `${PLUGIN_ID}:${activity.id}`, actorId: 'actor',
          targetId, targetIds: [targetId], rolls, distanceFeet: opposed ? 5 : 0 }) }
        : resolveRegisteredDnd5eActivityInCombatV1({ state: initial, combatRevision: 1, confirmedBy: 'actor', authoritativeRolls: rolls,
          command: { schemaVersion: 1, commandId: activity.id, actorId: 'actor', packageId: PLUGIN_ID, packageVersion: '1.0.0',
            activityId: activity.id, targetIds: [targetId], expectedRevision: 1 } })
      expect(initial).toEqual(before)
      expect(cast.result.ok, `${activity.id}: ${JSON.stringify(cast.result)}`).toBe(true)
      if (cast.phase !== 'commit' || !cast.result.ok) throw Error('Expected commit')
      const events = cast.result.events.filter(event => event.type === (opposed ? 'opposed-ability-check-resolved'
        : concentration ? 'concentration-resolved' : 'ability-check-resolved'))
      expect(events).toHaveLength(2)
      expect(events).toMatchObject(opposed
        ? [{ sourceD20: 18, targetD20: 16, success: true }, { sourceD20: 2, targetD20: 3, success: false }]
        : pending ? [{ d20: 2, total: 9, success: false }, { d20: 18, total: 25, success: true }]
        : [{ d20: 18, total: concentration ? 25 : 18, success: true }, { d20: 2, total: concentration ? 9 : 2, success: false }])
      expect(cast.result.state.combatants[targetId].currentHp).toBe(pending ? 30 : 25)
      expect(cast.result.state.combatants.actor.classState.nextD20Advantage).toBeUndefined()
      expect(cast.result.state.combatants.actor.classState.concentrationCheckDisadvantagePendingSourceId).toBeUndefined()
      if (opposed) expect(cast.result.state.combatants.target.classState.nextD20Advantage).toBeUndefined()
    }
  })

  it.each(['compiled', 'direct', 'compiled-effect', 'direct-effect'] as const)('uses the pending benefit once across Activity saves (%s)', route => {
    for (const scenario of ['ordinary', 'automatic-first', 'invalid-second'] as const) {
      const armed = activate()
      expect(armed.ok).toBe(true)
      const initial = armed.state
      if (route.endsWith('-effect')) {
        initial.combatants.actor.classState.nextD20Advantage = undefined
        initial.combatants.actor.classState.activeEffects = [createDnd5eMechanicalEffect({
          id: 'borrowed-experience', definitionId: 'borrowed-experience', label: 'Borrowed', targetId: 'actor',
          source: { kind: 'spell', actorId: 'actor', rulesId: 'borrowed-experience' },
          modifiers: { nextD20AdvantageRollKinds: ['attack', 'ability-check', 'saving-throw'] },
        })]
      }
      initial.combatants.actor.pluginFeatureIds = [...initial.combatants.actor.pluginFeatureIds!, `${PLUGIN_ID}:${sequentialSaves.id}`]
      if (scenario === 'automatic-first') initial.combatants.actor.conditionImmunities = ['charmed']
      const before = structuredClone(initial)
      const rolls = {
        ...(scenario === 'automatic-first' ? {} : { 'first:actor': { values: [2, 18], modifier: 0, total: 20 } }),
        'second:actor': { values: scenario === 'invalid-second' ? [22, 18] : [2, 18], modifier: 0,
          total: scenario === 'invalid-second' ? 40 : 20 },
      }
      const cast = route.startsWith('compiled')
        ? { phase: 'commit' as const, result: resolveDnd5eHeadlessAction(initial, { type: 'plugin', pluginId: PLUGIN_ID,
          actionId: sequentialSaves.id, featureId: `${PLUGIN_ID}:${sequentialSaves.id}`, actorId: 'actor',
          targetId: 'actor', targetIds: ['actor'], rolls, distanceFeet: 0 }) }
        : resolveRegisteredDnd5eActivityInCombatV1({ state: initial, combatRevision: 1, confirmedBy: 'actor', authoritativeRolls: rolls,
          command: { schemaVersion: 1, commandId: 'sequence', actorId: 'actor', packageId: PLUGIN_ID, packageVersion: '1.0.0',
            activityId: sequentialSaves.id, targetIds: ['actor'], expectedRevision: 1 } })
      expect(initial).toEqual(before)
      expect(cast.result.ok, JSON.stringify(cast.result)).toBe(scenario !== 'invalid-second')
      if (scenario === 'invalid-second') {
        if (cast.phase === 'commit') expect(cast.result.state).toEqual(initial)
        expect(dnd5eNextD20AdvantageApplies(initial.combatants.actor, 'saving-throw')).toBe(true)
        continue
      }
      if (cast.phase !== 'commit' || !cast.result.ok) throw Error('Expected commit')
      const saves = cast.result.events.filter(event => event.type === 'saving-throw-resolved')
      expect(saves).toHaveLength(2)
      expect(saves[1]).toMatchObject({ d20: scenario === 'automatic-first' ? 18 : 2, success: scenario === 'automatic-first' })
      expect(cast.result.state.combatants.actor.currentHp).toBe(scenario === 'automatic-first' ? 30 : 25)
      expect(cast.result.state.combatants.actor.classState.nextD20Advantage).toBeUndefined()
      expect(dnd5eNextD20AdvantageApplies(cast.result.state.combatants.actor, 'saving-throw')).toBe(false)
      expect(cast.result.events.filter(event => event.type === 'class-state-changed' && event.stateKey === 'next-d20-advantage' && !event.active)).toHaveLength(1)
    }
  })

  it.each(['save-succeeds', 'save-fails', 'later-invalid'] as const)('consumes one-roll advantage on a preceding ward save before the attack (%s)', scenario => {
    const saveFails = scenario === 'save-fails'
    const armed = activate()
    expect(armed.ok).toBe(true)
    const initial = armed.state
    initial.combatants.target.classId = 'monk'
    initial.combatants.target.subclassId = 'open-hand'
    initial.combatants.target.level = 11
    initial.combatants.target.classState.tranquilityActive = true
    const result = resolveDnd5eHeadlessAction(initial, { type: 'attack', actorId: 'actor', targetId: 'target',
      attackModifier: 0, d20: scenario === 'later-invalid' ? 18 : 2, d20Second: 18,
      tranquilitySave: { d20: 2, d20Second: saveFails ? 3 : 18 },
      damage: { count: 1, sides: 4, bonus: 0, rolls: [], type: 'force' } })
    expect(result.ok, JSON.stringify(result)).toBe(scenario !== 'later-invalid')
    if (scenario === 'later-invalid') {
      expect(result.state).toEqual(initial)
      expect(result.events).toEqual([])
      return
    }
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'saving-throw-resolved', targetId: 'actor',
      d20: saveFails ? 3 : 18, success: !saveFails }))
    const attacks = result.events.filter(event => event.type === 'attack-resolved')
    if (saveFails) expect(attacks).toEqual([])
    else expect(attacks).toMatchObject([{ d20: 2, hit: false }])
    expect(result.state.combatants.target.currentHp).toBe(30)
    expect(result.state.combatants.actor.classState.nextD20Advantage).toBeUndefined()
    expect(result.events.filter(event => event.type === 'class-state-changed' && event.stateKey === 'next-d20-advantage')).toHaveLength(1)
    expect(initial.combatants.actor.classState.nextD20Advantage).toBeDefined()
  })

  it.each([false, true])('uses pending advantage only on the first attack in a composite action, rolling back failures (%s)', invalidSecond => {
    const armed = activate()
    expect(armed.ok).toBe(true)
    const initial = armed.state
    initial.combatants.actor.classLevels = { sorcerer: 6, monk: 2 }
    initial.combatants.actor.classResources['dnd5e-ki'] = { current: 1, max: 1 }
    initial.combatants.actor.classState.monkAttackActionTurnKey = 'next-d20-combat:1:actor'
    const before = structuredClone(initial)
    const result = resolveDnd5eHeadlessAction(initial, { type: 'monk-unarmed-bonus', actorId: 'actor', mode: 'flurry',
      attackModifier: 0, damage: { count: 1, sides: 4, bonus: 0 }, reachFeet: 5, damageType: 'bludgeoning',
      attacks: [{ targetId: 'target', d20: 2, d20Second: 18, damageRolls: [2] },
        { targetId: invalidSecond ? 'absent' : 'target', d20: 2, d20Second: 18, damageRolls: [] }] })
    expect(result.ok, JSON.stringify(result)).toBe(!invalidSecond)
    expect(initial).toEqual(before)
    if (invalidSecond) {
      expect(result.state).toEqual(initial)
      expect(result.events).toEqual([])
    } else {
      expect(result.events.filter(event => event.type === 'attack-resolved')).toMatchObject([
        { d20: 18, hit: true }, { d20: 2, hit: false },
      ])
      expect(result.state.combatants.target.currentHp).toBe(28)
      expect(result.state.combatants.actor.classState.nextD20Advantage).toBeUndefined()
      expect(result.events.filter(event => event.type === 'class-state-changed' && event.stateKey === 'next-d20-advantage')).toHaveLength(1)
    }
  })

  it('does not consume pending advantage for automatic outcomes with no actual d20 check', () => {
    const armed = activate()
    expect(armed.ok).toBe(true)
    const events: import('./headlessCombatEngine').Dnd5eCombatEvent[] = []
    consumeDnd5eNextD20Advantages(armed.state, [
      { type: 'saving-throw-resolved', targetId: 'actor', ability: 'str', d20: 0, modifier: 0, total: 12,
        dc: 12, success: true, automaticOutcome: 'size-rule-success' },
      { type: 'saving-throw-resolved', targetId: 'actor', ability: 'str', d20: 0, modifier: 0, total: 0,
        dc: 12, success: false, automaticOutcome: 'dm-adjusted-automatic-failure' },
      { type: 'ability-check-resolved', actorId: 'actor', ability: 'wis', d20: 10, modifier: 0, total: 10,
        mode: 'normal', reliableTalentApplied: false, automatic: true },
      { type: 'saving-throw-resolved', targetId: 'actor', ability: 'wis', d20: 10, modifier: 0, total: 10,
        dc: 12, success: true, automaticOutcome: 'condition-immunity-success' },
      { type: 'saving-throw-resolved', targetId: 'actor', ability: 'wis', d20: 10, modifier: 0, total: 10,
        dc: 12, success: false, automaticOutcome: 'allied-unresisted-failure' },
    ], events)
    expect(armed.state.combatants.actor.classState.nextD20Advantage).toBeDefined()
    expect(events).toEqual([])
  })

  it('expires unused timed advantage on the next owner turn, surviving same-turn reentry and JSON reload', () => {
    const initial = state()
    const timedSubclassId = `${PLUGIN_ID}:timed-fortune`
    const timedFeatureId = `${timedSubclassId}.prepared-fortune`
    const owner = initial.combatants.actor
    owner.subclassId = timedSubclassId
    owner.subclassIds = { sorcerer: timedSubclassId }
    owner.pluginFeatureIds = [timedFeatureId]
    owner.classResources = { [`${PLUGIN_ID}:decl-timed-fortune-prepared-fortune-uses`]: { current: 1, max: 1 } }
    expect(dnd5ePluginFeatureDefinition(timedFeatureId)?.declarativeAbility?.mechanic).toMatchObject({ expiresAt: 'next-turn-start' })
    const armed = resolveDnd5eHeadlessAction(initial, { type: 'plugin', pluginId: PLUGIN_ID,
      transactionId: 'activate-timed-advantage',
      actionId: 'decl.timed-fortune.prepared-fortune', featureId: timedFeatureId,
      actorId: 'actor', targetId: 'actor', targetIds: ['actor'], distanceFeet: 0 })
    expect(armed.ok, JSON.stringify(armed)).toBe(true)
    expect(armed.state.combatants.actor.classState.nextD20Advantage?.expiresAfterTurnKey).toBe('next-d20-combat:1:actor')
    let current = JSON.parse(JSON.stringify(armed.state)) as typeof initial
    const reentry = resolveDnd5eHeadlessAction(current, { type: 'begin-turn', actorId: 'actor' })
    expect(reentry.ok).toBe(true)
    expect(reentry.state.combatants.actor.classState.nextD20Advantage).toBeDefined()
    current = reentry.state
    const ownerEnd = resolveDnd5eHeadlessAction(current, { type: 'end-turn', actorId: 'actor' })
    expect(ownerEnd.ok).toBe(true)
    expect(dnd5eNextD20AdvantageApplies(ownerEnd.state.combatants.actor, 'attack')).toBe(true)
    const otherCheck = resolveDnd5eHeadlessAction(ownerEnd.state, { type: 'ability-check', actorId: 'target', ability: 'wis', d20: 12, dc: 10 })
    expect(otherCheck.ok).toBe(true)
    expect(otherCheck.state.combatants.actor.classState.nextD20Advantage).toBeDefined()
    const nextOwner = resolveDnd5eHeadlessAction(otherCheck.state, { type: 'end-turn', actorId: 'target' })
    expect(nextOwner.ok).toBe(true)
    expect(nextOwner.state.combatants.actor.classState.nextD20Advantage).toBeUndefined()
    expect(nextOwner.events.filter(event => event.type === 'class-state-changed' && event.stateKey === 'next-d20-advantage'))
      .toEqual([expect.objectContaining({ actorId: 'actor', active: false })])
    expect(dnd5eNextD20AdvantageApplies(nextOwner.state.combatants.actor, 'attack')).toBe(false)
    expect(initial.combatants.actor.classState.nextD20Advantage).toBeUndefined()
  })

  it('keeps legacy untimed markers until a qualifying roll and rejects invented expiry modes', () => {
    const armed = activate()
    expect(armed.ok).toBe(true)
    expect(armed.state.combatants.actor.classState.nextD20Advantage).not.toHaveProperty('expiresAfterTurnKey')
    const ownerEnd = resolveDnd5eHeadlessAction(armed.state, { type: 'end-turn', actorId: 'actor' })
    expect(ownerEnd.ok).toBe(true)
    const otherEnd = resolveDnd5eHeadlessAction(ownerEnd.state, { type: 'end-turn', actorId: 'target' })
    expect(otherEnd.ok).toBe(true)
    expect(dnd5eNextD20AdvantageApplies(otherEnd.state.combatants.actor, 'attack')).toBe(true)
    const malformed = JSON.parse(JSON.stringify(timedDefinition))
    malformed.abilities[0].mechanic.expiresAt = 'any-turn-start'
    expect(() => validateDeclarativeSubclassDefinitionV1(malformed)).toThrow('next d20 expiry is invalid')
  })

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
    // A creature downed during its own turn first saves at its next turn start.
    expect(resolveDnd5eHeadlessAction(armed.state, {
      type: 'death-save', actorId: 'actor', d20: 2, d20Second: 18,
    })).toMatchObject({ ok: false, reason: 'invalid-actor' })
    const ended = resolveDnd5eHeadlessAction(armed.state, { type: 'end-turn', actorId: 'actor' })
    expect(ended.ok).toBe(true)
    const next = resolveDnd5eHeadlessAction(ended.state, { type: 'end-turn', actorId: 'target' })
    expect(next.ok).toBe(true)
    const save = resolveDnd5eHeadlessAction(next.state, {
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
