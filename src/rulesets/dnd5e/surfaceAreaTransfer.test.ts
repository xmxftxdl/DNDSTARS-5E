import {reconcileDnd5eSummonedCreatures} from './summonedCreatures'
import {removeDnd5eMapTokenPreservingPossessions} from './companionCarriedObjects'
import {expect,it} from 'vitest'
import {transferDroppedObjectSurfaceAreas,transferNewlyDroppedSurfaceAreas} from './surfaceAreaTransfer'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {mapGeometryWithObjectSurfaces} from './mapObjectSurfaceGeometry'
import {selectHorizontalMaterialSurface} from './horizontalMaterialSurface'
function fixture(){
 const token:any={id:'old-object',type:'obstacle',label:'Stone',x:75,y:75,size:1,elevationFeet:0,dnd5eObjectState:{schemaVersion:1,surfaceProfile:{material:'stone',widthFeet:5,lengthFeet:5,heightFeet:1,rotationDegrees:0}}}
 const source:any={id:'old-map',name:'Old',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,tokens:[token]}
 const geometry=mapGeometryWithObjectSurfaces(source,createEmptyMapGeometry(source.id,1))
 const horizontalSurface=selectHorizontalMaterialSurface({geometry,corners:geometry.obstacles[0].points,elevationFeet:1,pixelsPerFoot:10,materials:['stone']})!
 const area:any={id:'mark',pluginId:'test',featureId:'cast',sourceCharacterId:'wizard',sourceTokenId:'original-caster',createdWorldMinute:100,expiresAtWorldMinute:160,cells:[{col:1,row:1}],visual:{preset:'surface-color',horizontalSurface},sourceLimit:{groupId:'mold-earth-lasting',maximum:2},vertical:{mode:'volume',baseElevationFeet:1,heightFeet:0.25}}
 source.tokens=[];source.dnd5ePluginAreas=[area]
 const destination:any={...source,id:'new-map',tokens:[{...token,id:'dropped:new',x:225,y:225,dnd5eObjectState:{...token.dnd5eObjectState,surfaceProfile:{...token.dnd5eObjectState.surfaceProfile,surfaceId:token.id}}}],dnd5ePluginAreas:[]}
 return [source,destination]
}
it('moves one record to another map preserving ownership, absolute expiry and quota',()=>{
 const maps=fixture(),before=JSON.stringify(maps),moved=transferDroppedObjectSurfaceAreas(maps,'new-map','dropped:new',120)
 expect(moved[0].dnd5ePluginAreas).toEqual([])
 expect(moved[1].dnd5ePluginAreas).toHaveLength(1)
 expect(moved[1].dnd5ePluginAreas![0]).toMatchObject({sourceCharacterId:'wizard',sourceTokenId:'original-caster',createdWorldMinute:100,expiresAtWorldMinute:160,sourceLimit:{groupId:'mold-earth-lasting',maximum:2},cells:[{col:4,row:4}]})
 expect(transferDroppedObjectSurfaceAreas(moved,'new-map','dropped:new',120)).toEqual(moved)
 expect(JSON.stringify(maps)).toBe(before)
})
it('does not resurrect expired or dismissed records',()=>{
 const maps=fixture(),expired=transferDroppedObjectSurfaceAreas(maps,'new-map','dropped:new',160)
 expect(expired.flatMap(map=>map.dnd5ePluginAreas??[])).toEqual([])
 maps[0].dnd5ePluginAreas=[]
 expect(transferDroppedObjectSurfaceAreas(maps,'new-map','dropped:new',120).flatMap(map=>map.dnd5ePluginAreas??[])).toEqual([])
})
it('rejects ambiguous physical identity and area IDs before mutating snapshots',()=>{
 const maps=fixture(),before=JSON.stringify(maps)
 maps[0].tokens=[{...maps[1].tokens[0],id:'duplicate'}]
 expect(()=>transferDroppedObjectSurfaceAreas(maps,'new-map','dropped:new',120)).toThrow('identity-conflict')
 const clean=JSON.parse(before);clean[1].dnd5ePluginAreas=[{...clean[0].dnd5ePluginAreas[0],visual:undefined}]
 expect(()=>transferDroppedObjectSurfaceAreas(clean,'new-map','dropped:new',120)).toThrow('area-conflict')
})

