import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { dnd5eTargetCriticalThreshold } from './targetCriticalThreshold'
import { createDnd5eCombatant, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { compileDnd5eActivityPatternV1 } from './activities/dnd5eActivityPatterns'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './activities/dnd5eActivityCombatAuthority'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'

const mark = () => createDnd5eMechanicalEffect({ definitionId: 'mark', label: 'Mark', targetId: 'target',
  source: { kind: 'feature', actorId: 'actor' }, modifiers: { attacksBySourceCriticalThreshold: 19 } })
const combatant = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative,
  controller: 'player', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  proficiencyBonus: 2, armorClass: 30, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30,
  position: { x: 0, y: 0 }, concentrating: false })

it('preserves source identity through serialization and excludes foreign, removed and suspended effects', () => {
  const effects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([mark()])))
  expect(validateDnd5eActiveEffectsStrict(effects).ok).toBe(true)
  expect(dnd5eTargetCriticalThreshold(effects, 'actor')).toBe(19)
  expect(dnd5eTargetCriticalThreshold(effects, 'other')).toBe(20)
  expect(dnd5eTargetCriticalThreshold(effects, undefined)).toBe(20)
  expect(dnd5eTargetCriticalThreshold(effects, 'actor', 18)).toBe(18)
  expect(dnd5eTargetCriticalThreshold([], 'actor')).toBe(20)
  expect(dnd5eTargetCriticalThreshold(effects.map(effect => ({ ...effect, suspendedBy: ['antimagic'] })), 'actor')).toBe(20)
  for (const value of [1, 21, 19.5, '19']) {
    expect(validateDnd5eActiveEffectsStrict([{ ...mark(), modifiers: { attacksBySourceCriticalThreshold: value } }]).ok).toBe(false)
  }
})

it.each(['own', 'foreign', 'suspended', 'removed'])('settles native attacks with current defender effects: %s', mode => {
  const state = startDnd5eHeadlessCombat('crit', [combatant('actor', 20), combatant('target', 10)])
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'target')]: 5 }
  const effect = mark()
  if (mode === 'foreign') effect.source.actorId = 'other'
  if (mode === 'suspended') effect.suspendedBy = ['antimagic']
  state.combatants.target.classState.activeEffects = mode === 'removed' ? [] : [effect]
  const before = structuredClone(state)
  const result = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: 'actor', targetId: 'target',
    attackModifier: 0, d20: 19, damage: { count: 1, sides: 6, bonus: 0, rolls: mode === 'own' ? [3, 4] : [] } })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  expect(result.state.combatants.target.currentHp).toBe(mode === 'own' ? 23 : 30)
  expect(state).toEqual(before)
})

it.each(['shocking-grasp', 'fire-bolt'])('applies the target range to native spell attacks: %s', spellId => {
  const state = startDnd5eHeadlessCombat('spell-crit', [combatant('actor', 20), combatant('target', 10)])
  state.combatants.target.controller = 'dm'
  Object.assign(state.combatants.actor, { classId: 'wizard', level: 1,
    classSelections: { 'spell-cantrips': [spellId] } })
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'target')]: 5 }
  state.combatants.target.classState.activeEffects = [mark()]
  const result = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: 'actor', targetId: 'target',
    spellId, slotLevel: 0, castingClassId: 'wizard', d20: 19, effectRolls: [3, 4] })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  expect(result.state.combatants.target.currentHp).toBe(23)
})

