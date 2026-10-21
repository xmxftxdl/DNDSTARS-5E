import {afterEach,expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction} from '../headlessCombatEngine'
import {registerDnd5eActivityPackage,clearDnd5eActivityRegistryForTests} from './dnd5eActivityRegistry'
import {resolveAndCommitDnd5eActivityCommand} from './dnd5eActivityHeadlessAuthorityBridge'
import {dnd5eActivityActorSnapshotFromCombatantV1} from './dnd5eActivityCombatAuthority'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
import {registerDnd5eRulesPlugin} from '../pluginApi'
afterEach(clearDnd5eActivityRegistryForTests)
function fixture() {
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'bolt',name:'Attack replacement',automation:automationCapabilityFromLegacyStatus('full'),
 legacySource:{kind:'feature',id:'bolt'},usesAttackActionAttack:true,activation:{kind:'free'},target:{kind:'creature',count:1,rangeFeet:30,relation:'enemy'},
 checks:[{id:'hit',kind:'attack-roll',attackType:'spell',delivery:'ranged',rollId:'hit',rollMode:'normal',attackBonus:{kind:'constant',value:5},scope:'per-target'}],
 outcomes:[{id:'damage',when:{kind:'check',checkId:'hit',result:'success'},operations:[{id:'damage',kind:'damage',target:'target',damageType:'radiant',amount:{kind:'constant',value:5}}]}]}
 registerDnd5eActivityPackage({packageId:'test.attack-budget',packageVersion:'1.0.0',activities:[activity]})
 const actors=['actor','target'].map((id,i)=>createDnd5eCombatant({id,name:id,controller:i?'dm':'player',initiative:20-i,abilities:{str:10,dex:16,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:i*5,y:0},concentrating:false}))
 return startDnd5eHeadlessCombat('budget',actors)
}
function attack(state:ReturnType<typeof fixture>,used?:number,extraWeaponAttacksPerAction=0,actionCount=1,targetId='target',d20=15) {
 return resolveAndCommitDnd5eActivityCommand(state,{command:{schemaVersion:1,commandId:`bolt-${used}`,packageId:'test.attack-budget',packageVersion:'1.0.0',activityId:'bolt',actorId:'actor',targetIds:[targetId],expectedRevision:0},currentRevision:0,
 actor:dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.actor),targets:[dnd5eActivityActorSnapshotFromCombatantV1(state.combatants[targetId])],
 authoritativeRolls:{[`hit:${targetId}`]:{values:[d20]}},distanceFeetByTargetId:{[targetId]:5}},used===undefined?{}:{featureAttackBudget:{attacksPerAction:2,actionCount,attacksUsed:used,extraWeaponAttacksPerAction}})
}
it('records distinct spell attack replacement targets even when both miss',()=>{
 const state=fixture()
 state.combatants.second={...structuredClone(state.combatants.target),id:'second'}
 const first=attack(state,0,0,1,'target',1)
 if(first.phase!=='commit'||!first.result.ok)throw Error('first replacement failed')
 const second=attack(JSON.parse(JSON.stringify(first.result.state)),1,0,1,'second',1)
 if(second.phase!=='commit'||!second.result.ok)throw Error('second replacement failed')
 expect(second.result.state.combatants.actor.classState.attackActionHistory).toMatchObject({
  actionOrdinal:1,attacksTaken:2,creatureTargetIds:['target','second'],
 })
 expect(first.result.state.combatants.actor.classState.attackActionHistory?.creatureTargetIds).toEqual(['target'])
 expect(second.result.state.combatants.target.currentHp).toBe(20)
 expect(second.result.state.combatants.second.currentHp).toBe(20)
})
it('keeps the first-turn weapon grant when the Attack action starts with replacements',()=>{
 const state=fixture()
 let featureId=''
 const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.mixed-first-turn',name:'Mixed',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
  featureId=api.registerFeature({id:'ambush',name:'Ambush',description:'Synthetic',summary:'Synthetic',automation:'full',
   declarativeAbility:{schemaVersion:1,id:'ambush',name:'Ambush',description:'Synthetic',level:1,trigger:{kind:'passive'},targeting:{kind:'self'},effects:[],automation:'full',
   mechanic:{kind:'first-own-turn-extra-weapon-attack',damageDice:{count:1,sides:8}}}})
 }})
 try{
  state.combatants.actor.pluginFeatureIds=[featureId]
  const first=attack(state,0,1,2)
  expect(first.result.ok,JSON.stringify(first)).toBe(true)
  if(first.phase!=='commit'||!first.result.ok)throw Error('first replacement failed')
  const grant=first.result.state.combatants.actor.classState.firstOwnTurnWeaponAttack
  expect(grant?.featureId).toBe(featureId)
  expect(first.result.state.combatants.actor.classState.firstOwnCombatTurn?.combatId).toBe('budget')
  const second=attack(JSON.parse(JSON.stringify(first.result.state)),1,1,2)
  expect(second.result.ok).toBe(true)
  if(second.phase!=='commit'||!second.result.ok)throw Error('second replacement failed')
  expect(second.result.state.combatants.actor.classState.firstOwnTurnWeaponAttack).toEqual(grant)
  expect(attack(second.result.state,2,1,2).result.ok).toBe(false)
  const extra=resolveDnd5eHeadlessAction(second.result.state,{type:'attack',actorId:'actor',targetId:'target',
   spendAction:false,attackModifier:5,d20:1,damage:{count:1,sides:6,bonus:0,rolls:[2],type:'slashing'},
   classDamageContext:{firstOwnTurnWeaponAttackFeatureId:featureId,weaponId:'test-sword',mode:'melee',finesse:false,strengthBased:true,
    weaponDamageSides:6,damageType:'slashing',adjacentEnemyOfTarget:false}})
  expect(extra.ok,extra.ok?'':extra.reason).toBe(true)
  expect(extra.state.combatants.actor.classState.firstOwnTurnWeaponAttack).toBeUndefined()
  const surged=JSON.parse(JSON.stringify(extra.state));surged.combatants.actor.turn.actionAvailable=true
  const next=attack(surged,3,1,2)
  expect(next.result.ok,JSON.stringify(next)).toBe(true)
  if(next.phase!=='commit'||!next.result.ok)throw Error('next action failed')
  expect(next.result.state.combatants.actor.turn.actionAvailable).toBe(false)
  expect(next.result.state.combatants.actor.classState.firstOwnTurnWeaponAttack?.featureId).toBe(featureId)
 }finally{dispose()}
})
it('uses one action for two replacements and rejects a third without consuming ammunition',()=>{
 const state=fixture(),first=attack(state,0)
 expect(first.result.ok,JSON.stringify(first)).toBe(true)
 if(first.phase!=='commit'||!first.result.ok)throw Error('first failed')
 expect(first.result.state.combatants.actor.turn.actionAvailable).toBe(false)
 expect(first.result.events.find(e=>e.type==='attack-resolved')).toMatchObject({attackOrigin:'attack-action',attackCategory:'spell'})
 const second=attack(first.result.state,1)
 expect(second.result.ok,JSON.stringify(second)).toBe(true)
 if(second.phase!=='commit'||!second.result.ok)throw Error('second failed')
 expect(second.result.state.combatants.target.currentHp).toBe(10)
 expect(attack(second.result.state,2).result.ok).toBe(false)
 expect(state.combatants.target.currentHp).toBe(20)
})
it.each([undefined,1,2,-1])('rejects absent or unearned/exhausted budget %s',(used)=>{
 expect(attack(fixture(),used).result.ok).toBe(false)
})
it('rejects off-turn replacement',()=>{
 const state=fixture();state.initiativeIndex=1
 expect(attack(state,0).result.ok).toBe(false)
})
it('cannot bypass budget through the legacy plugin action',()=>{
 const state=fixture()
 const result=resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId:'test.attack-budget',actionId:'bolt',actorId:'actor',targetId:'target'})
 expect(result.ok).toBe(false)
 expect(result.state.combatants.target.currentHp).toBe(20)
})
