import {expect,it} from 'vitest'
import {dnd5eBoundedHostEventId} from './activities/dnd5eActivityIdentity'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,type Dnd5eAction} from './headlessCombatEngine'
import {registerDnd5eActivityPackage} from './activities/dnd5eActivityRegistry'
import {resolveDnd5eActionWithDamageReactions} from './damageReactionFlow'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'

it('keeps legal prior identities and case-sensitive stable bounded runtime identities',()=>{
 const old='activity-event:lowercase:batch:0:before-damage'
 expect(dnd5eBoundedHostEventId(old)).toBe(old)
 const upper=dnd5eBoundedHostEventId('activity-event:Ab:batch:0:before-damage')
 expect(upper).not.toBe(dnd5eBoundedHostEventId('activity-event:ab:batch:0:before-damage'))
 expect(upper).toBe(dnd5eBoundedHostEventId('activity-event:Ab:batch:0:before-damage'))
 for(const value of [upper,dnd5eBoundedHostEventId('x'.repeat(1000))])expect(value).toMatch(/^[a-z0-9][a-z0-9._:-]{0,255}$/)
})
it.each(['tomb-HVUFGQ','lowercase','Combat-'+ 'X'.repeat(400)])('settles real personal damage reaction with original combat identity %s',async combatId=>{
 const registration=registerDnd5eActivityPackage({packageId:'test.identity-ward',packageVersion:'1.0.0',activities:[{
 schemaVersion:1,id:'ward',name:'Ward',activation:{kind:'reaction'},target:{kind:'self'},legacySource:{kind:'feature',id:'ward'},automation:automationCapabilityFromLegacyStatus('full'),
 invocation:{kind:'triggered',event:'before-damage',confirmation:'actor-choice'},
 consumption:[{kind:'resource',resourceId:'ward-uses',amount:{kind:'constant',value:1},consumeOn:'confirm'}],
 outcomes:[{id:'ward',when:{kind:'always'},operations:[{id:'thp',kind:'temporary-hit-points',target:'actor',amount:{kind:'constant',value:10}}]}]}]})
 try{
 const actor=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,initiative,controller:'player',abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:12,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
 const state=startDnd5eHeadlessCombat(combatId,[actor('attacker',20),actor('defender',10)])
 state.combatants.defender.pluginFeatureIds=['test.identity-ward:ward'];state.combatants.defender.classResources['ward-uses']={current:1,max:1}
 const action:Dnd5eAction={type:'attack',actorId:'attacker',targetId:'defender',d20:18,attackModifier:10,damage:{count:1,sides:6,rolls:[4],bonus:0,type:'fire'}}
 const ids:string[]=[]
 for(let replay=0;replay<2;replay++){
 const out=await resolveDnd5eActionWithDamageReactions({state,action,replayEventBatchId:'stable-batch',combatRevision:1,authorityUnchanged:()=>true,confirm:async request=>{ids.push(request.eventId);expect(request.triggerContext.eventId).toBe(request.eventId);return {accepted:true}},roll:async()=>{throw Error('no dice')}})
 expect(out.ok,JSON.stringify(out)).toBe(true);expect(out.state.combatId).toBe(combatId);expect(out.state.combatants.defender.currentHp).toBe(20);expect(out.state.combatants.defender.temporaryHp).toBe(6);expect(out.state.combatants.defender.classResources['ward-uses'].current).toBe(0)
 }
 expect(ids).toHaveLength(2);expect(ids[0]).toBe(ids[1]);expect(state.combatants.defender.classResources['ward-uses'].current).toBe(1)
 }finally{registration.dispose()}
})
