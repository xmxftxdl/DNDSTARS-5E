import {expect,it} from 'vitest'
import {createDnd5eMechanicalEffect,normalizeDnd5eActiveEffects,validateDnd5eActiveEffectsStrict} from './activeEffects'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,dnd5eCombatantCanSee,dnd5eCombatantPairKey} from './headlessCombatEngine'
import {compileDnd5eEffectiveVisionProfile,applyDnd5eEffectiveVisionProfile} from '../../../shared/dnd5e-vision-profile.mjs'
import {mapGeometryCanSeePoint,mapGeometryVisibilityPolygon} from '../../lib/mapGeometry'
import {projectMapsForPlayer} from '../../../scripts/shared-server-core.mjs'
import type {BattleMap,Token} from '../../store/maps'
const effect=createDnd5eMechanicalEffect({id:'short-sight',definitionId:'test:short-sight',label:'Short sight',source:{kind:'feature',actorId:'source',magical:true},targetId:'viewer',modifiers:{sightRangeLimitFeet:5}})
const viewer:Token={id:'viewer',characterId:'owner',type:'player',label:'Viewer',x:100,y:100,size:1,color:'',emoji:'',visionRangeFeet:120,darkvisionRangeFeet:120,truesightRangeFeet:120,dnd5eCombatState:{activeEffects:[effect]}}
const map:BattleMap={id:'scene',name:'Scene',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[]}
it('persists the minimum active visual cap and removes it when the effect expires',()=>{
 expect(validateDnd5eActiveEffectsStrict([effect]).ok).toBe(true)
 const restored=normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([effect])))
 expect(restored[0].modifiers?.sightRangeLimitFeet).toBe(5)
 const projected=JSON.parse(JSON.stringify(applyDnd5eEffectiveVisionProfile(viewer,compileDnd5eEffectiveVisionProfile({token:viewer}))))
 expect(compileDnd5eEffectiveVisionProfile({token:projected}).sightRangeLimitFeet).toBe(5)
 expect(compileDnd5eEffectiveVisionProfile({token:{...projected,dnd5eCombatState:{activeEffects:[]}}}).sightRangeLimitFeet).toBeUndefined()
 expect(compileDnd5eEffectiveVisionProfile({token:{...viewer,dnd5eCombatState:{activeEffects:[{...effect,suspendedBy:['antimagic']}]}}}).sightRangeLimitFeet).toBeUndefined()
 for(const value of [-1,0,NaN,10001])expect(validateDnd5eActiveEffectsStrict([{...effect,modifiers:{sightRangeLimitFeet:value}}]).ok).toBe(false)
})
it('clips map visibility despite bright light, disabled dynamic vision and oversized render range',()=>{
 expect(mapGeometryCanSeePoint({map,viewer,point:{x:150,y:100}})).toBe(true)
 expect(mapGeometryCanSeePoint({map,viewer,point:{x:200,y:100}})).toBe(false)
 const polygon=mapGeometryVisibilityPolygon({map,viewer,rangeOverrideFeet:500})
 expect(polygon.length).toBeGreaterThan(2)
 expect(polygon.every(p=>Math.hypot(p.x-viewer.x,p.y-viewer.y)<=50.001)).toBe(true)
 expect(mapGeometryCanSeePoint({map,viewer:{...viewer,blindsightRangeFeet:30},point:{x:200,y:100}})).toBe(true)
})
it.each([false,true])('filters server player tokens with dynamic vision %s',enabled=>{
 const far:Token={id:'far',type:'enemy',label:'Far',x:300,y:100,size:1,color:'',emoji:''}
 const result=projectMapsForPlayer({maps:[{...map,tokens:[viewer,far]}]}, {maps:[{mapId:'scene',walls:[],doors:[],windows:[],obstacles:[],lights:[],vision:{enabled,ambientLight:'bright',defaultRangeFeet:120,sharePartyVision:false}}]},'owner',{characters:[{id:'owner',roomMemberId:'member'}]},{memberId:'member'}) as {maps:{tokens:Token[]}[]}
 expect(result.maps[0].tokens.map(token=>token.id)).not.toContain('far')
})
it('caps Host visual targeting without adding blinded and keeps observers unaffected',()=>{
 const make=(id:string)=>createDnd5eCombatant({id,name:id,controller:'dm',initiative:10,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:100,maxHp:100,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
 const a=make('viewer'),b=make('target');a.classState.activeEffects=[effect];a.darkvisionRangeFeet=120
 const state=startDnd5eHeadlessCombat('cap',[a,b])
 for(const distance of [5,10]){state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey(a.id,b.id)]:distance};expect(dnd5eCombatantCanSee(state,a.id,b.id)).toBe(distance===5);expect(dnd5eCombatantCanSee(state,b.id,a.id)).toBe(true)}
 expect(state.combatants.viewer.conditions).not.toContain('blinded')
})
