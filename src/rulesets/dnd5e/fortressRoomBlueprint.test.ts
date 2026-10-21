import {expect,it} from 'vitest'
import {buildDnd5eFortressRoomBlueprint,type Dnd5eFortressRoomBlueprint} from './fortressRoomBlueprint'
import {placeDnd5eStructureSections} from './structureGeometry'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {placeDnd5eMightyFortressKeep} from './mightyFortressStructure'
import {dnd5eFortressRoomDestinations} from './fortressRoomDestinations'
import {placeDnd5eMightyFortressServants} from './mightyFortressServants'
import {prepareDnd5eFortressServantMove} from './fortressServantMove'
import {prepareDnd5eFortressServantDoor} from './fortressServantDoor'

const room:Dnd5eFortressRoomBlueprint={id:'bedroom',level:2,x:36,y:36,widthFeet:12,depthFeet:16,entrance:{side:'south',offsetFeet:3,kind:'door'}}
it('walks through an off-grid five-foot doorway without bypassing a closed door or the movement budget',()=>{
 const map={id:'map',name:'Keep',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
  tokens:[{id:'caster',type:'player' as const,characterId:'owner',label:'Caster',x:375,y:375,size:1,color:'',emoji:'',hp:20}]}
 const geometry=placeDnd5eMightyFortressKeep({map,geometry:createEmptyMapGeometry('map',1),structureId:'keep',origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,createdAt:1,
  towerThicknessInches:6,floorThicknessInches:6,lifetime:{casterId:'owner',worldMinute:100},roomBlueprint:[{id:'study',level:1,x:73,y:36,widthFeet:10,depthFeet:10,entrance:{side:'west',offsetFeet:2,kind:'door'}}]}).geometry
 const staffed=placeDnd5eMightyFortressServants({map,geometry,structureId:'keep'})
 const worker=staffed.map.tokens.find(token=>token.id==='keep:servant:1')!
 worker.x=782.5;worker.y=505;worker.elevationFeet=0
 const input={map:staffed.map,geometry:staffed.geometry,commanderTokenId:'caster',servantTokenId:worker.id,worldMinute:100,
  expectedPosition:{x:worker.x,y:worker.y,elevationFeet:0},destination:{x:880,y:510,elevationFeet:0}}
 expect(prepareDnd5eFortressServantMove(input).ok).toBe(false)
 const opened=prepareDnd5eFortressServantDoor({...input,doorId:'keep:custom-room-study-west-entrance.0.0',doorOperation:'open'})
 if(!opened.ok)throw Error(opened.reason)
 const moved=prepareDnd5eFortressServantMove({...input,geometry:opened.geometry})
 if(!moved.ok)throw Error(moved.reason)
 expect(moved.map.tokens.find(token=>token.id===worker.id)).toMatchObject(input.destination)
 expect(moved.path.movementCostFeet).toBeLessThanOrEqual(15)
 expect(moved.path.points.length).toBeGreaterThan(2)
 expect(prepareDnd5eFortressServantMove({...input,geometry:opened.geometry,destination:{x:1100,y:510,elevationFeet:0}}).ok).toBe(false)
 expect(worker).toMatchObject(input.expectedPosition)
})
it('walks through an off-grid arch without a door entity and still obeys the movement budget',()=>{
 const map={id:'map',name:'Keep',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
  tokens:[{id:'caster',type:'player' as const,characterId:'owner',label:'Caster',x:375,y:375,size:1,color:'',emoji:'',hp:20}]}
 const geometry=placeDnd5eMightyFortressKeep({map,geometry:createEmptyMapGeometry('map',1),structureId:'keep',origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,createdAt:1,
  towerThicknessInches:6,floorThicknessInches:6,lifetime:{casterId:'owner',worldMinute:100},roomBlueprint:[{id:'study',level:1,x:73,y:36,widthFeet:10,depthFeet:10,entrance:{side:'west',offsetFeet:2,kind:'arch'}}]}).geometry
 const staffed=placeDnd5eMightyFortressServants({map,geometry,structureId:'keep'})
 const worker=staffed.map.tokens.find(token=>token.id==='keep:servant:1')!
 worker.x=782.5;worker.y=505;worker.elevationFeet=0
 const input={map:staffed.map,geometry:staffed.geometry,commanderTokenId:'caster',servantTokenId:worker.id,worldMinute:100,
  expectedPosition:{x:worker.x,y:worker.y,elevationFeet:0},destination:{x:880,y:510,elevationFeet:0}}
 const opened={geometry:staffed.geometry}
 expect(opened.geometry.doors.some(door=>door.id.includes('custom-room-study'))).toBe(false)
 const moved=prepareDnd5eFortressServantMove({...input,geometry:opened.geometry})
 if(!moved.ok)throw Error(moved.reason)
 expect(moved.map.tokens.find(token=>token.id===worker.id)).toMatchObject(input.destination)
 expect(moved.path.movementCostFeet).toBeLessThanOrEqual(15)
 expect(moved.path.points.length).toBeGreaterThan(2)
 expect(prepareDnd5eFortressServantMove({...input,geometry:opened.geometry,destination:{x:1100,y:510,elevationFeet:0}}).ok).toBe(false)
 expect(worker).toMatchObject(input.expectedPosition)
})
it.each(['north','south','west','east']as const)('derives rotated custom room destinations through %s entrances after reload',side=>{
 const map={id:'map',name:'Keep',width:4000,height:4000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
 const geometry=placeDnd5eMightyFortressKeep({map,geometry:createEmptyMapGeometry('map',1),structureId:'keep',origin:{x:2000,y:200},rotationDegrees:45,elevationFeet:5,createdAt:1,
  towerThicknessInches:6,floorThicknessInches:6,lifetime:{casterId:'caster',worldMinute:0},roomBlueprint:[{...room,entrance:{side,offsetFeet:3,kind:'arch'}}]}).geometry
 const destinations=dnd5eFortressRoomDestinations(JSON.parse(JSON.stringify(geometry)),'keep')
 expect(destinations).toHaveLength(1)
 const transform=(x:number,y:number)=>({x:2000+(x-y)*Math.SQRT1_2*10,y:200+(x+y)*Math.SQRT1_2*10})
 const center=transform(42,44)
 expect(destinations[0].inside.x).toBeCloseTo(center.x,5)
 expect(destinations[0].inside.y).toBeCloseTo(center.y,5)
 expect(destinations[0].inside.elevationFeet).toBe(15.5)
 const outside=side==='north'?transform(41.5,31.25):side==='south'?transform(41.5,56.75):side==='west'?transform(31.25,41.5):transform(52.75,41.5)
 expect(destinations[0].outside.x).toBeCloseTo(outside.x,5)
 expect(destinations[0].outside.y).toBeCloseTo(outside.y,5)
 expect(dnd5eFortressRoomDestinations(geometry,'foreign')).toEqual([])
})
it('integrates room ownership in the keep and rejects blocked stairs and floor openings without mutating the input',()=>{
 const map={id:'map',name:'Keep',width:3000,height:3000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
 const input={map,geometry:createEmptyMapGeometry('map',1),structureId:'keep',origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,createdAt:1,
  towerThicknessInches:6,floorThicknessInches:6,lifetime:{casterId:'caster',worldMinute:0},roomBlueprint:[room]}
 const built=placeDnd5eMightyFortressKeep(input)
 const door=built.geometry.doors.find(door=>door.id.includes('custom-room-bedroom'))!
 expect(door).toBeDefined()
 expect(built.geometry.structureLifetimes![0].entityIds).toContain(door.id)
 expect(()=>placeDnd5eMightyFortressKeep({...input,eastRoomsPerLevel:[1,0,0]})).toThrow('fortress-room-layout-conflict')
 expect(()=>placeDnd5eMightyFortressKeep({...input,stairOpenings:[{level:2,column:0,row:0}]})).toThrow('fortress-room-opening-conflict')
 expect(()=>placeDnd5eMightyFortressKeep({...input,stairs:[{id:'stairs',from:{x:40,y:40,elevationFeet:0},to:{x:60,y:40,elevationFeet:10.5},widthFeet:5,thicknessInches:6}]})).toThrow('fortress-room-stair-conflict')
 expect(input.geometry.obstacles).toEqual([])
})
it('generates variable-sized rooms with attackable sections and real doors or arches at rotated map coordinates',()=>{
 const input=[room,{...room,id:'study',x:60,widthFeet:8,entrance:{side:'west' as const,offsetFeet:4,kind:'arch' as const}}]
 const before=JSON.stringify(input)
 const blueprint=buildDnd5eFortressRoomBlueprint(input,[0,10.5,21])
 expect(blueprint.sections.every(section=>section.bottomFeet===10.5&&section.maxHp===180&&section.combatProfile.armorClass===15)).toBe(true)
 const map={id:'map',name:'Rooms',width:3000,height:3000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
 const geometry=placeDnd5eStructureSections({map,geometry:createEmptyMapGeometry('map',1),structureId:'keep',origin:{x:1500,y:500},rotationDegrees:90,elevationFeet:5,createdAt:1,...blueprint,surfaceMaterial:'stone'})
 expect(geometry.doors).toHaveLength(1)
 expect(geometry.doors[0].baseHeightFeet).toBe(15.5)
 expect(geometry.obstacles.length).toBe(blueprint.sections.length-2)
 expect(JSON.stringify(input)).toBe(before)
})
it('rejects undersized, overlapping, out-of-bounds, duplicate and malformed rooms before placement',()=>{
 for(const bad of [{...room,widthFeet:5.9},{...room,x:30},{...room,level:4},{...room,x:NaN},{...room,entrance:{...room.entrance,offsetFeet:0}}]){
  expect(()=>buildDnd5eFortressRoomBlueprint([bad as Dnd5eFortressRoomBlueprint],[0,10.5,21])).toThrow()
 }
 expect(()=>buildDnd5eFortressRoomBlueprint([room,{...room,id:'other',x:40}],[0,10.5,21])).toThrow('fortress-room-overlap')
 expect(()=>buildDnd5eFortressRoomBlueprint([room,room],[0,10.5,21])).toThrow('fortress-room-blueprint-invalid')
 expect(()=>buildDnd5eFortressRoomBlueprint([room,{...room,id:'upper',level:3}],[0,10.5,21])).not.toThrow()
})
it('connects adjacent custom rooms through paired arches while retaining an unmatched solid wall',()=>{
 const map={id:'map',name:'Keep',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
  tokens:[{id:'caster',type:'player' as const,characterId:'owner',label:'Caster',x:375,y:375,size:1,color:'',emoji:'',hp:20}]}
 const rooms:Dnd5eFortressRoomBlueprint[]=[
  {id:'west-room',level:1,x:63,y:36,widthFeet:10,depthFeet:10,entrance:{side:'east',offsetFeet:2,kind:'arch'}},
  {id:'east-room',level:1,x:73,y:36,widthFeet:10,depthFeet:10,entrance:{side:'west',offsetFeet:2,kind:'arch'}},
 ]
 const build=(roomBlueprint:Dnd5eFortressRoomBlueprint[])=>placeDnd5eMightyFortressKeep({map,geometry:createEmptyMapGeometry('map',1),structureId:'keep',origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,createdAt:1,
  towerThicknessInches:6,floorThicknessInches:6,lifetime:{casterId:'owner',worldMinute:100},roomBlueprint}).geometry
 const geometry=build(rooms),staffed=placeDnd5eMightyFortressServants({map,geometry,structureId:'keep'})
 const worker=staffed.map.tokens.find(token=>token.id==='keep:servant:1')!
 worker.x=880;worker.y=510;worker.elevationFeet=0
 const input={map:staffed.map,geometry:staffed.geometry,commanderTokenId:'caster',servantTokenId:worker.id,worldMinute:100,
  expectedPosition:{x:880,y:510,elevationFeet:0},destination:{x:780,y:510,elevationFeet:0}}
 const moved=prepareDnd5eFortressServantMove(input)
 expect(moved.ok,moved.ok?'':moved.reason).toBe(true)
 if(moved.ok)expect(moved.map.tokens.find(token=>token.id===worker.id)).toMatchObject(input.destination)
 const closed=build([rooms[0],{...rooms[1],entrance:{side:'north',offsetFeet:2,kind:'arch'}}])
 const closedStaffed=placeDnd5eMightyFortressServants({map,geometry:closed,structureId:'keep'})
 expect(prepareDnd5eFortressServantMove({...input,geometry:closedStaffed.geometry}).ok).toBe(false)
})
