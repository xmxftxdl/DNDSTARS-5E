import {expect,it} from 'vitest'
import {recordSceneTransitionSightings} from '../../scripts/scene-transition-sightings.mjs'
import {projectCharactersForRoomMember,projectMapsForPlayer,recordServerMovementSightings} from '../../scripts/shared-server-core.mjs'
const fixture=()=>{
 const maps={selectedId:'m',maps:[{id:'m',width:300,height:300,gridSize:50,feetPerCell:5,tokens:[{id:'a',type:'player',characterId:'c',x:25,y:25,size:1,hp:20,label:'Caster'},{id:'t',type:'enemy',label:'Target',x:75,y:25,size:1,hp:20}]}]}
 const characters={characters:[{id:'c',name:'Caster',currentHp:20,maxHp:20,abilities:{wis:10},dnd5eCombatState:{}}]}
 const geometry={maps:[{mapId:'m',walls:[],doors:[],windows:[],obstacles:[],lights:[],vision:{enabled:true,ambientLight:'bright',defaultRangeFeet:300}}]}
 return {beforeMaps:maps,afterMaps:structuredClone(maps),beforeCharacters:characters,afterCharacters:structuredClone(characters),beforeGeometry:geometry,afterGeometry:structuredClone(geometry),clock:{worldMinute:10,worldSecondRemainder:30},observe:recordServerMovementSightings}
}
it.each(['invisible','wall','blind','dark'] as const)('preserves the last visible instant when %s changes without movement or clock advancement',kind=>{
 const input:any=fixture()
 if(kind==='invisible')input.afterMaps.maps[0].tokens[1].dnd5eCombatState={conditions:['invisible']}
 if(kind==='wall')input.afterGeometry.maps[0].walls=[{id:'wall',kind:'wall',points:[{x:50,y:0},{x:50,y:300}],baseHeightFeet:0,heightFeet:30,blocksVision:true}]
 if(kind==='blind')input.afterCharacters.characters[0].dnd5eCombatState={conditions:['blinded']}
 if(kind==='dark')input.afterGeometry.maps[0].vision.ambientLight='darkness'
 const before=JSON.stringify(input)
 const result=recordSceneTransitionSightings(input)
 expect(result.characters.characters[0].dnd5eCombatState.recentCreatureSightings.t).toEqual({mapId:'m',worldMinute:10.5,label:'Target'})
 expect(JSON.stringify(input)).toBe(before)
 // A subsequent unrelated write while still hidden must not renew the timestamp.
 const later=recordSceneTransitionSightings({...input,beforeMaps:result.maps,afterMaps:structuredClone(result.maps),beforeCharacters:result.characters,afterCharacters:structuredClone(result.characters),beforeGeometry:input.afterGeometry,clock:{worldMinute:11,worldSecondRemainder:15}})
 expect(later.characters.characters[0].dnd5eCombatState.recentCreatureSightings.t.worldMinute).toBe(10.5)
 const expired=recordSceneTransitionSightings({...input,beforeMaps:later.maps,afterMaps:structuredClone(later.maps),beforeCharacters:later.characters,afterCharacters:structuredClone(later.characters),beforeGeometry:input.afterGeometry,clock:{worldMinute:11,worldSecondRemainder:31}})
 expect(expired.characters.characters[0].dnd5eCombatState.recentCreatureSightings?.t).toBeUndefined()
})
it('does not invent history for already hidden targets, and records newly visible ones',()=>{
 const input:any=fixture()
 for(const state of [input.beforeMaps,input.afterMaps])state.maps[0].tokens[1].dnd5eCombatState={conditions:['invisible']}
 const hidden=recordSceneTransitionSightings(input)
 expect(hidden.characters.characters[0].dnd5eCombatState.recentCreatureSightings?.t).toBeUndefined()
 delete input.afterMaps.maps[0].tokens[1].dnd5eCombatState
 expect(recordSceneTransitionSightings(input).characters.characters[0].dnd5eCombatState.recentCreatureSightings.t.worldMinute).toBe(10.5)
})
it('retains accepted route sightings and unrelated combat changes',()=>{
 const input:any=fixture()
 input.afterCharacters.characters[0].currentHp=7
 input.afterCharacters.characters[0].dnd5eCombatState={recentCreatureSightings:{glimpse:{mapId:'m',worldMinute:10.25,label:'Glimpse'}}}
 const result=recordSceneTransitionSightings(input)
 expect(result.characters.characters[0].currentHp).toBe(7)
 expect(result.characters.characters[0].dnd5eCombatState.recentCreatureSightings.glimpse.worldMinute).toBe(10.25)
 expect(result.maps.maps[0].tokens[1].dnd5eCombatState.recentCreatureSightings.a.worldMinute).toBe(10.5)
 expect(result.maps.maps[0].tokens[0].dnd5eCombatState).toBeUndefined()
})
it('uses the current scene when a character has duplicate map tokens',()=>{
 const input:any=fixture()
 for(const state of [input.beforeMaps,input.afterMaps])state.maps.push({...structuredClone(state.maps[0]),id:'copy',tokens:state.maps[0].tokens.map((token:any)=>({...token,id:token.id+'-copy'}))})
 const result=recordSceneTransitionSightings(input)
 expect(result.characters.characters[0].dnd5eCombatState.recentCreatureSightings.t).toBeDefined()
 expect(result.characters.characters[0].dnd5eCombatState.recentCreatureSightings['t-copy']).toBeUndefined()
})
it('requires a precise authoritative clock and preserves referential stability on no change',()=>{
 const input:any=fixture();delete input.clock.worldSecondRemainder
 const unchanged=recordSceneTransitionSightings(input)
 expect(unchanged.maps).toBe(input.afterMaps);expect(unchanged.characters).toBe(input.afterCharacters)
 input.clock.worldSecondRemainder=30
 const observed=recordSceneTransitionSightings(input)
 const repeat=recordSceneTransitionSightings({...input,beforeMaps:observed.maps,afterMaps:observed.maps,beforeCharacters:observed.characters,afterCharacters:observed.characters})
 expect(repeat.maps).toBe(observed.maps);expect(repeat.characters).toBe(observed.characters)
})

it('keeps recent sighting identities private to the owning character',()=>{
 const history={hidden:{mapId:'m',worldMinute:10.5,label:'Hidden identity'}}
 const characters={characters:[{id:'c',roomMemberId:'owner',visibleToPlayers:true,dnd5eCombatState:{recentCreatureSightings:history}}]}
 const before=structuredClone(characters)
 const own=projectCharactersForRoomMember(characters,{memberId:'owner'}) as typeof characters
 const other=projectCharactersForRoomMember(characters,{memberId:'other'}) as typeof characters
 expect(own.characters[0].dnd5eCombatState.recentCreatureSightings).toEqual(history)
 expect(other.characters[0].dnd5eCombatState.recentCreatureSightings).toBeUndefined()
 const maps:any=fixture().beforeMaps
 for(const token of maps.maps[0].tokens)token.dnd5eCombatState={recentCreatureSightings:history}
 const projected=projectMapsForPlayer(maps,{maps:[]},'c',characters,{memberId:'owner'})
 for(const token of projected.maps[0].tokens)expect(token.dnd5eCombatState?.recentCreatureSightings).toBeUndefined()
 expect(characters).toEqual(before)
 expect(maps.maps[0].tokens[1].dnd5eCombatState.recentCreatureSightings).toEqual(history)
})
