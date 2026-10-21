import type { Dnd5eEffectModifierV1 } from './dnd5eEffectContracts'
import { clearDnd5eActivityRegistryForTests, registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { afterEach, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { commitDnd5eActivityExecution, createDnd5eCombatant, dnd5eCombatantPairKey, dnd5eEffectiveSpeed, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { validateDnd5eActiveEffectsStrict } from '../activeEffects'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { dnd5eActivityAutomationAnalysisV1 } from '../plugins/pluginMechanicsRegistry'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
const activity: Dnd5eActivityDefinitionV1 = {
 schemaVersion: 1, id: 'attack-speed', name: 'Attack speed', activation: { kind: 'free' }, target: { kind: 'self' },
 automation: automationCapabilityFromLegacyStatus('full'),
 effects: [{ schemaVersion: 1, id: 'enhancement', name: 'Enhancement', stacking: 'replace',
   duration: { kind: 'rounds', rounds: 2, expiresAt: 'target-turn-end' },
   breakOn: ['makes-weapon-attack'], modifiers: [{ kind: 'speed-after-own-turn-weapon-attack', bonusFeet: 30 }] }],
 outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect', target: 'actor', effectId: 'enhancement' }] }],
}
function prepared(extraModifiers: Dnd5eEffectModifierV1[] = [], attackActionOnly = false) {
 const configured = {...activity,effects:activity.effects!.map(effect=>({...effect,modifiers:[...(effect.modifiers??[]),...extraModifiers]}))}
 if (attackActionOnly) {
  configured.effects[0].breakOn = []
  configured.effects[0].modifiers = [{kind:"speed-after-own-turn-weapon-attack",bonusFeet:10,attackActionOnly:true}]
 }
 const actor = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative, controller: 'player',
  abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10,
  currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: {x:0,y:0}, concentrating: false,
  classId: 'wizard', level: 1, classSelections: { 'spell-cantrips': ['fire-bolt'] } })
 const state = startDnd5eHeadlessCombat('speed', [actor('actor',20),actor('target',10)])
 state.combatants.target.controller = 'dm'
 state.distanceFeetByCombatantPair = {[dnd5eCombatantPairKey('actor','target')]:5}
 const snapshot=dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.actor)
 const committed=commitDnd5eActivityExecution(state,{actorId:'actor',activityId:activity.id,targetIds:['actor'],source:{kind:'spell',id:'test-speed',packageId:'test.speed'},
   resolution:resolveDnd5eActivity({activity:configured,actor:snapshot,targets:[snapshot],rolls:{}})})
 expect(committed.ok).toBe(true)
 return committed.state
}
const attack = (d20:number) => ({type:'attack' as const,actorId:'actor',targetId:'target',attackModifier:5,d20,
 classDamageContext:{mode:'melee' as const,weaponId:'longsword',finesse:false,strengthBased:true,weaponDamageSides:8,damageType:'slashing' as const,adjacentEnemyOfTarget:false},
 damage:{count:1,sides:8,bonus:0,rolls:[2],type:'slashing' as const}})
it.each([2,15])('grants speed after the enhanced weapon attack (d20 %s), consumes its marker and expires this turn',d20=>{
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 expect(dnd5eActivityAutomationAnalysisV1(activity).missingComponents).toEqual([])
 const state=prepared()
 const effects=state.combatants.actor.classState.activeEffects!
 expect(validateDnd5eActiveEffectsStrict(JSON.parse(JSON.stringify(effects)))).toMatchObject({ok:true})
 expect(dnd5eEffectiveSpeed(state.combatants.actor)).toBe(30)
 const result=resolveDnd5eHeadlessAction(state,attack(d20))
 expect(result.ok,result.ok?undefined:result.reason).toBe(true)
 expect(dnd5eEffectiveSpeed(result.state.combatants.actor)).toBe(60)
 expect(result.state.combatants.actor.turn.movementRemaining).toBe(60)
 expect(result.state.combatants.actor.classState.activeEffects?.some(e=>e.breakOn?.includes('makes-weapon-attack'))).toBe(false)
 const ended=resolveDnd5eHeadlessAction(result.state,{type:'end-turn',actorId:'actor'})
 expect(ended.ok).toBe(true)
 expect(dnd5eEffectiveSpeed(ended.state.combatants.actor)).toBe(30)
})
it('does not activate for a spell attack, an off-turn weapon attack, or a suppressed marker',()=>{
 const state=prepared()
 const spell=resolveDnd5eHeadlessAction(state,{type:'cast-spell',actorId:'actor',targetId:'target',spellId:'fire-bolt',slotLevel:0,castingClassId:'wizard',d20:15,effectRolls:[3]})
 expect(spell.ok,spell.ok?undefined:spell.reason).toBe(true)
 expect(dnd5eEffectiveSpeed(spell.state.combatants.actor)).toBe(30)
 expect(spell.state.combatants.actor.classState.activeEffects?.some(e=>e.modifiers?.speedAfterOwnTurnWeaponAttackFeet===30)).toBe(true)
 const offTurn=structuredClone(state);offTurn.initiativeIndex=1
 const reaction=resolveDnd5eHeadlessAction(offTurn,{...attack(15),type:'opportunity-attack'})
 expect(reaction.ok).toBe(true)
 expect(dnd5eEffectiveSpeed(reaction.state.combatants.actor)).toBe(30)
 const suppressed=structuredClone(state);suppressed.combatants.actor.classState.activeEffects![0].suspendedBy=['test-antimagic']
 const suppressedAttack=resolveDnd5eHeadlessAction(suppressed,attack(15))
 expect(suppressedAttack.ok).toBe(true)
 expect(dnd5eEffectiveSpeed(suppressedAttack.state.combatants.actor)).toBe(30)
})


