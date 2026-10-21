import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {it,expect} from 'vitest'
import {atomicMutateCampaignTimeAndMaps,mutateCampaignTimeState} from '../../scripts/shared-server-core.mjs'

it('atomically renews stationary visible sightings, expires hidden ones and preserves the active scene across copies',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'stars-clock-sightings-'))
 const host={role:'dm',memberId:'host'}
 const read=async(name:string)=>JSON.parse(await readFile(path.join(root,name+'.json'),'utf8'))
 const write=async(name:string,value:unknown)=>writeFile(path.join(root,name+'.json'),JSON.stringify(value))
 const scene=(id:string)=>({id,name:id,width:300,height:300,gridSize:50,feetPerCell:5,tokens:[{id:'a-'+id,type:'player',characterId:'c',x:25,y:25,size:1,hp:20,label:'Caster',emoji:'A',color:'#fff'},{id:'t-'+id,type:'enemy',x:75,y:25,size:1,hp:20,label:'Target',emoji:'T',color:'#fff'}]})
 try{
  await write('maps',{selectedId:'active',maps:[scene('active'),scene('copy')]})
  await write('characters',{characters:[{id:'c',name:'Caster',currentHp:20,maxHp:20,abilities:{wis:10}}]})
  await write('map-geometry',{maps:['active','copy'].map(mapId=>({mapId,walls:[],doors:[],windows:[],obstacles:[],lights:[],vision:{enabled:true,ambientLight:'bright',defaultRangeFeet:300}}))})
  const advance=(minutes:number)=>atomicMutateCampaignTimeAndMaps({stateRoot:root},current=>mutateCampaignTimeState(current,{operation:'advance',minutes},10,host,{host}),'host')
  expect(await advance(1)).toMatchObject({ok:true})
  let character=(await read('characters')).characters[0]
  expect(character.dnd5eCombatState.recentCreatureSightings['t-active'].worldMinute).toBe(481)
  expect(character.dnd5eCombatState.recentCreatureSightings['t-copy']).toBeUndefined()
  expect(await advance(2)).toMatchObject({ok:true})
  character=(await read('characters')).characters[0]
  expect(character.dnd5eCombatState.recentCreatureSightings['t-active'].worldMinute).toBe(483)
  const maps=await read('maps');maps.maps[0].tokens[1].dnd5eCombatState={conditions:['invisible']};await write('maps',maps)
  expect(await advance(1)).toMatchObject({ok:true})
  expect((await read('characters')).characters[0].dnd5eCombatState.recentCreatureSightings['t-active'].worldMinute).toBe(483)
  expect(await advance(1)).toMatchObject({ok:true})
  expect((await read('characters')).characters[0].dnd5eCombatState.recentCreatureSightings).toBeUndefined()
  expect((await read('campaign-time')).worldMinute).toBe(485)
 }finally{if(!path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep+'stars-clock-sightings-'))throw Error('unsafe temp path');await rm(root,{recursive:true,force:true})}
})
