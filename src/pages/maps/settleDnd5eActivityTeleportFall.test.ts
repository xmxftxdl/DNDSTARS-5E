import{createDnd5eMechanicalEffect}from'../../rulesets/dnd5e/activeEffects'
import{beforeEach,expect,it,vi}from'vitest'
import{setMapGeometryRuntime}from'../../lib/mapGeometry'
import{createDnd5eCombatant,startDnd5eHeadlessCombat}from'../../rulesets/dnd5e/headlessCombatEngine'
import{applyDnd5eActivityMapHandoffsV1}from'../../rulesets/dnd5e/activities/dnd5eActivityMapInteraction'
import{synchronizeDnd5eActivityMapMovement}from'../../rulesets/dnd5e/activities/dnd5eActivityMapMovementEvents'
import{resolveDnd5eActivity}from'../../rulesets/dnd5e/activities/dnd5eActivityExecutor'
import type{Dnd5eActivityDefinitionV1}from'../../rulesets/dnd5e/activities/dnd5eActivityContracts'
import{automationCapabilityFromLegacyStatus}from'../../domain/automation/automationCapability'
import{settleDnd5eConcentrationChecks}from'./settleDnd5eCombatResult'
import type{BattleMap}from'../../store/maps'
beforeEach(()=>setMapGeometryRuntime([]))
const abilities={str:10,dex:10,con:10,int:10,wis:10,cha:10},activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'air-step',name:'Air step',automation:automationCapabilityFromLegacyStatus('full'),activation:{kind:'bonus-action'},target:{kind:'self'},outcomes:[{id:'move',when:{kind:'always'},operations:[{id:'landing',kind:'move',target:'actor',mode:'teleport',distanceFeet:{kind:'constant',value:30},verticalDestination:'space',requiresVisibleDestination:true}]}]}
it.each(['unsupported','supported-flight','manual-edit','ground']as const)('accepted ordinary Activity teleport preserves native fall rules: %s',async mode=>{
 const beforeMap:BattleMap={id:'air-map',name:'Air map',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[{id:'hero',label:'Hero',type:'player',x:225,y:275,size:1,emoji:'H',color:'#ffffff'}]}
 const hero=createDnd5eCombatant({id:'hero',name:'Hero',controller:'player',initiative:20,abilities,proficiencyBonus:3,armorClass:12,currentHp:40,maxHp:40,temporaryHp:0,speed:30,position:{x:225,y:275},concentrating:false})
 if(mode==='supported-flight')hero.classState.activeEffects=[createDnd5eMechanicalEffect({id:'native-flight',definitionId:'native-flight',label:'Fly',targetId:'hero',duration:{type:'permanent'},source:{kind:'spell',actorId:'hero',rulesId:'fly',magical:true},modifiers:{flySpeedFeet:60}})]
 const before=startDnd5eHeadlessCombat('activity-air-fall',[hero]),after=structuredClone(before),height=mode==='ground'?0:25
 const resolved=resolveDnd5eActivity({activity,actor:{id:'hero',level:7,controller:'players',abilities,proficiencyBonus:3,conditions:[],armorClass:12,currentHp:40,maxHp:40},targets:[{id:'hero',level:7,controller:'players',abilities,proficiencyBonus:3,conditions:[],armorClass:12,currentHp:40,maxHp:40}],rolls:{}});expect(resolved.ok,JSON.stringify(resolved)).toBe(true);if(!resolved.ok)throw Error(resolved.reason)
 const movements=resolved.proposals.filter(p=>p.kind==='move'),handoff=applyDnd5eActivityMapHandoffsV1({map:beforeMap,activity,packageId:'test.activity-air-fall',actionId:'actual-air-step',actorId:'hero',round:1,handoffs:{movements,persistentAreas:[],summons:[],invocations:[]},selection:{movementCellsByOperationId:{landing:{col:8,row:5,elevationFeet:height}}}});expect(handoff.ok,JSON.stringify(handoff)).toBe(true);if(!handoff.ok)throw Error(handoff.reason)
 const events=synchronizeDnd5eActivityMapMovement({before:beforeMap,after:handoff.map,actorId:'hero',activityId:activity.id,movements,state:after,events:[]});expect(events).toContainEqual(expect.objectContaining({type:'moved',movementKind:'teleport',actorId:'hero'}));
 const rollDice=vi.fn(async()=>[3,4]),result=await settleDnd5eConcentrationChecks({priorState:before,result:{ok:true,state:after,events:mode==='manual-edit'?[]:events},map:handoff.map,characters:[],characterIdByCombatantId:{},rollD20:async()=>20,rollD4:async()=>1,rollDice});
 const falls=mode==='unsupported';expect(rollDice).toHaveBeenCalledTimes(falls?1:0);expect(result.result.state.combatants.hero.currentHp).toBe(falls?33:40);expect(result.result.state.combatants.hero.elevationFeet??0).toBe(falls?0:height);expect(result.application.map.tokens.find(t=>t.id==='hero')?.elevationFeet??0).toBe(falls?0:height);expect(result.result.state.combatants.hero.conditions.includes('prone')).toBe(falls);expect(before.combatants.hero.currentHp).toBe(40)
})
