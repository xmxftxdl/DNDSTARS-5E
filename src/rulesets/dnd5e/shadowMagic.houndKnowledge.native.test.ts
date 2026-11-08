import {expect,it} from 'vitest'
import {nativeSummonedHound} from './shadowMagic.summonedHound.native.fixture'
import {resolveDnd5eHeadlessAction,dnd5eCombatantCanSee,dnd5eCombatantKnowsSourceLinkedLocation} from './headlessCombatEngine'
import {createEmptyMapGeometry,setMapGeometryRuntime} from '../../lib/mapGeometry'
import {refreshDnd5eMapSpatialRelations} from './mapBridge'

it('actual new Hide removes this Hound knowledge; next actual own turn reacquires it without revealing to caster',async()=>{
 const f=await nativeSummonedHound();try{
  let state=f.snapshot.state;state.combatants['foe-token'].classState.hiddenCheckTotal=20
  function use(action:Parameters<typeof resolveDnd5eHeadlessAction>[1]){const r=resolveDnd5eHeadlessAction(state,action);expect(r.ok,JSON.stringify(r)).toBe(true);if(!r.ok)throw Error(r.reason);state=r.state;return r}
  use({type:'begin-turn',actorId:f.houndId})
  expect(dnd5eCombatantCanSee(state,f.houndId,'foe-token')).toBe(true)
  use({type:'end-turn',actorId:f.houndId});use({type:'end-turn',actorId:'soul-token'})
  const geometry=createEmptyMapGeometry(f.map.id);for(const x of[50,100])geometry.walls.push({id:'cover-'+x,kind:'wall',label:'Actual hiding cover',points:[{x,y:0},{x,y:500}],baseHeightFeet:0,heightFeet:20,blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1})
  setMapGeometryRuntime([geometry]);state.companionScene!.geometry=geometry;refreshDnd5eMapSpatialRelations(state,f.map)
  const hidden=use({type:'hide',actorId:'foe-token',d20:20})
  expect(hidden.events.some(e=>e.type==='hide-resolved'&&e.actorId==='foe-token')).toBe(true)
  expect(dnd5eCombatantKnowsSourceLinkedLocation(state,f.houndId,'foe-token')).toBe(false)
  expect(dnd5eCombatantCanSee(state,f.houndId,'foe-token')).toBe(false)
  use({type:'end-turn',actorId:'foe-token'})
  expect(dnd5eCombatantKnowsSourceLinkedLocation(state,f.houndId,'foe-token')).toBe(true)
  expect(dnd5eCombatantCanSee(state,f.houndId,'foe-token')).toBe(false)
  setMapGeometryRuntime([]);state.companionScene!.geometry=null;refreshDnd5eMapSpatialRelations(state,f.map)
  expect(dnd5eCombatantCanSee(state,f.houndId,'foe-token')).toBe(true)
  expect(dnd5eCombatantKnowsSourceLinkedLocation(state,'soul-token','foe-token')).toBe(false)
 }finally{setMapGeometryRuntime([]);f.dispose()}
})