it.each([0, 2])('exports a declarative mark and applies its critical and damage bonus through both module paths (bonus=%s)', async bonus => {
  const namespace = 'test.target-critical'
  const marking = compileDnd5eActivityPatternV1({ schemaVersion: 1, id: 'mark', name: 'Mark',
    source: { kind: 'feature', id: 'mark' }, activation: { kind: 'free' },
    target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30 }, pattern: 'timed-effect', recipient: 'target',
    effect: { schemaVersion: 1, id: 'mark', name: 'Mark', duration: { kind: 'rounds', rounds: 2, expiresAt: 'source-turn-end' },
      stacking: 'replace', modifiers: [{ kind: 'attacks-by-source-critical-threshold', threshold: 19 }, ...(bonus ? [{ kind: 'damage-rolls-by-source-bonus' as const, value: { kind: 'constant' as const, value: bonus } }] : [])] } })
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1, assets: [],
    manifest: { id: namespace, name: 'Synthetic mark', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1',
      publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only' },
    definitions: ['mark', 'strike'].map(id => ({ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id, name: id,
      automation: automationCapabilityFromLegacyStatus('full'), payload: { id, name: id, summary: 'Synthetic', description: 'Synthetic', automation: 'full' },
      activities: id === 'mark' ? [marking] : [{ schemaVersion: 1, id, name: id, activation: { kind: 'free' },
        automation: automationCapabilityFromLegacyStatus('full'), legacySource: { kind: 'feature', id },
        target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30 },
        checks: [{ id: 'attack', kind: 'attack-roll', rollId: 'attack', attackBonus: { kind: 'constant', value: 0 },
          rollMode: 'normal', delivery: 'ranged', scope: 'per-target' }],
        outcomes: [{ id: 'hit', when: { kind: 'check', checkId: 'attack', result: 'success' }, operations: [
          { id: 'damage', kind: 'damage', target: 'target', damageType: 'force', critical: 'double-dice', amount: { kind: 'damage-roll', rollId: 'strike', value: { kind: 'dice', rollId: 'damage', count: 1, sides: 6 } } }] }] }] })) }
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try {
    const state = startDnd5eHeadlessCombat('module', [combatant('actor', 20), combatant('target', 10)])
    state.combatants.actor.pluginFeatureIds = [`${namespace}:mark`, `${namespace}:strike`]
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'target')]: 5 }
    const grant = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, confirmedBy: 'actor', authoritativeRolls: {},
      command: { schemaVersion: 1, commandId: 'mark', actorId: 'actor', packageId: namespace, packageVersion: '1.0.0', activityId: 'mark', targetIds: ['target'], expectedRevision: 1 } })
    expect(grant.result.ok, JSON.stringify(grant.result)).toBe(true)
    if (!grant.result.ok) throw Error('Mark failed')
    const loaded = JSON.parse(JSON.stringify(grant.result.state)) as typeof state
    expect(dnd5eTargetCriticalThreshold(loaded.combatants.target.classState.activeEffects, 'actor'), JSON.stringify(loaded.combatants.target.classState.activeEffects)).toBe(19)
    for (const entry of ['registered', 'compiled']) {
      const rolls = { 'attack:target': { values: [19], modifier: 0, total: 19 }, damage: { values: [3, 4], modifier: 0, total: 7 } }
      const result = entry === 'registered' ? resolveRegisteredDnd5eActivityInCombatV1({ state: loaded, combatRevision: 1, confirmedBy: 'actor', authoritativeRolls: rolls,
        command: { schemaVersion: 1, commandId: 'strike', actorId: 'actor', packageId: namespace, packageVersion: '1.0.0', activityId: 'strike', targetIds: ['target'], expectedRevision: 1 } }).result
        : resolveDnd5eHeadlessAction(loaded, { type: 'plugin', pluginId: namespace, actionId: 'strike', featureId: `${namespace}:strike`, actorId: 'actor', targetId: 'target', targetIds: ['target'], distanceFeet: 5, rolls })
      expect(result.ok, JSON.stringify(result)).toBe(true)
      if (!result.ok) throw Error('Strike failed')
      expect(result.state.combatants.target.currentHp).toBe(23 - bonus)
      const evidence = result.events.filter(event => event.type === 'activity-formula-roll-resolved')
      expect(evidence).toHaveLength(1)
      expect(evidence[0]).toMatchObject({ actorId: 'actor', executorId: 'actor', targetId: 'target',
        activityId: 'strike', operationId: 'damage', kind: 'damage', total: 7 + bonus, formulaAdjustment: bonus,
        dice: [{ rollId: 'damage', count: 2, submittedCount: 2, sides: 6, rawValues: [3, 4], values: [3, 4] }] })
    }
  } finally { dispose() }
})

