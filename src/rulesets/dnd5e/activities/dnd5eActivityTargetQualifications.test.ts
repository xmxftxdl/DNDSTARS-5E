import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import type { Dnd5ePluginAction } from '../plugins/pluginHeadlessContracts'
import { dnd5eCombatantPairKey } from '../headlessCombatPrimitives'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { authorizeDnd5eActivityTargetQualificationsV1, collectDnd5eActivityTargetQualificationsV1, dnd5eHostTargetQualificationsV1, dnd5eRequiredTargetQualificationsV1, dnd5eHostTargetBodyPartsV1 } from './dnd5eActivityTargetQualifications'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

const pkg = 'test.qualification'
function definition(): Dnd5eActivityDefinitionV1 {
  return { schemaVersion: 1, id: 'rite', name: 'Qualified rite', activation: { kind: 'action' },
    target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 10 },
    choices: [{ id: 'mode', label: 'Mode', options: [{ id: 'adult', label: 'Age', targetOverride: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 10,
      requiredQualifications: [{ id: 'young-adult', label: 'Is this creature a young adult?', audience: 'dm', creatureTypes: ['humanoid'] }] } }, { id: 'other', label: 'Other' }] }],
    consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
    outcomes: [{ id: 'benefit', when: { kind: 'always' }, operations: [{ id: 'grant', kind: 'temporary-hit-points', target: 'target', amount: { kind: 'constant', value: 5 } }] }],
    automation: automationCapabilityFromLegacyStatus('full') }
}
function action(): Dnd5ePluginAction {
  return { type: 'plugin', pluginId: pkg, actionId: 'rite', featureId: `${pkg}:rite`, actorId: 'actor', targetId: 'target', transactionId: 'qualified-cast-1', distanceFeet: 0,
    payload: { activityChoices: { mode: 'adult' }, activityTargetQualifications: { target: ['young-adult'] } } }
}
const target = { id: 'target', label: 'Target', characterId: 'character', creatureType: 'humanoid' }

it.each([true,false,undefined])('collects anatomy as a Host-only per-cast fact: %s',async present=>{
 const activity=definition();activity.choices=[]
 activity.outcomes=[{id:'hurt',when:{kind:'always'},operations:[{id:'hurt',kind:'damage',target:'target',damageType:'psychic',amount:{kind:'constant',value:20},destroysBodyPartOnDeath:{part:'head',vital:true}}]}]
 const command=action()
 let prompts=0
 expect(await collectDnd5eActivityTargetQualificationsV1({action:command,activity,targets:[target],confirm:async()=>{throw Error('not a qualification')},confirmBodyPart:async(part)=>{expect(part).toBe('head');prompts++;return present}})).toBe(present!=null)
 expect(prompts).toBe(1)
 expect(dnd5eHostTargetBodyPartsV1(command)).toEqual(present==null?undefined:{target:{head:present}})
 expect(dnd5eHostTargetBodyPartsV1(JSON.parse(JSON.stringify(command)))).toBeUndefined()
 if(present!=null){
  const spread={...command};expect(dnd5eHostTargetBodyPartsV1(spread)).toEqual({target:{head:present}})
  spread.transactionId='different-cast';expect(dnd5eHostTargetBodyPartsV1(spread)).toBeUndefined()
 }
 expect(await collectDnd5eActivityTargetQualificationsV1({action:command,activity,targets:[{...target,bodyPartPresence:{head:false}}],confirm:async()=>false,confirmBodyPart:async()=>{throw Error('known anatomy must not prompt')}})).toBe(true)
 expect(dnd5eHostTargetBodyPartsV1(command)).toEqual({})
 expect(await collectDnd5eActivityTargetQualificationsV1({action:command,activity,targets:[target],confirm:async()=>false})).toBe(false)
 expect(dnd5eHostTargetBodyPartsV1(command)).toBeUndefined()
})

it.each(['类人生物','humanoid','类人'])('collects Host-confirmed qualification for localized type %s',async creatureType=>{
 const command=action();let confirmations=0
 expect(await collectDnd5eActivityTargetQualificationsV1({action:command,activity:definition(),choices:{mode:'adult'},targets:[{...target,creatureType}],confirm:async()=>{confirmations++;return true}})).toBe(true)
 expect(confirmations).toBe(1);expect(dnd5eHostTargetQualificationsV1(command)).toEqual({target:['young-adult']})
})
it.each([undefined,'undead','Unknown Person'])('does not accept ineligible or unknown type %s on a client label',async creatureType=>{
 let confirmations=0
 expect(await collectDnd5eActivityTargetQualificationsV1({action:action(),activity:definition(),choices:{mode:'adult'},targets:[{...target,creatureType}],confirm:async()=>{confirmations++;return true}})).toBe(false)
 expect(confirmations).toBe(0)
})

