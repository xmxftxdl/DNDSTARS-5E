import {expect,it} from 'vitest'
import {createEmptyMapGeometry,normalizeMapGeometry,type SharedMapGeometryState} from '../../lib/mapGeometry'
import {placeDnd5eMightyFortressKeep} from './mightyFortressStructure'
import {dnd5eStructureObjectOutsideBoundary,prepareDnd5eStructureObjectBoundaryCleanup} from './structureObjectBoundary'
import {normalizeCharacter} from '../../store/characters'
import {applyDnd5eInventoryGrantBundle,normalizeDnd5eInventory} from './items'
import type {BattleMap} from '../../store/maps'
import {migrateMapsState} from '../../store/maps'
import {expireDnd5eStructureMapObjects} from './structureObjectExpiry'
import {prepareDnd5eStructureExpiry} from './structureExpiry'
import {placeDnd5eMightyFortressServants} from './mightyFortressServants'
import {resolveDnd5eFortressServantControl} from './fortressServantControl'
import {prepareDnd5eFortressServantCommand} from './mightyFortressCommands'
import {removeDnd5eMapTokenPreservingPossessions} from './companionCarriedObjects'

it('removes a defeated actual fortress servant, drops its possessions once, and rejects further orders',()=>{
 const map:BattleMap={id:'site',name:'Site',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
  tokens:[{id:'caster',type:'player',label:'Caster',x:375,y:375,size:1,color:'',emoji:'',hp:10}]}
 const initial=placeDnd5eMightyFortressKeep({map,geometry:createEmptyMapGeometry(map.id,1),structureId:'keep',origin:{x:100,y:100},rotationDegrees:0,
  elevationFeet:0,createdAt:1,towerThicknessInches:12,floorThicknessInches:6,lifetime:{casterId:'caster',worldMinute:100}}).geometry
 const placed=placeDnd5eMightyFortressServants({map,geometry:initial,structureId:'keep'})
 const servantTokenId=placed.tokenIds[0]
 const control={...placed,servantTokenId,commanderTokenId:'caster',worldMinute:100}
 expect(resolveDnd5eFortressServantControl(control)).toBeDefined()
 const binding={schemaVersion:1 as const,mapId:'site',structureId:'keep'}
 const damaged={...placed.map,tokens:placed.map.tokens.map(token=>token.id===servantTokenId?{...token,hp:0,
  dnd5eCarriedObjects:['ordinary','conjured'].map(id=>({id,pickupReceipt:`pickup:${id}`,label:id,objectState:{schemaVersion:1 as const,
   ...(id==='conjured'?{structureBinding:binding}:{}),wornOrCarried:true,
   inventoryItem:{templateId:'srd-5.1:item:potion-of-healing',quantity:1,receiptId:id}}}))}:token)}
 const manuallyRemoved=removeDnd5eMapTokenPreservingPossessions(damaged,servantTokenId)
 expect(manuallyRemoved.tokens.filter(token=>token.id.startsWith('carried:'))).toHaveLength(2)
 expect(removeDnd5eMapTokenPreservingPossessions(manuallyRemoved,servantTokenId)).toBe(manuallyRemoved)
 const collision={...damaged,tokens:[...damaged.tokens,manuallyRemoved.tokens.find(token=>token.id==='carried:ordinary')!]}
 expect(()=>removeDnd5eMapTokenPreservingPossessions(collision,servantTokenId)).toThrow('carried-object-drop-conflict')
 expect(collision.tokens.some(token=>token.id===servantTokenId)).toBe(true)
 expect(resolveDnd5eFortressServantControl({...control,map:damaged})).toBeUndefined()
 const geometry:SharedMapGeometryState={schemaVersion:3,updatedAt:1,maps:[placed.geometry]}
 const result=prepareDnd5eStructureObjectBoundaryCleanup({maps:[damaged],characters:[],geometry})
 expect(result.maps[0].tokens.some(token=>token.id===servantTokenId)).toBe(false)
 expect(result.maps[0].tokens.filter(token=>placed.tokenIds.includes(token.id))).toHaveLength(99)
 expect(result.maps[0].tokens.filter(token=>token.id.startsWith('carried:'))).toHaveLength(2)
 expect(prepareDnd5eStructureObjectBoundaryCleanup({...result,geometry}).changed).toBe(false)
 expect(damaged.tokens.find(token=>token.id===servantTokenId)?.dnd5eCarriedObjects).toHaveLength(2)
 expect(prepareDnd5eFortressServantCommand({map:result.maps[0],geometry:placed.geometry,structureId:'keep',actorTokenId:'caster',
  worldMinute:100,servantNumbers:[1],instruction:'carry'})).toEqual({ok:false,reason:'fortress-command-servant-unavailable'})
 expect(()=>placeDnd5eMightyFortressServants({map:result.maps[0],geometry:placed.geometry,structureId:'keep'})).toThrow('fortress-servants-roster-invalid')
})

