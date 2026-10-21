import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { normalizeCharacter } from '../../store/characters'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'
import { compileDnd5eActivityHeadlessAction } from './activities/dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './activities/dnd5eActivityFeatureActionAdapter'
import { dnd5eActivityLanguageChoicesV1 } from './activities/dnd5eActivityChoices'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { settleDnd5eActivityTriggerWindowsV1 } from './activities/dnd5eActivityTriggerSettlement'

const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'pool', name: 'Pool', activation: { kind: 'free' }, target: { kind: 'self' },
  legacySource: { kind: 'feature', id: 'pool' }, automation: automationCapabilityFromLegacyStatus('full'),
  choices: [{ id: 'die', label: '生命骰', optionsFrom: 'actor-hit-dice', options: [] }],
  consumption: [6, 8, 10, 12].map(sides => ({ kind: 'hit-die', resourceId: `hit-die:d${sides}`,
    amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve', whenChoice: { choiceId: 'die', optionIds: [`hit-die:d${sides}`] } })),
  outcomes: [6, 8, 10, 12].map(sides => ({ id: `heal-${sides}`, when: { kind: 'choice', choiceId: 'die', optionId: `hit-die:d${sides}` },
    operations: [{ id: `heal-${sides}`, kind: 'healing', target: 'actor', amount: { kind: 'add', values: [
      { kind: 'dice', rollId: `die-${sides}`, count: 1, sides },
      { kind: 'reference', reference: { kind: 'actor-ability-modifier', ability: 'con' } },
    ] } }] })),
}

it.each(['dodge', 'monk-patient-defense'] as const)('offers current Hit Dice after %s and settles once', async actionType => {
  const packageId = 'test.dodge-dice'
  const triggered: Dnd5eActivityDefinitionV1 = { ...activity,
    invocation: { kind: 'triggered', event: 'action-resolved', confirmation: 'actor-choice', retention: 'single-event' },
    requirements: [{ kind: 'combat-active' }, { kind: 'event-source', source: 'action', sourceId: 'dodge' }],
  }
  const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [triggered] })
  try {
    const owner = normalizeCharacter({ id: 'owner', name: 'Owner', charClass: '武僧', level: 4, maxHp: 30, currentHp: 10,
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
      classResources: { 'dnd5e-ki': { current: 2, max: 4 } },
      hitPointDice: [{ sides: 6, current: 0, max: 1 }, { sides: 8, current: 2, max: 3 }] })
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(owner), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    actor.pluginFeatureIds = [`${packageId}:pool`]
    const state = startDnd5eHeadlessCombat('dodge-dice', [actor, { ...structuredClone(actor), id: 'other', initiative: 1 }])
    const dodged = resolveDnd5eHeadlessAction(state, { type: actionType, actorId: actor.id })
    expect(dodged.ok, dodged.ok ? undefined : dodged.reason).toBe(true)
    const rolled: number[] = []
    const settled = await settleDnd5eActivityTriggerWindowsV1({ state: dodged.state, events: dodged.events,
      eventBatchId: 'dodge', combatRevision: 1,
      confirm: async request => {
        expect(request.activity.choices![0].options.map(option => option.id)).toEqual(['hit-die:d8'])
        return { accepted: true, choices: { die: 'hit-die:d8' } }
      },
      roll: async request => { rolled.push(request.sides); return [3] },
    })
    expect(settled.diagnostics).toContainEqual(expect.objectContaining({ status: 'resolved' }))
    expect(rolled).toEqual([8])
    expect(settled.state.combatants.owner.currentHp).toBe(15)
    expect(settled.state.combatants.owner.hitPointDice?.[1].current).toBe(1)
    expect(settled.state.combatants.owner.turn.actionAvailable).toBe(actionType === 'monk-patient-defense')
    const replay = await settleDnd5eActivityTriggerWindowsV1({ state: settled.state, events: dodged.events,
      eventBatchId: 'dodge', combatRevision: settled.combatRevision,
      confirm: async () => { throw new Error('duplicate choice') }, roll: async () => { throw new Error('duplicate dice') } })
    expect(replay.state.combatants.owner.currentHp).toBe(15)
    expect(replay.state.combatants.owner.hitPointDice?.[1].current).toBe(1)
    const refused = resolveDnd5eHeadlessAction(dodged.state, { type: actionType, actorId: actor.id })
    expect(refused.ok).toBe(false)
    expect(refused.events.some(event => event.type === 'activity-resolved')).toBe(false)
  } finally { registration.dispose() }
})

