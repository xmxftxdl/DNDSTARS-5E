import {expect,it} from 'vitest'
import {createDnd5eCombatant,resolveDnd5eHeadlessAction,startDnd5eHeadlessCombat,dnd5eCombatantPairKey,type Dnd5eAction} from './headlessCombatEngine'
import {resolveDnd5eActionWithAirborneFallPreview} from './airborneFallActionResolution'
import {dnd5eHighJumpMaximumFeet,dnd5eTraversalMovementCost} from './traversal'
import {dnd5eHeadlessAreaTraversalModifiers} from './headlessAreaTraversal'
it.each([{inside:true,resist:false,expected:4},{inside:false,resist:false,expected:9},{inside:true,resist:true,expected:2}])('uses actual landing point and combines fall reduction with resistance %j',({inside,resist,expected})=>{
 const abilities={str:16,dex:14,con:14,int:10,wis:12,cha:8}
 const caster=createDnd5eCombatant({id:'source',name:'Source',controller:'player',initiative:20,abilities,proficiencyBonus:2,armorClass:16,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
 const flyer=createDnd5eCombatant({...caster,id:'flyer',name:'Flyer',controller:'dm',initiative:10,position:{x:5,y:0},elevationFeet:30,groundElevationFeet:0,airborne:true,movementSpeeds:{walk:30,fly:60},damageResistances:resist?['bludgeoning']:[]})
 const state=startDnd5eHeadlessCombat('updraft',[caster,flyer]);state.mapId='m';state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('source','flyer')]:5}
 state.companionScene={geometry:null,projectedTokenIds:['source','flyer'],worldMinute:10,map:{id:'m',name:'M',width:100,height:100,gridSize:5,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'flyer',label:'Flyer',type:'enemy',x:99,y:99,elevationFeet:30,size:1,color:'',emoji:''}],dnd5ePluginAreas:[{id:'up',pluginId:'test.up',featureId:'up',label:'Updraft',color:'',sourceTokenId:'source',sourceCharacterId:'source',createdRound:1,expiresAfterRound:601,anchorMode:'fixed',relation:'any',includeSelf:true,cells:[{col:inside?1:10,row:0}],vertical:{mode:'volume',baseElevationFeet:0,heightFeet:10},occupantModifiers:{halvesFallingDamage:true,verticalJumpBonusFeet:10}}]}}
 expect(dnd5eHeadlessAreaTraversalModifiers(state,state.combatants.flyer).halvesFallingDamage).toBe(false)
 const before=structuredClone(state),action:Dnd5eAction={type:'shove',actorId:'source',targetId:'flyer',actorD20:20,targetD20:1,targetDefense:'acrobatics',outcome:'prone'}
 const settled=resolveDnd5eActionWithAirborneFallPreview(state,action,{flyer:[2,3,4]})
 expect(settled.result.ok,JSON.stringify(settled.result)).toBe(true)
 expect(settled.result.state.combatants.flyer.currentHp).toBe(20-expected)
 expect(settled.result.events).toContainEqual(expect.objectContaining({type:'falling-damage-resolved',actorId:'flyer',damage:expected}))
 expect(state).toEqual(before)
})
it('adds ten feet to high jumps without increasing horizontal range or removing movement costs',()=>{
 expect(dnd5eHighJumpMaximumFeet(3,true,1,10)).toBe(16)
 expect(dnd5eHighJumpMaximumFeet(3,false,1,10)).toBe(13)
 const profile={strengthScore:16,strengthModifier:3,walkSpeed:30,verticalJumpBonusFeet:10}
 expect(dnd5eTraversalMovementCost({distanceFeet:5,elevationGainFeet:12,mode:'long-jump-standing',profile}).ok).toBe(true)
 expect(dnd5eTraversalMovementCost({distanceFeet:9,elevationGainFeet:1,mode:'long-jump-standing',profile})).toEqual({ok:false,reason:'jump-too-far'})
 expect(dnd5eTraversalMovementCost({distanceFeet:5,elevationGainFeet:14,mode:'long-jump-standing',profile})).toEqual({ok:false,reason:'jump-too-high'})
})

it.each([true,false])('samples the actual composite-jump launch cell; bonus at launch=%s',atLaunch=>{
 const actor=createDnd5eCombatant({id:'jumper',name:'Jumper',controller:'player',initiative:20,abilities:{str:16,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:2.5,y:2.5},concentrating:false})
 const state=startDnd5eHeadlessCombat('jump',[actor,{...structuredClone(actor),id:'enemy',controller:'dm',initiative:10,position:{x:50,y:50}}]);state.mapId='m';state.coordinateUnitsPerFoot=1
 state.companionScene={geometry:null,projectedTokenIds:['jumper'],map:{id:'m',name:'M',width:100,height:100,gridSize:5,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'jumper',label:'Jumper',type:'player',x:2.5,y:2.5,size:1,color:'',emoji:''}],dnd5ePluginAreas:[{id:'up',pluginId:'test',featureId:'up',label:'Up',color:'',sourceTokenId:'jumper',sourceCharacterId:'jumper',createdRound:1,expiresAfterRound:601,anchorMode:'fixed',relation:'any',includeSelf:true,cells:[{col:atLaunch?2:0,row:0}],vertical:{mode:'volume',baseElevationFeet:0,heightFeet:100},occupantModifiers:{verticalJumpBonusFeet:10}}]}}
 const action:Dnd5eAction={type:'move',actorId:'jumper',to:{x:17.5,y:2.5},distance:15,jumpDistance:5,jumpPath:[2.5,7.5,12.5,17.5].map(x=>({x,y:2.5})),jumpPathElevationsFeet:[0,0,0,12],traversalMode:'long-jump-running',toElevationFeet:12,toGroundElevationFeet:12}
 const result=resolveDnd5eHeadlessAction(state,action)
 expect(result.ok,JSON.stringify(result)).toBe(atLaunch)
 if(!result.ok)expect(result.reason).toBe('invalid-class-feature')
 expect(state.combatants.jumper.position).toEqual({x:2.5,y:2.5})
})
