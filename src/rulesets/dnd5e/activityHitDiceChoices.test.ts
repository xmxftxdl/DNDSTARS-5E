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
import { collectScaledDnd5eActivityFormulaRollDeclarationsV1 } from './activities/dnd5eActivityRollRecipe'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'
import { rollDnd5eActivityTriggerDiceV1 } from './activities/dnd5eActivityTriggerSettlement'

it.each(['direct', 'compiled'] as const)('binds selected Hit Dice, their rolls and per-die Constitution through %s', async route => {
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'select-dice', name: 'Select dice',
    activation: { kind: 'free' }, target: { kind: 'self' }, legacySource: { kind: 'feature', id: 'select-dice' },
    automation: automationCapabilityFromLegacyStatus('full'),
    choices: [{ id: 'quantity', label: '生命骰数量', options: [{ id: 'one', label: '1d6' }, { id: 'two', label: '2d6' }] }],
    consumption: [1, 2].map(count => ({ kind: 'hit-die', resourceId: 'hit-die:d6', amount: { kind: 'constant', value: count },
      consumeOn: 'resolve', maximumTotalFraction: 0.5, whenChoice: { choiceId: 'quantity', optionIds: [count === 1 ? 'one' : 'two'] } })),
    outcomes: [1, 2].map(count => ({ id: `benefit-${count}`, when: { kind: 'choice', choiceId: 'quantity', optionId: count === 1 ? 'one' : 'two' },
      operations: [{ id: `hp-${count}`, kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'add', values: [
        { kind: 'dice', rollId: `dice-${count}`, count, sides: 6 },
        { kind: 'multiply', values: [{ kind: 'constant', value: count }, { kind: 'reference', reference: { kind: 'actor-ability-modifier', ability: 'con' } }] },
      ] } }] })),
  }
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  expect(collectScaledDnd5eActivityFormulaRollDeclarationsV1(activity, { choices: {} }).map(roll => roll.id)).toEqual(['dice-1', 'dice-2'])
  expect(collectScaledDnd5eActivityFormulaRollDeclarationsV1({ ...activity,
    choices: activity.choices!.map(choice => ({ ...choice, defaultOptionId: 'one' })) }, { choices: {} }).map(roll => roll.id)).toEqual(['dice-1'])
  expect(validateDnd5eActivityDefinitionV1({ ...activity, consumption: [{ kind: 'hit-die', resourceId: 'hit-die:d6',
    amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve', whenChoice: { choiceId: 'quantity', optionIds: ['forged'] } }] })).toContain('activity.consumption[0].whenChoice must reference declared choice options')
  const registered = registerDnd5eActivityPackage({ packageId: 'test.dice-choices', packageVersion: '1.0.0', activities: [activity] })
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.dice-choices', name: 'Dice choices', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
    api.registerFeature({ id: activity.id, name: activity.name, summary: 'Synthetic', description: 'Synthetic', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) })
  } })
  try {
    const owner = normalizeCharacter({ id: 'owner', name: 'Owner', charClass: '法师', level: 5, maxHp: 30, currentHp: 30,
      abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 }, hitPointDice: [{ sides: 6, current: 3, max: 5 }] })
    const map: BattleMap = { id: 'dice', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [{ id: 'caster', characterId: owner.id, type: 'player', label: owner.name, x: 25, y: 25, size: 1, color: '', emoji: '' }] }
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'dice', map, characters: [owner], initiativeOrder: [{ tokenId: 'caster', label: owner.name, roll: 20, color: '', emoji: '' }] })
    snapshot.state.combatants.caster.pluginFeatureIds = ['test.dice-choices:select-dice']
    const run = (selected: string, values: number[], state = snapshot.state) => {
      const choices = { quantity: selected }, rolls = { [`dice-${selected === 'one' ? 1 : 2}`]: { values, modifier: 0, total: values.reduce((sum, value) => sum + value, 0) } }
      if (route === 'compiled') return resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: 'test.dice-choices', actionId: activity.id,
        featureId: 'test.dice-choices:select-dice', actorId: 'caster', targetId: 'caster', payload: { activityChoices: choices }, rolls })
      const actor = dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.caster)
      return commitDnd5eActivityExecution(state, { actorId: actor.id, activityId: activity.id, targetIds: [actor.id],
        resolution: resolveDnd5eActivity({ activity, actor, targets: [actor], choices, rolls }), source: { kind: 'feature', id: activity.id, packageId: 'test.dice-choices' } })
    }
    for (const count of [1, 2]) {
      const choice = count === 1 ? 'one' : 'two', values = count === 1 ? [4] : [4, 5]
      expect(collectScaledDnd5eActivityFormulaRollDeclarationsV1(activity, { choices: { quantity: choice } })).toEqual([{ id: `dice-${count}`, count, sides: 6 }])
      const requested: string[] = []
      const triggerRolls = await rollDnd5eActivityTriggerDiceV1({ state: snapshot.state, actorId: 'caster', targetIds: ['caster'], choices: { quantity: choice },
        available: { packageId: 'test.dice-choices', packageVersion: '1.0.0', activity, confirmation: 'actor-choice', retention: 'single-event' },
        triggerContext: { eventId: 'hit-1', event: 'attack-hit', source: { kind: 'attack', mode: 'melee', result: 'hit' }, eligibleActorIds: ['caster'], eligibleTargetIds: ['caster'] },
        roll: async request => { requested.push(request.id); return values },
      })
      expect(triggerRolls).not.toHaveProperty('unsupported')
      expect(requested).toEqual([`dice-${count}`])
      const result = run(choice, values)
      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      expect(result.state.combatants.caster.hitPointDice?.[0].current).toBe(3 - count)
      expect(result.state.combatants.caster.temporaryHp).toBe(count === 1 ? 6 : 13)
      const saved = planDnd5eMapResultApplication({ state: result.state, map, characters: [owner], characterIdByCombatantId: snapshot.characterIdByCombatantId, events: [...result.events] })
      expect(normalizeCharacter(JSON.parse(JSON.stringify(saved.characters[0]))).hitPointDice?.[0].current).toBe(3 - count)
    }
    for (const [choice, values] of [['one', [4, 5]], ['two', [4]], ['unknown', [4, 5]]] as const) {
      const rejected = run(choice, [...values])
      expect(rejected.ok).toBe(false)
      expect(rejected.state).toEqual(snapshot.state)
    }
    const limited = structuredClone(snapshot.state)
    limited.combatants.caster.hitPointDice = [{ sides: 6, current: 3, max: 3 }]
    expect(run('two', [4, 5], limited).ok).toBe(false)
    expect(run('one', [4], limited).ok).toBe(true)
    expect(owner.hitPointDice?.[0].current).toBe(3)
  } finally { dispose(); registered.dispose() }
})