it('builds available pool choices from real data without trusting injected options or defaults', () => {
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const forged = structuredClone(activity)
  forged.choices![0].options = [{ id: 'hit-die:d12', label: 'Fake stock' }]
  forged.choices![0].defaultOptionId = 'hit-die:d12'
  const pools = [{ sides: 10, current: 2, max: 3 }, { sides: 6, current: 0, max: 2 }]
  const expanded = dnd5eActivityLanguageChoicesV1(forged, [], pools)
  expect(expanded.choices![0].options).toEqual([{ id: 'hit-die:d10', label: 'd10（剩余 2/3）' }])
  expect(expanded.choices![0].defaultOptionId).toBeUndefined()
  expect(validateDnd5eActivityDefinitionV1(expanded)).toEqual([])
  expect(dnd5eActivityLanguageChoicesV1(forged).choices![0].options).toEqual([])
  expect(dnd5eActivityLanguageChoicesV1(forged, [], [pools[0], pools[0]]).choices![0].options).toEqual([])
  forged.choices![0].options = [{ id: 'hit-die:d20', label: 'Invalid' }]
  expect(validateDnd5eActivityDefinitionV1(forged).length).toBeGreaterThan(0)
  expect(activity.choices![0].options).toEqual([])
})

it.each([6, 8, 10, 12])('settles the chosen d%i from Host pools and rejects an exhausted selection', sides => {
  const packageId = 'test.pool-choice'
  const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [activity] })
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Pools', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
    api.registerFeature({ id: activity.id, name: activity.name, summary: 'Synthetic', description: 'Synthetic', automation: 'full',
      action: dnd5ePluginFeatureActionFromActivityV1(activity) })
  } })
  try {
    const owner = normalizeCharacter({ id: 'owner', name: 'Owner', maxHp: 30, currentHp: 10,
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
      hitPointDice: [6, 8, 10, 12].map(die => ({ sides: die, current: 1, max: 1 })) })
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(owner), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
    actor.pluginFeatureIds = [`${packageId}:pool`]
    const state = startDnd5eHeadlessCombat('pool', [actor, { ...structuredClone(actor), id: 'other' }])
    const command = { type: 'plugin' as const, pluginId: packageId, actionId: activity.id, featureId: `${packageId}:pool`, actorId: 'owner', targetId: 'owner',
      payload: { activityChoices: { die: `hit-die:d${sides}` } }, rolls: { [`die-${sides}`]: { values: [3], modifier: 0, total: 3 } } }
    const before = structuredClone(state)
    const result = resolveDnd5eHeadlessAction(state, command)
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    expect(result.state.combatants.owner.currentHp).toBe(15)
    expect(result.state.combatants.owner.hitPointDice?.map(pool => pool.current)).toEqual([6, 8, 10, 12].map(die => die === sides ? 0 : 1))
    const stale = resolveDnd5eHeadlessAction(result.state, command)
    expect(stale.ok).toBe(false)
    expect(stale.state).toEqual(result.state)
    expect(state).toEqual(before)
    const unknown = resolveDnd5eHeadlessAction(state, { ...command, payload: { activityChoices: { die: 'hit-die:d20' } } })
    expect(unknown.ok).toBe(false)
    expect(unknown.state).toEqual(state)
  } finally { dispose(); registration.dispose() }
})

