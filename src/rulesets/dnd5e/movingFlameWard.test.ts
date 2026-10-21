import {expect,it,vi} from 'vitest'
import type {BattleMap} from '../../store/maps'
import type {MapGeometryLight} from '../../lib/mapGeometry'
import {settleStrongWindFlamesAlongMovement} from './strongWindFlameMovement'
import {reconcileDnd5ePersistentAreaAnchors} from './coreSpellAreas'
it.each(['crossing','protected','large','above','stopped','expired','paused'] as const)('moving small-flame ward settles only traversed exposure: %s',async mode=>{
 const light={enabled:true,sourceKind:'torch' as const,color:'#ffffff',brightRadiusFeet:20,dimRadiusFeet:20,startedAtWorldMinute:0,durationMinutes:60,expiresAtWorldMinute:60,
  flameProtected:mode==='protected',flameSize:mode==='large'?'larger' as const:undefined}
 const map:BattleMap={id:'sweep',name:'Sweep',width:1000,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
  tokens:[{id:'caster',label:'Caster',type:'enemy',x:25,y:75,size:1,color:'#ffffff',emoji:''},
   {id:'fire',label:'Fire',type:'obstacle',x:225,y:75,size:1,color:'#ffffff',emoji:'',lightSource:light}],
  dnd5ePluginAreas:[{id:'ward',pluginId:'test.ward',featureId:'ward',label:'Ward',color:'#ffffff',sourceTokenId:'caster',sourceCharacterId:'caster',anchorMode:'source-token',anchorCell:{col:0,row:1},cells:[{col:0,row:1}],vertical:{mode:'volume',baseElevationFeet:0,heightFeet:10},extinguishesUnprotectedFlames:'torch-or-smaller',createdRound:1,expiresAfterRound:mode==='expired'?0:100,
   ...(mode==='paused'?{modeState:{paused:true,profiles:[{id:'wind'}],selectedModeId:'wind',changeReceipts:[]}}:{})}]}
 const scene:MapGeometryLight={...light,id:'scene',kind:'light',label:'Scene',points:[{x:225,y:75}],elevationFeet:0,createdAt:0}
 const x=mode==='stopped'?125:425,z=mode==='above'?20:0
 const finalMap=reconcileDnd5ePersistentAreaAnchors({...map,tokens:map.tokens.map(t=>t.id==='caster'?{...t,x,elevationFeet:z}:t)})
 const roll=vi.fn(async()=>1),input={beforeMap:map,map:finalMap,tokenId:'caster',round:1,worldMinute:1,transactionId:'sweep',path:[{x:25,y:75},{x,y:75}],pathElevationsFeet:[z,z],lights:[scene],roll}
 const result=await settleStrongWindFlamesAlongMovement(input)
 expect(result.map.tokens[0]).toMatchObject({x,y:75,elevationFeet:z})
 expect(result.map.dnd5ePluginAreas).toEqual(finalMap.dnd5ePluginAreas)
 expect(result.map.tokens[1].lightSource===undefined).toBe(mode==='crossing')
 expect(result.lights![0].enabled).toBe(mode!=='crossing')
 expect(roll).not.toHaveBeenCalled();expect(map.tokens[1].lightSource).toBe(light);expect(scene.enabled).toBe(true)
 const replay=await settleStrongWindFlamesAlongMovement({...input,map:result.map,lights:result.lights})
 expect(replay.map).toEqual(result.map);expect(replay.lights).toEqual(result.lights);expect(replay.logs).toHaveLength(0)
})