it('moves a surface effect when an expired summon drops possessions on another map',async()=>{
 const maps=fixture(),physical=maps[1].tokens[0]
 maps[1].tokens=[{id:'caster',type:'enemy',hp:10,x:25,y:25,size:1},
  {id:'summon',type:'enemy',hp:10,x:225,y:225,size:1,elevationFeet:0,dnd5eSummon:{schemaVersion:1,pluginId:'test',featureId:'summon',sourceCharacterId:'caster',sourceTokenId:'caster',createdRound:1,expiresAfterRound:10,side:'player'},
   dnd5eCarriedObjects:[{id:'held',pickupReceipt:'receipt',label:'Marked object',objectState:{...physical.dnd5eObjectState,wornOrCarried:true,inventoryItem:{templateId:'srd-5.1:item:holy-water-flask',quantity:1,receiptId:'original'}}}]}]
 const before=JSON.stringify(maps)
 const ended=reconcileDnd5eSummonedCreatures({map:maps[1],characters:[],round:11,worldMinute:120})
 expect(ended.removedTokenIds).toContain('summon')
 expect(ended.map.tokens.some(token=>token.id==='carried:held')).toBe(true)
 const moved=transferNewlyDroppedSurfaceAreas(maps,[maps[0],ended.map],120)
 expect(moved[0].dnd5ePluginAreas).toEqual([])
 expect(moved[1].dnd5ePluginAreas).toHaveLength(1)
 expect(moved[1].dnd5ePluginAreas![0]).toMatchObject({id:'mark',expiresAtWorldMinute:160,sourceCharacterId:'wizard',cells:[{col:4,row:4}]})
 expect(transferNewlyDroppedSurfaceAreas(moved,moved,121)).toEqual(moved)
 expect(JSON.stringify(maps)).toBe(before)
})

it('restores marked possessions on manual bearer removal across maps',async()=>{
 const maps=fixture(),physical=maps[1].tokens[0]
 maps[1].tokens=[{id:'bearer',type:'enemy',x:225,y:225,size:1,elevationFeet:0,
  dnd5eCarriedObjects:[{id:'held',pickupReceipt:'receipt',label:'Marked',objectState:{...physical.dnd5eObjectState,wornOrCarried:true,inventoryItem:{templateId:'srd-5.1:item:holy-water-flask',quantity:1,receiptId:'original'}}}]}]
 const removed=removeDnd5eMapTokenPreservingPossessions(maps[1],'bearer')
 const moved=transferNewlyDroppedSurfaceAreas(maps,[maps[0],removed],120)
 expect(moved[0].dnd5ePluginAreas).toEqual([])
 expect(moved[1].dnd5ePluginAreas).toHaveLength(1)
 expect(moved[1].dnd5ePluginAreas![0].expiresAtWorldMinute).toBe(160)
 expect(moved[1].tokens.map(token=>token.id)).toEqual(['carried:held'])
})

