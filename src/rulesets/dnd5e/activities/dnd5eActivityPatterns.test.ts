import { registerDnd5eActivityPackage, clearDnd5eActivityRegistryForTests } from './dnd5eActivityRegistry'
import { dnd5eCombatantPairKey } from '../headlessCombatPrimitives'
import { afterEach, describe, expect, it } from 'vitest'
import { compileDnd5eActivityPatternV1 as compile, expandDnd5eActivityPatternsV1, type Dnd5eActivityPatternV1 } from './dnd5eActivityPatterns'
import { resolveDnd5eActivity, type Dnd5eActivityExecutionInput } from './dnd5eActivityExecutor'
import { dnd5eActivityHeadlessCompatibility } from './dnd5eActivityHeadlessCompiler'
import { resolveDnd5eHeadlessAction, commitDnd5eActivityExecution, createDnd5eCombatant, endDnd5eConcentration, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { resolveRegisteredDnd5eActivityInCombatV1, dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import { prepareDnd5eLocalContentJson } from '../localContentCollection'
import { exportPdfContentModule } from '../pdfContentModule'
import { projectDnd5eStarModRuntime } from '../starModAdapter'
import { parseDnd5eContentPackageV2 } from '../contentPackageV2'
import healingExample from '../../../../examples/activity-pattern-healing.json?raw'
import { DND5E_ACTIVITY_AUTHORING_EXAMPLES } from './dnd5eActivityAuthoringExamples'
import { dnd5eActivityLanguageChoicesV1 } from './dnd5eActivityChoices'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

afterEach(clearDnd5eActivityRegistryForTests)

const base = { schemaVersion: 1 as const, id: 'sample', name: 'Synthetic', source: { kind: 'feature' as const, id: 'sample' }, target: { kind: 'creature' as const, relation: 'any' as const, count: 1, rangeFeet: 30 } }
const amount = { kind: 'constant' as const, value: 6 }
function fixture() {
  const actor = createDnd5eCombatant({ id: 'actor', name: 'Actor', controller: 'player', initiative: 20, abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 }, proficiencyBonus: 3, armorClass: 14, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, saveDc: 15, position: { x: 0, y: 0 }, concentrating: false, classResources: { focus: { current: 3, max: 5 } } })
  const target = createDnd5eCombatant({ ...actor, id: 'target', name: 'Target', controller: 'dm', initiative: 10, currentHp: 20, position: { x: 5, y: 0 }, classResources: {} })
  const state = startDnd5eHeadlessCombat('patterns', [actor, target])
  return { state, actor: dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.actor), target: dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.target) }
}
function resolve(pattern: Dnd5eActivityPatternV1, extra: Partial<Dnd5eActivityExecutionInput> = {}) {
  const f = fixture(); const activity = compile(pattern)
  expect(dnd5eActivityHeadlessCompatibility(activity, { outerSpellTransaction: true })).toEqual({ supported: true, reasons: [] })
  const result = resolveDnd5eActivity({ activity, actor: f.actor, targets: [f.target], rolls: {}, checkRollModes: { 'check:target': 'normal' }, distanceFeetByTargetId: { target: 5 }, ...extra })
  expect(result, JSON.stringify(result)).toMatchObject({ ok: true })
  return { ...f, activity, result }
}
describe('A1–A8 declarative Activity authoring', () => {
  it('expands compact Hit Dice benefits with one setup, guarded costs and explicit per-pool floors', () => {
    const pattern: Dnd5eActivityPatternV1 = { ...base, target: { kind: 'self' }, activation: { kind: 'free' },
      pattern: 'hit-dice-benefit', pools: [{ sides: 6, maximumCount: 20 }, { sides: 10, maximumCount: 20 }],
      abilityPerDie: 'con', minimumPerPoolAmount: 1, maximumTotalFraction: 0.5,
      effects: [{ schemaVersion: 1, id: 'marker', name: 'Synthetic', duration: { kind: 'permanent' }, stacking: 'replace' }],
      setup: [{ id: 'marker', kind: 'apply-effect', target: 'actor', effectId: 'marker' }],
      result: { kind: 'healing', target: 'actor' } }
    const activity = compile(pattern)
    expect(JSON.stringify(activity).length).toBeGreaterThan(JSON.stringify(pattern).length * 10)
    const f = fixture()
    const actor = { ...f.actor, abilities: { ...f.actor.abilities, con: 6 }, currentHp: 5,
      hitPointDice: [{ sides: 6, current: 2, max: 2 }, { sides: 10, current: 2, max: 2 }] }
    for (const [d6, d10] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const rolls = Object.fromEntries([[6, d6], [10, d10]].filter(([, count]) => count > 0)
        .map(([sides, count]) => [`hit-dice-${sides}-${count}`, { values: [1] }]))
      const resolved = resolveDnd5eActivity({ activity, actor, targets: [actor], rolls,
        choices: { 'hit-dice-6': String(d6), 'hit-dice-10': String(d10) } })
      expect(resolved.ok).toBe(true)
      if (!resolved.ok) throw Error(resolved.reason)
      expect(resolved.proposals.filter(proposal => proposal.kind === 'apply-effect')).toHaveLength(d6 + d10 ? 1 : 0)
      const benefits = resolved.proposals.filter(proposal => proposal.kind === 'heal')
      expect(benefits).toHaveLength(d6 + d10)
      expect(benefits.every(proposal => proposal.amount === 1)).toBe(true)
    }
    expect(() => compile({ ...pattern, pools: [{ sides: 6, maximumCount: 101 }] })).toThrow('Invalid Hit Dice')
    expect(() => compile({ ...pattern, pools: [{ sides: 6, maximumCount: 2 }, { sides: 6, maximumCount: 2 }] })).toThrow('Invalid Hit Dice')
    const expanded = expandDnd5eActivityPatternsV1({ activityPatterns: [pattern] })
    expect(expanded).not.toHaveProperty('activityPatterns')
    expect(expanded.activities).toEqual([activity])
  })
  it('passes source ground contact through area execution and rejects malformed imported flags', () => {
    const pattern: Dnd5eActivityPatternV1 = {
      ...base, pattern: 'area',
      target: {kind:'area',origin:'point',relation:'enemy',shape:'sphere',radiusFeet:15,placeRangeFeet:30,maximumTargets:10},
      area: {label:'Terrain',durationRounds:10,concentration:true,movementCostMultiplier:2,movementRequiresGroundedSource:true,movementExcludesSource:true},
    }
    const result = resolve(pattern, {areaPlacement:{x:5,y:0},areaPlacementDistanceFeet:5})
    expect(result.result).toMatchObject({ok:true,proposals:[{kind:'create-persistent-area',movementCostMultiplier:2,movementRequiresGroundedSource:true,movementExcludesSource:true}]})
    expect(validateDnd5eActivityDefinitionV1(compile(pattern))).toEqual([])
    const invalid = JSON.parse(JSON.stringify(pattern))
    invalid.area.movementRequiresGroundedSource = 'true'
    expect(() => compile(invalid)).toThrow('movementRequiresGroundedSource is invalid')
    for (const value of ['true', 1, {}, []]) {
      const malformed = JSON.parse(JSON.stringify(pattern))
      malformed.area.movementExcludesSource = value
      expect(() => compile(malformed)).toThrow('movementExcludesSource is invalid')
    }
  })
  it('preserves a dynamic summon catalogue through module export and fresh import', async () => {
    const example = DND5E_ACTIVITY_AUTHORING_EXAMPLES.find(entry => entry.id === 'example-controlled-summon')!
    const pattern = { ...example, source: { kind: 'feature' as const, id: 'sample' } }
    const content = { features: [{ id: 'sample', name: 'Sample', summary: 'Synthetic', description: 'Synthetic feature', automation: 'partial' }], activityPatterns: [pattern] }
    const exported = await exportPdfContentModule({ id: 'local.catalogue', name: 'Catalogue', version: '1.0.0', inventoryComplete: true,
      entries: [{ sourceId: 'catalogue', name: 'Catalogue', draft: { schemaVersion: 1, contentJson: JSON.stringify(content), assumptions: [], unsupported: [] } }] })
    const parsed = parseDnd5eContentPackageV2(await projectDnd5eStarModRuntime(exported.bytes))!
    const activity = parsed.content.activities![0]
    expect(activity.choices![0]).toMatchObject({ optionsFrom: 'srd-monsters', options: [],
      monsterFilter: { creatureTypes: ['fiend'], subtype: 'demon', maximumChallengeRating: 1 } })
    expect(dnd5eActivityLanguageChoicesV1(activity).choices![0].options.map(option => option.id).sort())
      .toEqual(['srd-5.1:dretch', 'srd-5.1:quasit'])
  })
  it('executes the published level table at and between every tier boundary', () => {
    const example = DND5E_ACTIVITY_AUTHORING_EXAMPLES.find(entry => entry.id === 'example-tiered')!
    for (const [level, count] of [[1, 1], [4, 1], [5, 2], [10, 2], [11, 3], [16, 3], [17, 4], [20, 4]]) {
      const f = resolve(example, { actor: { ...fixture().actor, level }, rolls: { 'save:target': { values: [1] }, damage: { values: Array(count).fill(2) } } })
      expect(f.result).toMatchObject({ ok: true, proposals: [{ kind: 'deal-damage', amount: count * 2 }] })
    }
  })
  it('compiles every published AI authoring example into supported Headless activities', () => {
    for (const example of DND5E_ACTIVITY_AUTHORING_EXAMPLES) {
      const activity = compile(example)
      expect(dnd5eActivityHeadlessCompatibility(activity, { outerSpellTransaction: true })).toEqual({ supported: true, reasons: [] })
    }
  })
  it('A1 uses actor DC and applies save success/failure, slot scaling and healing in real combat', () => {
    for (const [save, expected] of [[1, 9], [20, 4]]) {
      const f = resolve({ ...base, pattern: 'roll-effect', check: { kind: 'save', ability: 'dex' }, result: { kind: 'damage', damageType: 'fire', amount: { kind: 'dice', rollId: 'damage', count: 2, sides: 6 } }, saveSuccess: 'half',
        scaling: [{ basis: 'slot-level', baseLevel: 2, adjustments: [{ operationId: 'result', diceCountPerStep: 1 }, { operationId: 'saved-result', diceCountPerStep: 1 }] }] },
      { castLevel: 3, rolls: { 'save:target': { values: [save] }, damage: { values: [2, 3, 4] } } })
      const commit = commitDnd5eActivityExecution(f.state, { actorId: 'actor', activityId: f.activity.id, targetIds: ['target'], resolution: f.result })
      expect(commit.ok, JSON.stringify(commit)).toBe(true)
      expect(commit.state.combatants.target.currentHp).toBe(20 - expected)
    }
    const f = resolve({ ...base, pattern: 'roll-effect', result: { kind: 'healing', amount } })
    expect(commitDnd5eActivityExecution(f.state, { actorId: 'actor', activityId: 'heal', targetIds: ['target'], resolution: f.result }).state.combatants.target.currentHp).toBe(26)
  })
  it('scales the generated saved-result automatically without requiring a duplicated authoring rule', () => {
    for (const [save, expected] of [[1, 9], [20, 4]]) {
      const f = resolve({ ...base, pattern: 'roll-effect', check: { kind: 'save', ability: 'dex' },
        result: { kind: 'damage', damageType: 'fire', amount: { kind: 'dice', rollId: 'damage', count: 2, sides: 6 } }, saveSuccess: 'half',
        scaling: [{ basis: 'slot-level', baseLevel: 2, adjustments: [{ operationId: 'result', diceCountPerStep: 1 }] }] },
        { castLevel: 3, rolls: { 'save:target': { values: [save] }, damage: { values: [2, 3, 4] } } })
      const commit = commitDnd5eActivityExecution(f.state, { actorId: 'actor', activityId: f.activity.id, targetIds: ['target'], resolution: f.result })
      expect(commit.ok).toBe(true)
      expect(commit.state.combatants.target.currentHp).toBe(20 - expected)
    }
  })
  it('A2 keeps a condition tied to concentration and removes it when concentration ends', () => {
    const f = resolve({ ...base, pattern: 'condition', condition: 'frightened', duration: { kind: 'concentration', maximumRounds: 10 }, check: { kind: 'save', ability: 'wis' } }, { rolls: { 'save:target': { values: [1] } } })
    const commit = commitDnd5eActivityExecution(f.state, { actorId: 'actor', activityId: 'fear', targetIds: ['target'], resolution: f.result, source: { kind: 'spell', id: 'test-fear' } })
    expect(commit.ok, JSON.stringify(commit)).toBe(true)
    expect(commit.state.combatants.target.conditions).toContain('frightened')
    endDnd5eConcentration(commit.state, commit.state.combatants.actor, [])
    expect(commit.state.combatants.target.conditions).not.toContain('frightened')
  })
  it('A3 resolves only the selected branch and rejects a forged choice', () => {
    const pattern: Dnd5eActivityPatternV1 = { ...base, pattern: 'choice', label: 'Mode', branches: ['fire', 'cold'].map(id => ({ id, label: id, outcomes: [{ id: 'hit', when: { kind: 'always' }, operations: [{ id: 'damage', kind: 'damage', target: 'target', damageType: id as 'fire' | 'cold', amount }] }] })) }
    const f = resolve(pattern, { choices: { mode: 'cold' } })
    expect(f.result).toMatchObject({ proposals: [{ kind: 'deal-damage', damageType: 'cold', amount: 6 }] })
    if (f.result.ok) expect(f.result.proposals).toHaveLength(1)
    expect(resolveDnd5eActivity({ activity: f.activity, actor: f.actor, targets: [f.target], rolls: {}, choices: { mode: 'forged' }, distanceFeetByTargetId: { target: 5 } }).ok).toBe(false)
  })
  it('A4 spends and restores only an existing Host resource, rejecting overspending atomically', () => {
    for (const [mode, expected] of [['spend', 1], ['restore', 5]] as const) {
      const f = resolve({ ...base, pattern: 'resource', resourceId: 'focus', mode, amount: { kind: 'constant', value: 2 } })
      const commit = commitDnd5eActivityExecution(f.state, { actorId: 'actor', activityId: 'resource', targetIds: ['target'], resolution: f.result })
      expect(commit.ok).toBe(true); expect(commit.state.combatants.actor.classResources.focus.current).toBe(expected)
    }
    const f = fixture()
    const result = resolveDnd5eActivity({ activity: compile({ ...base, pattern: 'resource', resourceId: 'focus', mode: 'spend', amount: { kind: 'constant', value: 99 } }), actor: f.actor, targets: [f.target], rolls: {}, distanceFeetByTargetId: { target: 5 } })
    const commit = commitDnd5eActivityExecution(f.state, { actorId: 'actor', activityId: 'overspend', targetIds: ['target'], resolution: result })
    expect(commit.ok).toBe(false); expect(f.state.combatants.actor.classResources.focus.current).toBe(3)
  })
  it('A5 persists delayed damage without rolling it or dealing it during the cast', () => {
    const f = resolve({ ...base, pattern: 'timed-effect', effect: { schemaVersion: 1, id: 'delayed', name: 'Delayed', duration: { kind: 'rounds', rounds: 1, expiresAt: 'target-turn-end' }, stacking: 'unique-by-source', periodicDamage: { timing: 'target-turn-end', count: 2, sides: 4, type: 'acid' } } })
    const commit = commitDnd5eActivityExecution(f.state, { actorId: 'actor', activityId: 'delay', targetIds: ['target'], resolution: f.result })
    expect(commit.ok, JSON.stringify(commit)).toBe(true)
    expect(commit.state.combatants.target.currentHp).toBe(20)
    const effect = commit.state.combatants.target.classState.activeEffects?.find(e => e.periodicDamage)
    expect(effect?.periodicDamage).toMatchObject({ count: 2, sides: 4 })
    const actorEnd = resolveDnd5eHeadlessAction(commit.state, { type: 'end-turn', actorId: 'actor' })
    expect(actorEnd.ok).toBe(true)
    const targetEnd = resolveDnd5eHeadlessAction(actorEnd.state, { type: 'end-turn', actorId: 'target', activeEffectPeriodicDamageRolls: [{ effectId: effect!.id, targetId: 'target', rolls: [2, 3] }] })
    expect(targetEnd.ok, JSON.stringify(targetEnd)).toBe(true)
    expect(targetEnd.state.combatants.target.currentHp).toBe(15)
    expect(targetEnd.state.combatants.target.classState.activeEffects?.some(e => e.id === effect!.id)).not.toBe(true)
  })
  it('A6 grants a follow-up to the target and removes its authorization with the effect', () => {
    const f = resolve({ ...base, pattern: 'grant-actions', actionIds: ['follow-up'], effect: { schemaVersion: 1, id: 'grant', name: 'Grant', duration: { kind: 'concentration', maximumRounds: 10 }, concentration: true, stacking: 'replace' } })
    const commit = commitDnd5eActivityExecution(f.state, { actorId: 'actor', activityId: 'grant', targetIds: ['target'], resolution: f.result })
    expect(commit.ok).toBe(true)
    expect(commit.state.combatants.target.classState.activeEffects?.some(e => e.grantedActivities?.includes('follow-up'))).toBe(true)
    endDnd5eConcentration(commit.state, commit.state.combatants.actor, [])
    expect(commit.state.combatants.target.classState.activeEffects?.some(e => e.grantedActivities?.includes('follow-up'))).not.toBe(true)
  })
  it('A6 lets a different bearer execute a granted action using the caster DC, and rejects another package', () => {
    const parent: Dnd5eActivityPatternV1 = { ...base, id: 'grant-spell', source: { kind: 'spell', id: 'sample-spell' }, pattern: 'grant-actions', actionIds: ['breath'], effect: { schemaVersion: 1, id: 'breath-grant', name: 'Breath grant', concentration: true, duration: { kind: 'concentration', maximumRounds: 10 }, stacking: 'replace' } }
    const child: Dnd5eActivityPatternV1 = { ...base, id: 'breath', source: { kind: 'spell', id: 'sample-spell' }, pattern: 'roll-effect', check: { kind: 'save', ability: 'dex' }, result: { kind: 'damage', amount, damageType: 'fire' } }
    const expanded = expandDnd5eActivityPatternsV1({ activityPatterns: [parent, child] })
    const activities = expanded.activities as ReturnType<typeof compile>[]
    registerDnd5eActivityPackage({ packageId: 'local.grant-test', packageVersion: '1.0.0', activities })
    registerDnd5eActivityPackage({ packageId: 'local.foreign', packageVersion: '1.0.0', activities })
    const f = fixture()
    const resolution = resolveDnd5eActivity({ activity: activities[0], actor: f.actor, targets: [f.target], rolls: {}, distanceFeetByTargetId: { target: 5 } })
    const cast = commitDnd5eActivityExecution(f.state, { actorId: 'actor', activityId: activities[0].id, targetIds: ['target'], resolution, source: { kind: 'spell', id: 'sample-spell', packageId: 'local.grant-test' } })
    expect(cast.ok).toBe(true)
    const advance = resolveDnd5eHeadlessAction(cast.state, { type: 'end-turn', actorId: 'actor' })
    advance.state.combatants.target.saveDc = 10
    advance.state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'target')]: 5 }
    const command = { schemaVersion: 1 as const, commandId: 'breath-1', actorId: 'target', packageId: 'local.grant-test', packageVersion: '1.0.0', activityId: 'breath', targetIds: ['actor'], expectedRevision: 1 }
    const foreign = resolveRegisteredDnd5eActivityInCombatV1({ state: advance.state, combatRevision: 1, command: { ...command, packageId: 'local.foreign' }, authoritativeRolls: {}, confirmedBy: 'actor' })
    expect(foreign).toMatchObject({ phase: 'resolve', result: { ok: false, reason: 'unauthorized-actor' } })
    const resolved = resolveRegisteredDnd5eActivityInCombatV1({ state: advance.state, combatRevision: 1, command, authoritativeRolls: { 'save:actor': { values: [11] } }, checkRollModes: { 'check:actor': 'normal' }, confirmedBy: 'actor' })
    expect(resolved.phase, JSON.stringify(resolved)).toBe('commit')
    if (resolved.phase !== 'commit') return
    expect(resolved.result.ok, JSON.stringify(resolved)).toBe(true)
    expect(resolved.result.state.combatants.actor.currentHp).toBe(24)
    endDnd5eConcentration(advance.state, advance.state.combatants.actor, [])
    const expired = resolveRegisteredDnd5eActivityInCombatV1({ state: advance.state, combatRevision: 1, command, authoritativeRolls: {}, confirmedBy: 'actor' })
    expect(expired).toMatchObject({ phase: 'resolve', result: { ok: false, reason: 'unauthorized-actor' } })
  })
  it('A7 and A8 compile persistent areas and Host-validated movement', () => {
    const area = resolve({ ...base, pattern: 'area', target: { kind: 'area', origin: 'point', relation: 'any', shape: 'cube', widthFeet: 5, heightFeet: 5, placeRangeFeet: 30, maximumTargets: 10 }, area: { label: 'Test area', durationRounds: 10, concentration: true, triggers: [{ id: 'entry', label: 'Entry', timing: 'on-enter', oncePerTurn: true, damage: { count: 1, sides: 6, type: 'fire' } }] } }, { areaPlacement: { x: 5, y: 0 }, areaPlacementDistanceFeet: 5 })
    expect(area.result).toMatchObject({ proposals: [expect.objectContaining({ kind: 'create-persistent-area' })] })
    const moved = resolve({ ...base, pattern: 'movement', movement: { kind: 'move', target: 'target', mode: 'push', distanceFeet: { kind: 'constant', value: 10 }, placement: 'host-automatic-maximum' } })
    expect(moved.result).toMatchObject({ proposals: [expect.objectContaining({ kind: 'move', distanceFeet: 10 })] })
  })
  it('compiles on import, exports portable native activities and rejects missing grants or duplicate IDs', async () => {
    const example = await prepareDnd5eLocalContentJson(healingExample)
    expect(example.package.content.activities?.[0].id).toBe('pattern-healing-demo')
    const pattern: Dnd5eActivityPatternV1 = { ...base, pattern: 'roll-effect', result: { kind: 'healing', amount } }
    const content = { features: [{ id: 'sample', name: 'Sample', summary: 'Synthetic', description: 'Synthetic feature', automation: 'partial' }], activityPatterns: [pattern] }
    const prepared = await prepareDnd5eLocalContentJson(JSON.stringify(content))
    expect(prepared.package.content.activities).toHaveLength(1)
    const exported = await exportPdfContentModule({ id: 'local.patterns', name: 'Patterns', version: '1.0.0', inventoryComplete: true, entries: [{ sourceId: 'test', name: 'Test', draft: { schemaVersion: 1, contentJson: JSON.stringify(content), assumptions: [], unsupported: [] } }] })
    const parsed = parseDnd5eContentPackageV2(await projectDnd5eStarModRuntime(exported.bytes))!
    expect(parsed.content.activities?.[0].id).toBe('sample')
    expect(parsed.content).not.toHaveProperty('activityPatterns')
    expect(() => expandDnd5eActivityPatternsV1({ ...content, activityPatterns: [pattern, pattern] })).toThrow('Duplicate')
    expect(() => expandDnd5eActivityPatternsV1({ activityPatterns: [{ ...base, pattern: 'grant-actions', actionIds: ['missing'], effect: { schemaVersion: 1, id: 'grant', name: 'Grant', duration: { kind: 'permanent' }, stacking: 'replace' } }] })).toThrow('Unknown granted')
  })
})
