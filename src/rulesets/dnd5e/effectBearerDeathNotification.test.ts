import {expect,it} from 'vitest'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,dnd5eDirectedCombatantPairKey} from './headlessCombatEngine'
import {dnd5eActivityTriggerContextsFromCombatEventV1} from './activities/dnd5eActivityTriggerWindows'
import {createDnd5eMechanicalEffect,createDnd5eConditionEffect,normalizeDnd5eActiveEffects} from './activeEffects'
import {validateDnd5eActivityDefinitionV1} from './activities/dnd5eActivityValidation'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
it.each(['active','spell-source','no-notification','removed','expired','suspended','other-owner','incapacitated-owner','dead-owner'])('routes actual lethal damage only to the live effect owner, without broadening witness death: %s',mode=>{
 const make=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,controller:id==='killer'?'dm':'player',initiative,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:10,maxHp:10,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
 const state=startDnd5eHeadlessCombat('Bearer-Ab',[make('killer',20),make('victim',10),make('owner',5),make('other',4)])
 state.combatants.victim.usesDeathSaves=false
 state.physicalLineOfSightBlockedByCombatantPair={[dnd5eDirectedCombatantPairKey('owner','victim')]:true,[dnd5eDirectedCombatantPairKey('other','victim')]:true}
 const effect=createDnd5eMechanicalEffect({definitionId:'test-owned-curse',label:'Owned curse',targetId:'victim',source:{kind:mode==='spell-source'?'spell':'feature',actorId:mode==='other-owner'?'other':'owner',rulesId:'test-owned-curse',...(mode==='spell-source'?{spellLevel:3}:{})},modifiers:{notifySourceOnBearerDeath:true},duration:{type:'rounds',remainingRounds:10,tickOn:'source-turn-end'}})
 if(mode==='no-notification'&&effect.modifiers)delete effect.modifiers.notifySourceOnBearerDeath
 if(mode==='expired'&&effect.duration.type==='rounds')effect.duration.remainingRounds=0
 if(mode==='suspended')effect.suspendedBy=['antimagic']
 state.combatants.victim.classState.activeEffects=mode==='removed'?[]:normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([effect])))
 if(mode==='incapacitated-owner')state.combatants.owner.classState.activeEffects=[createDnd5eConditionEffect({condition:'incapacitated',targetId:'owner',source:{kind:'feature'}})]
 if(mode==='dead-owner'){state.combatants.owner.currentHp=0;state.combatants.owner.deathSaves.dead=true}
 const result=resolveDnd5eHeadlessAction(state,{type:'attack',actorId:'killer',targetId:'victim',attackModifier:20,d20:15,damage:{count:1,sides:100,rolls:[30],bonus:0,type:'bludgeoning'}})
 expect(result.ok,JSON.stringify(result)).toBe(true)
 const death=result.events.find(event=>event.type==='creature-died');expect(death,JSON.stringify(result.events)).toBeDefined();if(!death)return
 expect(death.witnessIds).not.toContain('owner');expect(death.witnessIds).not.toContain('other')
 if(mode==='expired'){const actual=result.state.combatants.victim.classState.activeEffects?.[0];if(actual?.duration.type==='rounds')actual.duration.remainingRounds=0}
 const contexts=dnd5eActivityTriggerContextsFromCombatEventV1(result.state,death,0,'actual-death')
 const owned=contexts.filter(context=>context.event==='effect-bearer-died')
 expect(owned.flatMap(context=>context.eligibleActorIds)).toEqual(mode==='active'||mode==='spell-source'?['owner']:mode==='other-owner'?['other']:[])
 if(mode==='spell-source')expect(owned[0].source).toMatchObject({kind:'spell',level:3,id:'test-owned-curse'})
 expect(contexts.filter(context=>context.event==='creature-died').flatMap(context=>context.eligibleActorIds)).toEqual(['killer'])
 expect(dnd5eActivityTriggerContextsFromCombatEventV1(result.state,death,0,'actual-death')).toEqual(contexts)
 const later=resolveDnd5eHeadlessAction(result.state,{type:'end-turn',actorId:'killer'})
 expect(later.events.some(event=>event.type==='creature-died')).toBe(false)
})
it('accepts only the explicit data-only death notification modifier and rejects injected observer claims',()=>{
 const declaration:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'notify',name:'Notify',activation:{kind:'action'},target:{kind:'creature',relation:'any',count:1},automation:automationCapabilityFromLegacyStatus('full'),effects:[{schemaVersion:1,id:'marked',name:'Marked',duration:{kind:'rounds',rounds:10,expiresAt:'source-turn-end'},stacking:'unique-by-source',modifiers:[{kind:'notify-source-on-bearer-death'}]}],outcomes:[{id:'mark',when:{kind:'always'},operations:[{id:'mark',kind:'apply-effect',target:'target',effectId:'marked'}]}]}
 expect(validateDnd5eActivityDefinitionV1(declaration)).toEqual([])
 const forged=structuredClone(declaration)
 const modifier=forged.effects?.[0].modifiers?.find(entry=>entry.kind==='notify-source-on-bearer-death')
 expect(modifier).toBeDefined();if(!modifier)throw Error('Missing explicit notification modifier')
 ;(modifier as unknown as Record<string,unknown>).ownerId='forged-owner'
 expect(validateDnd5eActivityDefinitionV1(forged).length).toBeGreaterThan(0)
})