afterEach(clearDnd5eActivityRegistryForTests)
it('consumes a separate grant once while retaining the main spell and binds attack speed to its lifecycle',()=>{
 const boost: Dnd5eActivityDefinitionV1 = {...activity,id:'boost',legacySource:{kind:'spell',id:'test-spell'},requirements:[
  {kind:'turn-owner',owner:'actor'},
  {kind:'active-effect',subject:'actor',effectId:'ticket',present:true,source:'self'},
 ],effects:activity.effects!.map(effect=>({...effect,sourceLink:{sourceRequiresEffect:'main'}})),
 outcomes:[{id:'consume-and-arm',when:{kind:'always'},operations:[
  {id:'consume',kind:'remove-effect',target:'actor',effectId:'ticket',source:'self'},
  {id:'arm',kind:'apply-effect',target:'actor',effectId:'enhancement'},
 ]}]}
 const cast: Dnd5eActivityDefinitionV1 = {...activity,id:'cast',effects:[
  {schemaVersion:1,id:'main',name:'Main',stacking:'replace',duration:{kind:'concentration',maximumRounds:10},concentration:true,
   modifiers:[{kind:'prevent-movement-opportunity-attacks'}]},
  {schemaVersion:1,id:'ticket',name:'One use',stacking:'replace',duration:{kind:'rounds',rounds:10,expiresAt:'target-turn-end'},
   grants:['boost'],sourceLink:{sourceRequiresEffect:'main'}},
 ],outcomes:[{id:'cast',when:{kind:'always'},operations:[
  {id:'main',kind:'apply-effect',target:'actor',effectId:'main'},
  {id:'ticket',kind:'apply-effect',target:'actor',effectId:'ticket'},
 ]}]}
 registerDnd5eActivityPackage({packageId:'test.attack-speed',packageVersion:'1.0.0',activities:[cast,boost]})
 let state=prepared();state.combatants.actor.classState.activeEffects=[]
 const snapshot=dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.actor)
 const castResult=commitDnd5eActivityExecution(state,{actorId:'actor',activityId:cast.id,targetIds:['actor'],source:{kind:'spell',id:cast.id,packageId:'test.attack-speed'},
  resolution:resolveDnd5eActivity({activity:cast,actor:snapshot,targets:[snapshot],rolls:{}})})
 expect(castResult.ok).toBe(true);state=castResult.state
 const use=()=>resolveRegisteredDnd5eActivityInCombatV1({state,combatRevision:1,
  command:{schemaVersion:1,commandId:'boost-request',actorId:'actor',packageId:'test.attack-speed',packageVersion:'1.0.0',activityId:'boost',targetIds:['actor'],expectedRevision:1},
  authoritativeRolls:{},confirmedBy:'actor'})
 const first=use();expect(first.result.ok).toBe(true)
 if(first.phase!=='commit'||!first.result.ok)throw Error('boost did not commit')
 state=first.result.state
 expect(state.combatants.actor.classState.activeEffects?.some(e=>e.modifiers?.preventMovementOpportunityAttacks)).toBe(true)
 expect(use().result.ok).toBe(false)
 const attacked=resolveDnd5eHeadlessAction(state,attack(15));expect(attacked.ok).toBe(true);state=attacked.state
 expect(dnd5eEffectiveSpeed(state.combatants.actor)).toBe(60)
 expect(use().result.ok).toBe(false)
 const ended=resolveDnd5eHeadlessAction(state,{type:'concentration-save',actorId:'actor',d20:1,dc:10})
 expect(ended.ok,ended.ok?undefined:ended.reason).toBe(true);state=ended.state
 expect(dnd5eEffectiveSpeed(state.combatants.actor)).toBe(30)
 expect(state.combatants.actor.classState.activeEffects?.some(e=>e.modifiers?.preventMovementOpportunityAttacks) ?? false).toBe(false)
})