it('releases a disappearing carrier possession at ground level after its supporting fortress floor sinks',()=>{
 const binding={schemaVersion:1 as const,mapId:'site',structureId:'keep'}
 const map:BattleMap={id:'site',name:'Site',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{
  id:'carrier',type:'obstacle',label:'Carrier',x:600,y:600,elevationFeet:10.5,size:1,color:'',emoji:'',
  dnd5eObjectState:{schemaVersion:1,structureBinding:binding},dnd5eCarriedObjects:[{id:'ordinary',pickupReceipt:'pickup:ordinary',label:'Potion',
   objectState:{schemaVersion:1,wornOrCarried:true,inventoryItem:{templateId:'srd-5.1:item:potion-of-healing',quantity:1,receiptId:'ordinary'}}}],
 }]}
 const geometry=placeDnd5eMightyFortressKeep({map,geometry:createEmptyMapGeometry(map.id,1),structureId:'keep',origin:{x:100,y:100},rotationDegrees:0,
  elevationFeet:0,createdAt:1,towerThicknessInches:12,floorThicknessInches:6,lifetime:{casterId:'caster',worldMinute:100}}).geometry
 const expiry=prepareDnd5eStructureExpiry(map,geometry,10180)
 const result=expireDnd5eStructureMapObjects(expiry.map,[binding])
 expect(result.tokens).toHaveLength(1)
 expect(result.tokens[0]).toMatchObject({id:'carried:ordinary',x:600,y:600,elevationFeet:0})
 expect(map.tokens[0].elevationFeet).toBe(10.5)
 const flying={...map,tokens:map.tokens.map(token=>({...token,elevationFeet:40}))}
 expect(expireDnd5eStructureMapObjects(prepareDnd5eStructureExpiry(flying,geometry,10180).map,[binding]).tokens[0].elevationFeet).toBe(40)
})

it('drops ordinary possessions when a bound carrier disappears and consumes only matching conjured possessions',()=>{
 const binding={schemaVersion:1 as const,mapId:'site',structureId:'keep'}
 const held=(id:string,bound=false)=>({id,pickupReceipt:`pickup:${id}`,label:id,objectState:{schemaVersion:1 as const,
  ...(bound?{structureBinding:binding}:{}),wornOrCarried:true,inventoryItem:{templateId:'srd-5.1:item:potion-of-healing',quantity:1,receiptId:id}}})
 const map:BattleMap={id:'site',name:'Site',width:1000,height:1000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{
  id:'bound-carrier',type:'obstacle',label:'Carrier',x:400,y:350,elevationFeet:0,size:1,color:'',emoji:'',
  dnd5eObjectState:{schemaVersion:1,structureBinding:binding},dnd5eCarriedObjects:[held('ordinary'),held('conjured',true)],
 }]}
 const before=structuredClone(map)
 const restored=migrateMapsState(JSON.parse(JSON.stringify({maps:[map]}))).maps[0]
 expect(restored.tokens[0].dnd5eCarriedObjects).toHaveLength(2)
 const expired=expireDnd5eStructureMapObjects(restored,[binding])
 expect(expired.tokens).toHaveLength(1)
 expect(expired.tokens[0]).toMatchObject({id:'carried:ordinary',x:400,y:350,elevationFeet:0,
  dnd5eObjectState:{wornOrCarried:false,inventoryItem:{templateId:'srd-5.1:item:potion-of-healing',quantity:1}}})
 expect(map).toEqual(before)
 expect(expireDnd5eStructureMapObjects(expired,[binding])).toBe(expired)
 const geometry:SharedMapGeometryState={schemaVersion:3,updatedAt:1,maps:[createEmptyMapGeometry('site',1)]}
 const result=prepareDnd5eStructureObjectBoundaryCleanup({maps:[map],characters:[],geometry})
 expect(result.maps[0].tokens).toEqual(expired.tokens)
 expect(prepareDnd5eStructureObjectBoundaryCleanup({maps:result.maps,characters:[],geometry}).changed).toBe(false)
 expect(expireDnd5eStructureMapObjects(map,[{...binding,structureId:'other'}])).toBe(map)
})