it('preserves private receipts through trusted spreads and strips them from serialization', () => {
  const cast = action()
  expect(dnd5eHostTargetQualificationsV1(cast)).toBeUndefined()
  authorizeDnd5eActivityTargetQualificationsV1(cast, { target: ['young-adult'] })
  expect(dnd5eHostTargetQualificationsV1({ ...cast })).toEqual({ target: ['young-adult'] })
  expect(dnd5eHostTargetQualificationsV1(JSON.parse(JSON.stringify(cast)))).toBeUndefined()
  expect(dnd5eHostTargetQualificationsV1(structuredClone(cast))).toBeUndefined()
})

it.each(['actorId', 'pluginId', 'actionId', 'transactionId', 'choices'] as const)('cannot reuse qualification after changing %s', field => {
  const cast = action()
  authorizeDnd5eActivityTargetQualificationsV1(cast, { target: ['young-adult'] })
  const changed = { ...cast }
  if (field === 'choices') changed.payload = { activityChoices: { mode: 'other' } }
  else changed[field] = 'different'
  expect(dnd5eHostTargetQualificationsV1(changed)).toBeUndefined()
})

it('collects only the selected target override and does not infer creature identity', async () => {
  const activity = definition(), cast = action(), confirmations: string[] = []
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  expect(dnd5eRequiredTargetQualificationsV1(activity, { mode: 'other' })).toEqual([])
  expect(await collectDnd5eActivityTargetQualificationsV1({ action: cast, activity, choices: { mode: 'adult' }, targets: [target],
    confirm: async (requirement, actual) => { confirmations.push(`${requirement.audience}:${actual.id}:${requirement.id}`); return true } })).toBe(true)
  expect(confirmations).toEqual(['dm:target:young-adult'])
  expect(dnd5eHostTargetQualificationsV1(cast)).toEqual({ target: ['young-adult'] })
  expect(await collectDnd5eActivityTargetQualificationsV1({ action: cast, activity, choices: { mode: 'adult' }, targets: [{ ...target, creatureType: undefined }], confirm: async () => { throw Error('must not guess') } })).toBe(false)
  expect(dnd5eHostTargetQualificationsV1(cast)).toBeUndefined()
})

it('does not authorize a cancelled multi-target decision or a cast changed during confirmation', async () => {
  const cast = action(), activity = definition()
  expect(await collectDnd5eActivityTargetQualificationsV1({ action: cast, activity, choices: { mode: 'adult' }, targets: [target, { ...target, id: 'second' }],
    confirm: async (_qualification, actual) => actual.id !== 'second' })).toBe(false)
  expect(dnd5eHostTargetQualificationsV1(cast)).toBeUndefined()
  expect(await collectDnd5eActivityTargetQualificationsV1({ action: cast, activity, choices: { mode: 'adult' }, targets: [target],
    confirm: async () => { cast.transactionId = 'changed'; return true } })).toBe(false)
  expect(dnd5eHostTargetQualificationsV1(cast)).toBeUndefined()
})

it('enforces the Host receipt in the actual compiled action, before consuming action or granting effects', () => {
  const activity = definition()
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: pkg, name: 'Qualification test', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
    api.registerFeature({ id: activity.id, name: activity.name, summary: 'Test', description: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) })
  } })
  try {
    const combatants = ['actor', 'target'].map((id, index) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative: 20 - index * 10,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10,
      currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false, creatureType: 'humanoid', pluginFeatureIds: [`${pkg}:rite`] }))
    const state = startDnd5eHeadlessCombat('qualified', combatants)
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'target')]: 0 }
    const before = structuredClone(state), forged = action()
    const denied = resolveDnd5eHeadlessAction(state, forged)
    expect(denied.ok).toBe(false)
    expect(denied.state).toEqual(before)
    expect(denied.events).toEqual([])
    authorizeDnd5eActivityTargetQualificationsV1(forged, { target: ['young-adult'] })
    const granted = resolveDnd5eHeadlessAction(state, { ...forged })
    expect(granted.ok, JSON.stringify(granted)).toBe(true)
    expect(granted.state.combatants.target.temporaryHp).toBe(5)
    expect(granted.state.combatants.actor.turn.actionAvailable).toBe(false)
    expect(state).toEqual(before)
    const wrongType = structuredClone(state)
    wrongType.combatants.target.creatureType = 'beast'
    expect(resolveDnd5eHeadlessAction(wrongType, { ...forged }).ok).toBe(false)
  } finally { dispose() }
})

it('rejects malformed qualifier declarations and choice references', () => {
  const activity = definition(), override = activity.choices![0].options[0].targetOverride!
  if (override.kind !== 'creature') throw Error('wrong target')
  override.requiredQualifications = [{ id: 'young-adult', label: 'Age?', audience: 'dm', whenChoice: { choiceId: 'unknown', optionIds: ['adult'] } }]
  expect(validateDnd5eActivityDefinitionV1(activity).some(error => error.includes('unknown options'))).toBe(true)
  override.requiredQualifications = [{ id: 'Invalid Key', label: 'Age?', audience: 'dm' }]
  expect(validateDnd5eActivityDefinitionV1(activity).some(error => error.includes('requiredQualifications'))).toBe(true)
})