it.each([120,160])('transfers guardian possessions during world expiry without resurrecting an expired mark at %s', async worldMinute=>{
 const {expireDnd5ePluginAreasAtWorldMinute}=await import('./pluginAreas')
 const maps=fixture(),physical=maps[1].tokens[0]
 const originalTree={id:'tree',type:'obstacle',label:'Tree',x:225,y:225,size:1,dnd5eObjectState:{schemaVersion:1,vegetation:'living'}}
 maps[1].tokens=[{...originalTree,type:'enemy',hp:20,maxHp:30,
  dnd5eGroveGuardian:{boundaryAreaId:'grove',sourceTokenId:'druid',castId:'grove-cast',originalTree},
  dnd5eCarriedObjects:[{id:'held',pickupReceipt:'receipt',label:'Marked stone',objectState:{...physical.dnd5eObjectState,wornOrCarried:true,
   inventoryItem:{templateId:'srd-5.1:item:holy-water-flask',quantity:1,receiptId:'original'}}}]}]
 maps[1].dnd5ePluginAreas=[{id:'grove',sourceTokenId:'druid',effectGroup:{castId:'grove-cast',effectId:'guardians'},expiresAtWorldMinute:120}]
 const before=JSON.stringify(maps)
 const expired=maps.map(map=>expireDnd5ePluginAreasAtWorldMinute(map,worldMinute))
 const result=transferNewlyDroppedSurfaceAreas(maps,expired,worldMinute)
 expect(result[0].dnd5ePluginAreas).toEqual([])
 expect(result[1].tokens.find(token=>token.id==='tree')).toMatchObject({type:'obstacle',dnd5eGroveRooting:'pending'})
 expect(result[1].tokens.filter(token=>token.id==='carried:held')).toHaveLength(1)
 expect(result[1].dnd5ePluginAreas).toHaveLength(worldMinute===120?1:0)
 if(worldMinute===120)expect(result[1].dnd5ePluginAreas![0]).toMatchObject({id:'mark',expiresAtWorldMinute:160,sourceCharacterId:'wizard',cells:[{col:4,row:4}]})
 expect(transferNewlyDroppedSurfaceAreas(result,result,worldMinute)).toEqual(result)
 expect(JSON.stringify(maps)).toBe(before)
})

it('ends room concentration by dropping and transferring the carried marked surface',async()=>{
 const {planRoomConcentrationEnd}=await import('../../store/roomCommands')
 const maps=fixture(),physical=maps[1].tokens[0]
 maps[1].tokens=[{id:'caster',type:'player',characterId:'owner',x:25,y:25,size:1},
  {id:'bearer',type:'enemy',hp:20,x:225,y:225,size:1,elevationFeet:0,
   dnd5eSummon:{schemaVersion:1,pluginId:'test',featureId:'summon',sourceCharacterId:'owner',sourceTokenId:'caster',createdRound:1,expiresAfterRound:600,concentrationId:'old-spell',side:'player'},
   dnd5eCarriedObjects:[{id:'held',pickupReceipt:'receipt',label:'Marked',objectState:{...physical.dnd5eObjectState,wornOrCarried:true,inventoryItem:{templateId:'srd-5.1:item:holy-water-flask',quantity:1,receiptId:'original'}}}]}]
 const characters:any[]=[{id:'owner',concentrating:true,dnd5eCombatState:{concentrationSpellId:'old-spell'}}]
 const input={maps,characters,mapId:'new-map',tokenId:'caster',characterId:'owner',expectedConcentrationId:'old-spell',worldMinute:120}
 const before=JSON.stringify(input),result=planRoomConcentrationEnd(input)
 expect(result.status).toBe('ended')
 expect(result.maps[0].dnd5ePluginAreas).toEqual([])
 expect(result.maps[1].tokens.map(token=>token.id)).toEqual(['caster','carried:held'])
 expect(result.maps[1].dnd5ePluginAreas).toHaveLength(1)
 expect(result.maps[1].dnd5ePluginAreas![0]).toMatchObject({id:'mark',expiresAtWorldMinute:160,cells:[{col:4,row:4}]})
 expect(JSON.stringify(input)).toBe(before)
 expect(planRoomConcentrationEnd({...input,maps:result.maps,characters:result.characters}).status).toBe('missing')
 expect(planRoomConcentrationEnd({...input,expectedConcentrationId:'stale'}).maps).toEqual(maps)
 expect(planRoomConcentrationEnd({...input,worldMinute:160}).maps.flatMap(map=>map.dnd5ePluginAreas??[])).toEqual([])
})
