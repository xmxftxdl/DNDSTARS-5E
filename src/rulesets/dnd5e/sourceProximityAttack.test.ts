import { expect, it } from 'vitest'
import { createDnd5eCombatant, dnd5eCombatantPairKey, dnd5eDirectedCombatantPairKey, dnd5eMonsterSpellAttackMode, dnd5eSourceProximityAttackAdvantage, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { validDnd5eSourceProximityAttack } from './sourceProximityAttack'
import { prepareDnd5eLocalContentJson } from './localContentCollection'
import { parseDnd5eContentPackageV2, dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'

function fixture() {
  const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative,
    controller: id === 'target' ? 'dm' : 'player', abilities: { str: 16, dex: 12, con: 12, int: 2, wis: 12, cha: 8 },
    proficiencyBonus: 2, armorClass: 16, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30,
    position: { x: 0, y: 0 }, concentrating: false })
  const source = make('source', 20), beast = make('beast', 30), target = make('target', 10)
  beast.classState.activeEffects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([createDnd5eMechanicalEffect({
    id: 'link', definitionId: 'test:link', label: 'Link', targetId: beast.id,
    source: { kind: 'spell', actorId: source.id, rulesId: 'test:link' },
    duration: { type: 'rounds', remainingRounds: 100, tickOn: 'source-turn-end' },
    modifiers: { sourceProximityAttackAdvantage: { rangeFeet: 5, requiresMutualSight: true, requiresSourceSeeTarget: true } },
  })])))
  const state = startDnd5eHeadlessCombat('link', [beast, source, target])
  state.distanceFeetByCombatantPair = Object.fromEntries([['source', 'beast'], ['source', 'target'], ['beast', 'target']].map(([a,b]) => [dnd5eCombatantPairKey(a,b),5]))
  return { state, beast: state.combatants.beast, source: state.combatants.source, target: state.combatants.target }
}

it('imports a declarative source-conditioned attack effect and applies it through Headless', async () => {
  const activity = { schemaVersion: 1, id: 'grant-link', name: 'Grant link', activation: { kind: 'action' },
    target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 5 },
    legacySource: { kind: 'feature', id: 'grant-link' }, automation: automationCapabilityFromLegacyStatus('full'),
    effects: [{ schemaVersion: 1, id: 'link', name: 'Link', duration: { kind: 'rounds', rounds: 100, expiresAt: 'source-turn-end' }, stacking: 'replace',
      modifiers: [{ kind: 'attack-roll', mode: 'advantage', sourceProximity: { rangeFeet: 5, requiresMutualSight: true, requiresSourceSeeTarget: true } }] }],
    outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect', target: 'target', effectId: 'link' }] }],
  }
  const imported=await prepareDnd5eLocalContentJson(JSON.stringify({name:'Source attack test',version:'1.0.0',features:[{id:'grant-link',name:'Grant link',summary:'Synthetic test',description:'Synthetic test',automation:'full'}],activities:[activity]}))
  const pkg=parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(imported.package)).buffer)!
  expect(pkg.content.activities?.[0].target).toEqual(activity.target)
  expect(pkg.content.activities?.[0].effects?.[0].modifiers).toEqual(activity.effects[0].modifiers)
  const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  try {
    const {state,source,beast}=fixture();beast.classState.activeEffects=[]
    source.pluginFeatureIds=[`${pkg.manifest.id}:grant-link`]
    state.initiativeIndex=state.initiativeOrder.indexOf(source.id)
    const result=resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId:pkg.manifest.id,actionId:'grant-link',featureId:source.pluginFeatureIds[0],actorId:source.id,targetId:beast.id,targetIds:[beast.id],distanceFeet:5,rolls:{}})
    expect(result.ok,JSON.stringify(result)).toBe(true)
    const effects=normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify(result.state.combatants.beast.classState.activeEffects)))
    expect(effects).toHaveLength(1)
    expect(effects[0].modifiers?.sourceProximityAttackAdvantage).toEqual(activity.effects[0].modifiers[0].sourceProximity)
    expect(effects[0].modifiers?.attackRollAdvantage).toBeUndefined()
    expect(dnd5eSourceProximityAttackAdvantage(result.state,result.state.combatants.beast,result.state.combatants.target)).toBe(true)
  } finally {dispose()}
})