it.each(['miss','hit','critical'] as const)('settles next-attack advantage and delayed damage before cleanup: %s',outcome=>{
 const state=prepared([
  {kind:'weapon-attack-roll',mode:'advantage'},
  {kind:'on-hit-bonus-damage',amount:{kind:'dice',rollId:'force',count:1,sides:8},damageType:'force',appliesTo:'all-weapon-attacks',doubleDiceOnCritical:true},
 ])
 const effectId=state.combatants.actor.classState.activeEffects!.find(e=>e.modifiers?.onHitBonusDamage)!.id
 const request={...attack(outcome==='critical'?20:outcome==='hit'?15:2),d20Second:outcome==='miss'?3:10,
  damage:{...attack(15).damage,rolls:outcome==='critical'?[2,3]:[2]},
  classDamageRolls:outcome==='miss'?[]:[{source:'activity-effect-rider' as const,rollId:`activity-on-hit:${effectId}`,rolls:outcome==='critical'?[5,6]:[5]}]}
 const result=resolveDnd5eHeadlessAction(state,request)
 expect(result.ok,result.ok?undefined:result.reason).toBe(true)
 expect(result.state.combatants.target.currentHp).toBe(outcome==='miss'?30:outcome==='hit'?23:14)
 expect(dnd5eEffectiveSpeed(result.state.combatants.actor)).toBe(60)
 expect(result.state.combatants.actor.classState.activeEffects?.some(e=>e.modifiers?.onHitBonusDamage)??false).toBe(false)
})

it.each([2,15])('Attack-action speed survives reload, includes misses and does not stack (d20 %s)',d20=>{
 const state=JSON.parse(JSON.stringify(prepared([],true)))
 expect(validateDnd5eActiveEffectsStrict(state.combatants.actor.classState.activeEffects)).toMatchObject({ok:true})
 const first=resolveDnd5eHeadlessAction(state,attack(d20));expect(first.ok).toBe(true)
 expect(dnd5eEffectiveSpeed(first.state.combatants.actor)).toBe(40)
 expect(first.state.combatants.actor.turn.movementRemaining).toBe(40)
 first.state.combatants.actor.turn.actionAvailable=true
 const second=resolveDnd5eHeadlessAction(first.state,attack(d20));expect(second.ok,second.ok?undefined:second.reason).toBe(true)
 expect(dnd5eEffectiveSpeed(second.state.combatants.actor)).toBe(40)
 expect(second.state.combatants.actor.turn.movementRemaining).toBe(40)
 const ended=resolveDnd5eHeadlessAction(second.state,{type:'end-turn',actorId:'actor'});expect(ended.ok).toBe(true)
 expect(dnd5eEffectiveSpeed(ended.state.combatants.actor)).toBe(30)
})
it('Attack-action restriction excludes own-turn bonus and reaction attacks and includes unarmed attacks',()=>{
 for(const type of ['bonus','reaction','unarmed'] as const){
  const state=prepared([],true)
  const request=type==='reaction'?{...attack(15),type:'opportunity-attack' as const}
   :type==='bonus'?{...attack(15),spendBonusAction:true}
   :{...attack(15),classDamageContext:undefined}
  const result=resolveDnd5eHeadlessAction(state,request)
  expect(result.ok,type).toBe(true)
  expect(dnd5eEffectiveSpeed(result.state.combatants.actor),type).toBe(type==='unarmed'?40:30)
 }
})

it('rejects a nonboolean Attack-action restriction in imported and persisted effects',()=>{
 const malformed=structuredClone(activity)
 Object.assign(malformed.effects![0].modifiers![0],{attackActionOnly:'true'})
 expect(validateDnd5eActivityDefinitionV1(malformed).some(error=>error.includes('attackActionOnly'))).toBe(true)
 const state=prepared([],true)
 Object.assign(state.combatants.actor.classState.activeEffects![0].modifiers!,{speedAfterOwnTurnWeaponAttackActionOnly:'true'})
 expect(validateDnd5eActiveEffectsStrict(state.combatants.actor.classState.activeEffects).ok).toBe(false)
})
