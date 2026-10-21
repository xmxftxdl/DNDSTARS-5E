import {afterEach,expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {createDnd5eCombatant,resolveDnd5eHeadlessAction,startDnd5eHeadlessCombat} from '../headlessCombatEngine'
import {dnd5eActivityAutomationAnalysisV1} from '../plugins/pluginMechanicsRegistry'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
import {clearDnd5eActivityRegistryForTests,registerDnd5eActivityPackage} from './dnd5eActivityRegistry'
import {listDnd5eActivityTriggerWindowsV1} from './dnd5eActivityTriggerWindows'
import {resolveRegisteredDnd5eActivityInCombatV1} from './dnd5eActivityCombatAuthority'
import {dnd5eContextPredicateSatisfiedV1} from './dnd5eActivityInvocation'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'
const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'melee-weapon-rider',name:'Synthetic rider',activation:{kind:'special'},
 invocation:{kind:'triggered',event:'attack-hit',confirmation:'automatic'},target:{kind:'creature',relation:'any',count:1},
 requirements:[{kind:'attack-category',category:'weapon'},{kind:'attack-mode',modes:['melee','unarmed']}],
 legacySource:{kind:'feature',id:'melee-weapon-rider'},automation:automationCapabilityFromLegacyStatus('full'),
 outcomes:[{id:'hit',when:{kind:'always'},operations:[{id:'damage',kind:'damage',target:'target',amount:{kind:'constant',value:3},damageType:'force'}]}],
}
afterEach(clearDnd5eActivityRegistryForTests)
it.each(['weapon','unarmed','ranged','spell-melee'] as const)('uses committed Host attack classification for %s',kind=>{
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 expect(dnd5eActivityAutomationAnalysisV1(activity).missingComponents).toEqual([])
 registerDnd5eActivityPackage({packageId:'test.category',packageVersion:'1.0.0',activities:[activity]})
 const actor=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,initiative,controller:id==='actor'?'player':'dm',
  abilities:{str:14,dex:14,con:12,int:14,wis:14,cha:10},proficiencyBonus:2,armorClass:10,currentHp:30,maxHp:30,temporaryHp:0,speed:30,
  position:{x:id==='actor'?0:5,y:0},concentrating:false,pluginFeatureIds:['melee-weapon-rider']})
 const state=startDnd5eHeadlessCombat('attack-category',[actor('actor',20),actor('target',10)])
 const attacked=resolveDnd5eHeadlessAction(state,{type:'attack',actorId:'actor',targetId:'target',attackModifier:5,d20:15,d20Second:14,
  damage:{count:1,sides:6,bonus:0,rolls:[2],type:'slashing'},classDamageContext:kind==='unarmed'?undefined:{
   mode:kind==='ranged'?'ranged':'melee',spellAttack:kind==='spell-melee',weaponId:kind==='spell-melee'?undefined:'longsword',strengthBased:true,
   finesse:false,weaponDamageSides:6,damageType:'slashing',adjacentEnemyOfTarget:false}})
 expect(attacked.ok,attacked.ok?'':attacked.reason).toBe(true)
 const windows=listDnd5eActivityTriggerWindowsV1({state:attacked.state,events:attacked.events,eventBatchId:'category-'+kind})
 const window=windows.find(w=>w.available.some(a=>a.activity.id===activity.id))
 if(kind==='ranged'||kind==='spell-melee'){expect(window).toBeUndefined();return}
 expect(window).toBeDefined();if(!window)throw Error('missing-window')
 expect(window.triggerContext.source).toMatchObject({kind:'attack',category:'weapon'})
 const resolved=resolveRegisteredDnd5eActivityInCombatV1({state:attacked.state,combatRevision:1,
  command:{schemaVersion:1,commandId:'rider',actorId:'actor',packageId:'test.category',packageVersion:'1.0.0',activityId:activity.id,
   targetIds:['target'],expectedRevision:1,triggerEventId:window.triggerContext.eventId},authoritativeRolls:{},triggerContext:window.triggerContext,confirmedBy:'system'})
 expect(resolved.result.ok,JSON.stringify(resolved.result)).toBe(true)
 if(resolved.phase!=='commit'||!resolved.result.ok)throw Error('rider-not-committed')
 expect(resolved.result.state.combatants.target.currentHp).toBe(25)
})
it('fails closed for missing category and rejects unknown declarations',()=>{
 expect(dnd5eContextPredicateSatisfiedV1({kind:'attack-delivery',delivery:'melee'},undefined)).toBe(false)
 expect(dnd5eContextPredicateSatisfiedV1({kind:'attack-delivery',delivery:'melee'},{eventId:'old',event:'attack-hit',eligibleActorIds:['a'],eligibleTargetIds:['b'],source:{kind:'attack',mode:'spell'}})).toBe(false)
 expect(dnd5eContextPredicateSatisfiedV1({kind:'attack-delivery',delivery:'melee'},{eventId:'host',event:'attack-hit',eligibleActorIds:['a'],eligibleTargetIds:['b'],source:{kind:'attack',mode:'spell',delivery:'melee'}})).toBe(true)
 expect(validateDnd5eActivityDefinitionV1({...activity,requirements:[{kind:'attack-delivery',delivery:'magical'}]} as any).some(error=>error.includes('delivery'))).toBe(true)
 expect(dnd5eContextPredicateSatisfiedV1({kind:'attack-category',category:'weapon'},undefined)).toBe(false)
 expect(dnd5eContextPredicateSatisfiedV1({kind:'attack-category',category:'weapon'},{eventId:'old',event:'attack-hit',eligibleActorIds:['a'],eligibleTargetIds:['b'],source:{kind:'attack',mode:'melee'}})).toBe(false)
 expect(validateDnd5eActivityDefinitionV1({...activity,requirements:[{kind:'attack-category',category:'magical'}]} as any).some(error=>error.includes('category'))).toBe(true)
})