it('persists conditional advantage without granting blanket advantage, and resolves the actual attack with two dice', () => {
  const {state,beast,target}=fixture()
  expect(beast.classState.activeEffects?.[0].modifiers?.attackRollAdvantage).toBeUndefined()
  expect(dnd5eSourceProximityAttackAdvantage(state,beast,target)).toBe(true)
  expect(dnd5eMonsterSpellAttackMode(state,beast.id,target.id,'melee')).toBe('advantage')
  const result=resolveDnd5eHeadlessAction(state,{type:'attack',actorId:beast.id,targetId:target.id,d20:2,d20Second:19,
    attackModifier:5,damage:{count:1,sides:4,bonus:0,rolls:[4],type:'slashing'}})
  expect(result.ok,JSON.stringify(result)).toBe(true)
  expect(result.state.combatants.target.currentHp).toBeLessThan(30)
  expect(result.events).toContainEqual(expect.objectContaining({type:'attack-resolved',rollMode:'advantage',d20:19}))
})

it.each(['distance','source-beast-wall','beast-source-wall','source-target-wall','suppressed-source','suppressed-beast','suspended-effect','missing-source'])('removes advantage immediately for %s without deleting the bond', reason => {
  const {state,beast,source,target}=fixture()
  if(reason==='distance')state.distanceFeetByCombatantPair![dnd5eCombatantPairKey(source.id,target.id)]=10
  if(reason.endsWith('-wall')){
    const [a,b]=reason.split('-');state.physicalLineOfSightBlockedByCombatantPair={[dnd5eDirectedCombatantPairKey(a,b)]:true}
  }
  if(reason==='suppressed-source')source.magicSuppressed=true
  if(reason==='suppressed-beast')beast.magicSuppressed=true
  if(reason==='suspended-effect')beast.classState.activeEffects![0].suspendedBy=['test']
  if(reason==='missing-source')delete state.combatants.source
  expect(dnd5eSourceProximityAttackAdvantage(state,beast,target)).toBe(false)
  expect(beast.classState.activeEffects).toHaveLength(1)
})

it('restores advantage when sight returns and cancels it against attack disadvantage', () => {
  const {state,beast,target}=fixture()
  state.physicalLineOfSightBlockedByCombatantPair={[dnd5eDirectedCombatantPairKey('source','beast')]:true}
  expect(dnd5eMonsterSpellAttackMode(state,beast.id,target.id,'melee')).toBe('normal')
  state.physicalLineOfSightBlockedByCombatantPair={}
  expect(dnd5eMonsterSpellAttackMode(state,beast.id,target.id,'melee')).toBe('advantage')
  beast.classState.activeEffects!.push(createDnd5eMechanicalEffect({definitionId:'test:penalty',label:'Penalty',source:{kind:'feature'},targetId:beast.id,modifiers:{attackRollDisadvantage:true},duration:{type:'permanent'}}))
  expect(dnd5eMonsterSpellAttackMode(state,beast.id,target.id,'melee')).toBe('normal')
})

it.each([null,{rangeFeet:-1},{rangeFeet:NaN},{rangeFeet:5,requiresMutualSight:'yes'},{rangeFeet:5,grantRegardless:true}])('rejects malformed source conditions %j', value => {
  expect(validDnd5eSourceProximityAttack(value)).toBe(false)
  const {beast}=fixture();Object.assign(beast.classState.activeEffects![0].modifiers!,{sourceProximityAttackAdvantage:value})
  expect(validateDnd5eActiveEffectsStrict(beast.classState.activeEffects)).toMatchObject({ok:false})
})
