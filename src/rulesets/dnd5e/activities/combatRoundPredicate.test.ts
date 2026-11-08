import {afterEach,expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {createDnd5eCombatant,startDnd5eHeadlessCombat} from '../headlessCombatEngine'
import {resolveDnd5eActivity} from './dnd5eActivityExecutor'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'
import {registerDnd5eActivityPackage,clearDnd5eActivityRegistryForTests} from './dnd5eActivityRegistry'
import {resolveRegisteredDnd5eActivityInCombatV1,dnd5eActivityActorSnapshotFromCombatantV1} from './dnd5eActivityCombatAuthority'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
const definition=():Dnd5eActivityDefinitionV1=>({schemaVersion:1,id:'first-round',name:'First round',activation:{kind:'free'},target:{kind:'self'},requirements:[{kind:'combat-round',round:1}],legacySource:{kind:'feature',id:'first-round'},automation:automationCapabilityFromLegacyStatus('full'),outcomes:[{id:'grant',when:{kind:'always'},operations:[{id:'hp',kind:'temporary-hit-points',target:'actor',amount:{kind:'constant',value:3}}]}]})
function combat(){const actor=createDnd5eCombatant({id:'actor',name:'Actor',initiative:20,controller:'player',abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,pluginFeatureIds:['test.round:first-round']});return startDnd5eHeadlessCombat('host-round',[actor,{...structuredClone(actor),id:'enemy',name:'Enemy',controller:'dm',initiative:10,pluginFeatureIds:[]}])}
afterEach(clearDnd5eActivityRegistryForTests)
it.each([undefined,0,-1,1,2,1.5,Number.NaN,Number.POSITIVE_INFINITY])('requires a known active exact Host round: %s',combatRound=>{
 const state=combat(),actor=dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.actor)
 const run=(combatActive:boolean|undefined)=>resolveDnd5eActivity({activity:definition(),actor,targets:[actor],rolls:{},combatRound,combatActive})
 expect(run(true).ok).toBe(combatRound===1)
 expect(run(false).ok).toBe(false)
 expect(run(undefined).ok).toBe(false)
})
it('ignores forged command round and derives the round from persisted Host state',()=>{
 registerDnd5eActivityPackage({packageId:'test.round',packageVersion:'1.0.0',activities:[definition()]})
 const state=combat(),command={schemaVersion:1 as const,commandId:'round-request',actorId:'actor',packageId:'test.round',packageVersion:'1.0.0',activityId:'first-round',targetIds:['actor'],expectedRevision:1,combatRound:1}
 const run=()=>resolveRegisteredDnd5eActivityInCombatV1({state,combatRevision:1,command,authoritativeRolls:{},confirmedBy:'actor'})
 expect(state.active,JSON.stringify({active:state.active,round:state.round})).toBe(true)
 expect(state.round).toBe(1)
 const initial=run();expect(initial.result.ok,JSON.stringify(initial.result)).toBe(true)
 state.round=2
 expect(run().result.ok).toBe(false)
 state.round=1;command.combatRound=2
 expect(run().result.ok).toBe(true)
 state.active=false
 expect(run().result.ok).toBe(false)
 expect(state.combatants.actor.temporaryHp).toBe(0)
})
it.each([0,-1,1.5,1_000_001,Number.NaN,Number.POSITIVE_INFINITY])('rejects malformed public round predicate %s',round=>{
 expect(validateDnd5eActivityDefinitionV1({...definition(),requirements:[{kind:'combat-round',round}]}).length).toBeGreaterThan(0)
})
