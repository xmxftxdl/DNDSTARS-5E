import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import type { BattleMap } from '../../store/maps'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { commitDnd5eActivityExecution, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './activities/dnd5eActivityCombatAuthority'
import { compileDnd5eActivityHeadlessAction } from './activities/dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './activities/dnd5eActivityFeatureActionAdapter'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { canSpendDnd5eActivityHitDice, canSpendDnd5eActivityHitDiceCosts } from './activityHitDice'

it.each(['direct', 'compiled'] as const)('spends real saved Hit Dice through %s authority with atomic rejection', route => {
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'spend-dice', name: 'Spend dice',
    activation: { kind: 'free' }, target: { kind: 'self' }, legacySource: { kind: 'feature', id: 'spend-dice' },
    automation: automationCapabilityFromLegacyStatus('full'),
    consumption: [{ kind: 'hit-die', resourceId: 'hit-die:d6', amount: { kind: 'constant', value: 2 }, consumeOn: 'resolve', maximumTotalFraction: 0.5 }],
    outcomes: [{ id: 'benefit', when: { kind: 'always' }, operations: [{ id: 'hp', kind: 'temporary-hit-points',
      target: 'actor', amount: { kind: 'reference', reference: { kind: 'actor-hit-dice', field: 'current' } } }] }],
  }
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.hit-dice', name: 'Hit dice', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
      api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
      api.registerFeature({ id: activity.id, name: activity.name, summary: 'Synthetic', description: 'Synthetic', automation: 'full',
        action: dnd5ePluginFeatureActionFromActivityV1(activity) })
    } })
  try {
    const owner = normalizeCharacter({ id: 'owner', name: 'Owner', charClass: '法师', level: 5, maxHp: 30, currentHp: 30,
      hitPointDice: [{ sides: 6, current: 3, max: 5 }] })
    const map: BattleMap = { id: 'hit-dice', name: 'Map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [{ id: 'caster', characterId: owner.id, type: 'player', label: owner.name, x: 25, y: 25, size: 1, color: '', emoji: '' }] }
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'dice', map, characters: [owner],
      initiativeOrder: [{ tokenId: 'caster', label: owner.name, roll: 20, color: '', emoji: '' }] })
    snapshot.state.combatants.caster.pluginFeatureIds = ['test.hit-dice:spend-dice']
    // Counterfeit class resources must never supply real Hit Dice.
    snapshot.state.combatants.caster.classResources['hit-die:d6'] = { current: 99, max: 99 }
    const run = (state: typeof snapshot.state, definition = activity) => {
      if (route === 'compiled') return resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: 'test.hit-dice',
        actionId: activity.id, featureId: 'test.hit-dice:spend-dice', actorId: 'caster', targetId: 'caster', rolls: {} })
      const actor = dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.caster)
      return commitDnd5eActivityExecution(state, { actorId: actor.id, activityId: activity.id, targetIds: [actor.id],
        resolution: resolveDnd5eActivity({ activity: definition, actor, targets: [actor], rolls: {} }),
        source: { kind: 'feature', id: activity.id, packageId: 'test.hit-dice' } })
    }
    const before = structuredClone(snapshot.state)
    const result = run(snapshot.state)
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    expect(snapshot.state).toEqual(before)
    expect(result.state.combatants.caster.temporaryHp).toBe(3)
    expect(result.state.combatants.caster.hitPointDice).toEqual([{ sides: 6, current: 1, max: 5 }])
    expect(result.state.combatants.caster.classResources['hit-die:d6'].current).toBe(99)
    const applied = planDnd5eMapResultApplication({ state: result.state, map, characters: [owner],
      characterIdByCombatantId: snapshot.characterIdByCombatantId, events: [...result.events] })
    const restored = normalizeCharacter(JSON.parse(JSON.stringify(applied.characters[0])))
    expect(restored.hitPointDice).toEqual([{ sides: 6, current: 1, max: 5 }])
    const denied = run(result.state)
    expect(denied.ok).toBe(false)
    expect(denied.state.combatants.caster.hitPointDice).toEqual(result.state.combatants.caster.hitPointDice)
    const capped = structuredClone(snapshot.state)
    capped.combatants.caster.hitPointDice = [{ sides: 6, current: 3, max: 3 }]
    const overHalf = run(capped)
    expect(overHalf.ok).toBe(false)
    expect(overHalf.state.combatants.caster.hitPointDice).toEqual(capped.combatants.caster.hitPointDice)
    expect(overHalf.state.combatants.caster.temporaryHp).toBe(capped.combatants.caster.temporaryHp)
    if (route === 'direct') {
      const repeatedCosts = { ...activity, consumption: [...activity.consumption!, ...activity.consumption!] }
      const rejected = run(snapshot.state, repeatedCosts)
      expect(rejected.ok).toBe(false)
      expect(rejected.state.combatants.caster.hitPointDice).toEqual(before.combatants.caster.hitPointDice)
      expect(rejected.state.combatants.caster.temporaryHp).toBe(before.combatants.caster.temporaryHp)
    }
  } finally { dispose() }
})

it('enforces one rounded-down budget across different Hit Die pools and repeated costs', () => {
  const pools = [{ sides: 6, current: 2, max: 2 }, { sides: 10, current: 3, max: 3 }]
  const cost = (sides: number, amount: number) => ({ kind: 'hit-die', resourceId: `hit-die:d${sides}`, amount, maximumTotalFraction: 0.5 })
  expect(canSpendDnd5eActivityHitDiceCosts(pools, [cost(6, 1), cost(10, 1)])).toBe(true)
  expect(canSpendDnd5eActivityHitDiceCosts(pools, [cost(6, 1), cost(10, 2)])).toBe(false)
  expect(canSpendDnd5eActivityHitDiceCosts(pools, [cost(10, 1), cost(10, 2)])).toBe(false)
  expect(canSpendDnd5eActivityHitDiceCosts(pools, [{ ...cost(6, 1), maximumTotalFraction: 1.1 }])).toBe(false)
})

it('rejects ambiguous pools, fake pool identifiers and invalid quantities', () => {
  const pools = [{ sides: 6, current: 3, max: 5 }, { sides: 10, current: 1, max: 1 }]
  expect(canSpendDnd5eActivityHitDice(pools, 'hit-die:d10', 1)).toBe(true)
  for (const amount of [-1, 1.5, 4, NaN]) expect(canSpendDnd5eActivityHitDice(pools, 'hit-die:d6', amount)).toBe(false)
  expect(canSpendDnd5eActivityHitDice(pools, 'fake', 1)).toBe(false)
  expect(canSpendDnd5eActivityHitDice([...pools, pools[0]], 'hit-die:d6', 1)).toBe(false)
})