it.each([[1, 1, true], [2, 0, true], [0, 2, true], [2, 1, false], [0, 3, false]] as const)(
  'allocates %i d6 and %i d10 against one Host budget (accepted: %s)', (d6, d10, accepted) => {
    const quantities: Dnd5eActivityDefinitionV1 = { ...activity, id: 'quantities', legacySource: { kind: 'feature', id: 'quantities' },
      choices: [6, 10].map(sides => ({ id: `count-${sides}`, label: `d${sides}`, optionsFrom: 'actor-hit-die-count',
        hitDieSides: sides as 6 | 10, hitDieMaximumCount: 3, options: [], defaultOptionId: '0' })),
      consumption: [6, 10].flatMap(sides => [1, 2, 3].map(count => ({ kind: 'hit-die' as const, resourceId: `hit-die:d${sides}`,
        amount: { kind: 'constant' as const, value: count }, consumeOn: 'resolve' as const, maximumTotalFraction: 0.5,
        whenChoice: { choiceId: `count-${sides}`, optionIds: [String(count)] } }))),
      outcomes: [6, 10].flatMap(sides => [1, 2, 3].map(count => ({ id: `heal-${sides}-${count}`,
        when: { kind: 'choice' as const, choiceId: `count-${sides}`, optionId: String(count) },
        operations: [{ id: `heal-${sides}-${count}`, kind: 'healing' as const, target: 'actor' as const,
          amount: { kind: 'add' as const, values: [{ kind: 'dice' as const, rollId: `dice-${sides}-${count}`, count, sides },
            { kind: 'multiply' as const, values: [{ kind: 'constant' as const, value: count },
              { kind: 'reference' as const, reference: { kind: 'actor-ability-modifier' as const, ability: 'con' as const } }] }] } }] }))),
    }
    const pools = [{ sides: 6, current: 3, max: 3 }, { sides: 10, current: 2, max: 2 }]
    expect(validateDnd5eActivityDefinitionV1(quantities)).toEqual([])
    const incomplete = structuredClone(quantities)
    incomplete.choices![0].hitDieMaximumCount = 4
    expect(validateDnd5eActivityDefinitionV1(incomplete)).toContain('choice count-6 quantity 4 must bind exactly its declared Hit Die cost (zero binds none)')
    const mismatched = structuredClone(quantities)
    mismatched.consumption![0].amount = { kind: 'constant', value: 2 }
    expect(validateDnd5eActivityDefinitionV1(mismatched)).toContain('choice count-6 quantity 1 must bind exactly its declared Hit Die cost (zero binds none)')
    const expanded = dnd5eActivityLanguageChoicesV1(quantities, [], pools)
    expect(expanded.choices?.map(choice => choice.options.map(option => option.id))).toEqual([['0', '1', '2', '3'], ['0', '1', '2']])
    // Spell preparation may already expand the menu; references to unavailable
    // branches stay schema-valid, but Host selection still cannot use them.
    expect(validateDnd5eActivityDefinitionV1(expanded)).toEqual([])
    expect(dnd5eActivityLanguageChoicesV1(quantities, [], []).choices?.map(choice => choice.options.map(option => option.id))).toEqual([['0'], ['0']])
    expect(dnd5eActivityLanguageChoicesV1(quantities).choices?.every(choice => !choice.options.length)).toBe(true)
    const packageId = 'test.quantity-choice'
    const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [quantities] })
    const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Quantities', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
      api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(quantities))
      api.registerFeature({ id: quantities.id, name: quantities.name, summary: 'Synthetic', description: 'Synthetic', automation: 'full',
        action: dnd5ePluginFeatureActionFromActivityV1(quantities) })
    } })
    try {
      const owner = normalizeCharacter({ id: 'owner', name: 'Owner', maxHp: 40, currentHp: 5, hitPointDice: pools,
        abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 } })
      const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(owner), controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
      actor.pluginFeatureIds = [`${packageId}:quantities`]
      const state = startDnd5eHeadlessCombat('quantities', [actor, { ...structuredClone(actor), id: 'other' }])
      const before = structuredClone(state)
      const rolls = Object.fromEntries([[6, d6, 3], [10, d10, 7]].filter(([, count]) => count > 0)
        .map(([sides, count, value]) => [`dice-${sides}-${count}`, { values: Array(count).fill(value) as number[], modifier: 0, total: count * value }]))
      const result = resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: packageId, actionId: quantities.id,
        featureId: `${packageId}:quantities`, actorId: 'owner', targetId: 'owner', rolls,
        payload: { activityChoices: { 'count-6': String(d6), 'count-10': String(d10) } } })
      expect(result.ok, result.ok ? undefined : result.reason).toBe(accepted)
      if (accepted) {
        expect(result.state.combatants.owner.hitPointDice?.map(pool => pool.current)).toEqual([3 - d6, 2 - d10])
        expect(result.state.combatants.owner.currentHp).toBe(5 + 5 * d6 + 9 * d10)
      } else expect(result.state).toEqual(state)
      expect(state).toEqual(before)
    } finally { dispose(); registration.dispose() }
  },
)
