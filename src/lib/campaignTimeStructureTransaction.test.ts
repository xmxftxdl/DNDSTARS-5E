import {it,expect} from 'vitest'
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {atomicMutateCampaignTimeAndMaps,mutateCampaignTimeState} from '../../scripts/shared-server-core.mjs'
import {createEmptyMapGeometry} from './mapGeometry'
import {placeDnd5eMightyFortressKeep} from '../rulesets/dnd5e/mightyFortressStructure'
import {normalizeCharacter} from '../store/characters'
import {applyDnd5eInventoryGrantBundle} from '../rulesets/dnd5e/items'
import type {BattleMap} from '../store/maps'
import {prepareDnd5eTempleStructure} from '../rulesets/dnd5e/templeStructure'
import {normalizeSharedCampaignTime} from './campaignTime'

it.each(['roof','ground','permanent'] as const)('handles temple expiry through the ordinary clock mutation: %s',async mode=>{
 const stateRoot=await mkdtemp(path.join(os.tmpdir(),'stars-clock-temple-'))
 try{
  const map:BattleMap={id:'temple',name:'Temple',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
   tokens:[{id:'resident',type:'enemy',label:'Resident',color:'',emoji:'',size:1,x:450,y:450,elevationFeet:15,hp:20,maxHp:20}]}
  const built=prepareDnd5eTempleStructure({map:{...map,tokens:[]},geometry:createEmptyMapGeometry(map.id),origin:{x:300,y:300},widthFeet:30,depthFeet:30,heightFeet:15,
   elevationFeet:0,rotationDegrees:0,structureId:'temple:test',casterId:'caster',authorizedCreatureIds:[],worldMinute:100,createdAt:1,
   hostileCreatureTypes:['fiend'],lighting:'bright',sourceSaveDc:18,sourceWisdomModifier:5})
  if(!built.ok)throw Error(built.reason)
  if(mode==='ground')map.tokens[0].elevationFeet=0
  if(mode==='permanent')built.geometry.structureLifetimes![0].expiresWorldMinute=null
  const values={maps:{maps:[map],updatedAt:1},'map-geometry':{schemaVersion:3,maps:[built.geometry],updatedAt:1},characters:{characters:[],updatedAt:1},'campaign-time':normalizeSharedCampaignTime({worldMinute:1539,updatedAt:1})}
  for(const [name,value]of Object.entries(values))await writeFile(path.join(stateRoot,name+'.json'),JSON.stringify(value))
  const host={role:'dm',memberId:'host'}
  const result=await atomicMutateCampaignTimeAndMaps({stateRoot},current=>mutateCampaignTimeState(current,{operation:'advance',minutes:1},10,host,{host}),'host')
  if(mode==='roof'){
   expect(result).toMatchObject({ok:false,changed:false,error:'temple-expiry-settlement-required',pendingTempleExpiry:{mapId:'temple',tokenIds:['resident'],worldMinute:1540}})
   for(const [name,value]of Object.entries(values))expect(JSON.parse(await readFile(path.join(stateRoot,name+'.json'),'utf8'))).toEqual(value)
   const prepared=await atomicMutateCampaignTimeAndMaps({stateRoot},current=>mutateCampaignTimeState(current,{operation:'advance',minutes:1},10,host,{host}),'host',{prepareOnly:true})
   expect(prepared).toMatchObject({ok:true,changed:false,prepared:true})
   expect(prepared.plan?.writes.find(write=>write.name==='campaign-time')?.data).toMatchObject({worldMinute:1540})
   expect(prepared.plan?.writes.find(write=>write.name==='maps')?.data).toMatchObject({maps:[{tokens:[{id:'resident',elevationFeet:15,hp:20}]}]})
   expect(prepared.plan?.writes.find(write=>write.name==='map-geometry')?.data).toMatchObject({maps:[{structureLifetimes:[{id:'temple:test'}]}]})
   expect(prepared.plan?.readRevisions).toHaveProperty('combat',0)
   for(const [name,value]of Object.entries(values))expect(JSON.parse(await readFile(path.join(stateRoot,name+'.json'),'utf8'))).toEqual(value)
  }else{
   expect(result).toMatchObject({ok:true,next:{worldMinute:1540}})
   const savedMap=JSON.parse(await readFile(path.join(stateRoot,'maps.json'),'utf8')).maps[0]
   expect(savedMap.tokens[0]).toMatchObject({elevationFeet:mode==='ground'?0:15,hp:20})
   expect(JSON.parse(await readFile(path.join(stateRoot,'map-geometry.json'),'utf8')).maps[0].structureLifetimes).toHaveLength(mode==='ground'?0:1)
  }
 }finally{await rm(stateRoot,{recursive:true,force:true})}
})
it('expires generated structures and inventory through the ordinary clock mutation, retaining HP and unrelated possessions',async()=>{
 const stateRoot=await mkdtemp(path.join(os.tmpdir(),'stars-clock-fortress-'))
 try{
  const map:BattleMap={id:'keep',name:'Keep',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'resident',type:'enemy',label:'Resident',color:'',emoji:'',size:1,x:600,y:850,elevationFeet:10.5,hp:12,maxHp:20}]}
  const geometry=placeDnd5eMightyFortressKeep({map,geometry:createEmptyMapGeometry(map.id,1),structureId:'keep',origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,createdAt:1,towerThicknessInches:6,floorThicknessInches:6,lifetime:{casterId:'owner',worldMinute:100}}).geometry
  const binding={schemaVersion:1 as const,mapId:'keep',structureId:'keep'}
  const owner=normalizeCharacter({id:'owner',name:'Owner',charClass:'战士',equipment:{},maxHp:20,currentHp:20,dnd5eInventory:{schemaVersion:3,entries:[]}})
  const grant=applyDnd5eInventoryGrantBundle([owner],{characterId:'owner',receiptId:'test',grants:[{templateId:'srd-5.1:item:potion-of-healing',quantity:1,structureBinding:binding},{templateId:'srd-5.1:item:potion-of-healing',quantity:2}]})
  expect(grant.ok).toBe(true)
  map.tokens.push({id:'bound',type:'obstacle',label:'Bound',color:'',emoji:'',size:1,x:600,y:850,elevationFeet:10.5,dnd5eObjectState:{schemaVersion:1,structureBinding:binding}})
  const write=async(name:string,data:unknown)=>writeFile(path.join(stateRoot,name+'.json'),JSON.stringify(data))
  const read=async(name:string)=>JSON.parse(await readFile(path.join(stateRoot,name+'.json'),'utf8'))
  await write('maps',{maps:[map],updatedAt:1});await write('map-geometry',{schemaVersion:3,maps:[geometry],updatedAt:1});await write('characters',{characters:grant.characters,updatedAt:1})
  const host={role:'dm',memberId:'host'}
  const advance=(minutes:number)=>atomicMutateCampaignTimeAndMaps({stateRoot},current=>mutateCampaignTimeState(current,{operation:'advance',minutes},10,host,{host}),'host')
  expect((await advance(10179-480)).ok).toBe(true)
  expect((await read('map-geometry')).maps[0].structureLifetimes).toHaveLength(1)
  const result=await advance(1)
  expect(result).toMatchObject({ok:true,next:{worldMinute:10180},geometryMutation:{changed:true},charactersMutation:{changed:true}})
  expect((await read('maps')).maps[0].tokens).toEqual([{...map.tokens[0],elevationFeet:0}])
  expect((await read('map-geometry')).maps[0].structureLifetimes).toEqual([])
  expect((await read('map-geometry')).maps[0].obstacles).toEqual([])
  expect((await read('characters')).characters[0].dnd5eInventory.entries.map((e:any)=>e.quantity)).toEqual([2])
  const saved=await read('maps');await advance(1);expect(await read('maps')).toEqual(saved)
 }finally{await rm(stateRoot,{recursive:true,force:true})}
})