it('preserves the rotated cast envelope after every wall is destroyed and rejects cross-map or vertical exits',()=>{
 const map:BattleMap={id:'site',name:'Site',width:3000,height:3000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
 const scene=placeDnd5eMightyFortressKeep({map,geometry:createEmptyMapGeometry(map.id,1),structureId:'keep',origin:{x:1500,y:100},rotationDegrees:37,
  elevationFeet:10,createdAt:1,towerThicknessInches:12,floorThicknessInches:6,lifetime:{casterId:'caster',worldMinute:100}}).geometry
 const restored=normalizeMapGeometry(JSON.parse(JSON.stringify({...scene,obstacles:[],doors:[]})))!
 const geometry={schemaVersion:3,maps:[restored],updatedAt:1} as SharedMapGeometryState
 const binding={schemaVersion:1 as const,mapId:map.id,structureId:'keep'}
 const angle=37*Math.PI/180
 const position={x:1500+600*(Math.cos(angle)-Math.sin(angle)),y:100+600*(Math.sin(angle)+Math.cos(angle)),elevationFeet:20}
 const outside=(p=position,mapId=map.id)=>dnd5eStructureObjectOutsideBoundary({binding,geometry,mapId,position:p})
 expect(outside()).toBe(false)
 expect(outside(position,'other')).toBe(true)
 expect(outside({...position,elevationFeet:9})).toBe(true)
 expect(outside({...position,elevationFeet:42})).toBe(true)
 expect(outside({...position,x:0})).toBe(true)
 expect(outside({...position,x:1500,y:100,elevationFeet:10})).toBe(false)
 const invalid={...restored,structureLifetimes:restored.structureLifetimes!.map(record=>({...record,objectBoundary:{...record.objectBoundary!,points:[{x:0,y:0},{x:1,y:1},{x:1,y:0},{x:0,y:1}]}}))}
 expect(normalizeMapGeometry(invalid)).toBeUndefined()
 expect(()=>outside({...position,x:NaN})).toThrow('structure-object-position-invalid')
 const hero=normalizeCharacter({id:'hero',name:'Hero',charClass:'战士',equipment:{},maxHp:20,currentHp:20,dnd5eInventory:{schemaVersion:3,entries:[]}})
 const granted=applyDnd5eInventoryGrantBundle([hero],{characterId:'hero',receiptId:'boundary-items',grants:[
  {templateId:'srd-5.1:item:potion-of-healing',quantity:1,structureBinding:binding},
  {templateId:'srd-5.1:item:potion-of-healing',quantity:2}]})
 expect(granted.ok).toBe(true)
 const actor={id:'hero-token',characterId:'hero',type:'player' as const,label:'Hero',size:1,color:'',emoji:'',...position}
 const insideMap={...map,tokens:[actor]}
 expect(prepareDnd5eStructureObjectBoundaryCleanup({maps:[insideMap],characters:granted.characters,geometry}).changed).toBe(false)
 const destination={...insideMap,id:'destination'}
 const result=prepareDnd5eStructureObjectBoundaryCleanup({maps:[destination],characters:granted.characters,geometry})
 expect(result.changed).toBe(true)
 expect(normalizeDnd5eInventory(result.characters[0]).entries.map(entry=>entry.quantity)).toEqual([2])
 expect(normalizeDnd5eInventory(granted.characters[0]).entries).toHaveLength(2)
 expect(prepareDnd5eStructureObjectBoundaryCleanup({maps:[map],characters:granted.characters,geometry}).changed).toBe(false)
 expect(()=>prepareDnd5eStructureObjectBoundaryCleanup({maps:[insideMap,destination],characters:granted.characters,geometry})).toThrow('structure-object-owner-position-ambiguous')
})
