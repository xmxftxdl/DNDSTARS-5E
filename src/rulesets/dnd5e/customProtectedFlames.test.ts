import { expect, it, vi } from 'vitest'
import { migrateMapsState, type BattleMap } from '../../store/maps'
import { normalizeMapGeometryEntity, type MapGeometryLight } from '../../lib/mapGeometry'
import { validateAndMigrateSharedResource } from '../../lib/sharedResourceValidation'
import { validateSharedStateShape } from '../../../scripts/shared-server-core.mjs'
import { collectStrongWindProtectedFlames, settleStrongWindProtectedFlame } from './strongWindFlames'
import { settleStrongWindFlamesAlongMovement } from './strongWindFlameMovement'
import { prepareStrongWindGeometryFlames, settleStrongWindGeometryFlame } from './strongWindGeometryFlames'
import { reconcileDnd5ePluginAreasOnMap } from './pluginAreas'

function fixture() {
 const light={enabled:true,flame:true,flameProtected:true,sourceKind:'custom' as const,color:'#ffffff',brightRadiusFeet:30,dimRadiusFeet:30}
 const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
   tokens:[{id:'fire',label:'Enclosed custom fire',type:'obstacle',x:75,y:75,size:1,color:'#ffffff',emoji:'',lightSource:light}],
   dnd5ePluginAreas:[{id:'wind',pluginId:'test.grove',featureId:'test.grove:grove',label:'Wind',color:'#ffffff',sourceTokenId:'caster',sourceCharacterId:'caster',
     cells:[{col:1,row:1}],strongWind:true,createdRound:1,expiresAfterRound:100}]}
 const scene:MapGeometryLight={...light,id:'scene-fire',kind:'light',label:'Scene fire',points:[{x:75,y:75}],elevationFeet:0,createdAt:0}
 return {map,scene}
}
it.each([50,51])('custom carried fire resolves d100=%i and survives persisted receipt validation',d100=>{
 const {map}=fixture(),candidate=collectStrongWindProtectedFlames(map)[0]
 expect(candidate).toBeDefined()
 const result=settleStrongWindProtectedFlame(map,{...candidate,d100,round:1,transactionId:'custom-fire'})!
 expect(!!result.tokens[0].lightSource).toBe(d100>50)
 const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[result],selectedId:'map'})))
 expect(saved.maps[0].dnd5ePluginAreas![0].triggerReceipts).toHaveLength(1)
 expect(validateAndMigrateSharedResource('maps',saved).status).not.toBe('invalid')
 expect(validateSharedStateShape('maps',saved)).toEqual({ok:true})
 expect(collectStrongWindProtectedFlames(saved.maps[0])).toHaveLength(0)
 if(d100>50)expect(saved.maps[0].tokens[0].lightSource?.flameProtected).toBe(true)
})
it('exposed custom fire extinguishes automatically; explicit non-fire remains',()=>{
 const {map}=fixture()
 map.tokens[0].lightSource!.flameProtected=false
 expect(collectStrongWindProtectedFlames(map)).toHaveLength(0)
 expect(reconcileDnd5ePluginAreasOnMap(map,[],1).tokens[0].lightSource).toBeUndefined()
 map.tokens[0].lightSource!.flame=false
 expect(reconcileDnd5ePluginAreasOnMap(map,[],1).tokens[0].lightSource).toBeDefined()
})
it.each([true,false])('custom fire crossing wind uses protection=%s despite ending outside',async protectedFire=>{
 const {map}=fixture();map.tokens[0].x=25;map.tokens[0].lightSource!.flameProtected=protectedFire
 const finalMap={...map,tokens:map.tokens.map(t=>({...t,x:225}))},roll=vi.fn(async()=>51)
 const result=await settleStrongWindFlamesAlongMovement({beforeMap:map,map:finalMap,tokenId:'fire',round:1,transactionId:'cross',path:[{x:25,y:75},{x:225,y:75}],roll})
 expect(roll).toHaveBeenCalledTimes(protectedFire?1:0)
 expect(!!result.map.tokens[0].lightSource).toBe(protectedFire)
 expect(result.map.tokens[0].x).toBe(225)
})
it.each([50,51])('custom scene flame resolves d100=%i and reload retains protection',d100=>{
 const {map,scene}=fixture(),input={map,lights:[scene],worldMinute:1,round:1}
 const candidate=prepareStrongWindGeometryFlames(input).candidates[0]
 expect(candidate).toBeDefined()
 const result=settleStrongWindGeometryFlame({...input,candidate,d100,transactionId:'scene'})!
 const light=normalizeMapGeometryEntity(JSON.parse(JSON.stringify(result.lights[0]))) as MapGeometryLight
 expect(light.flameProtected).toBe(true)
 expect(light.enabled).toBe(d100>50)
 expect(prepareStrongWindGeometryFlames({...input,...result,lights:[light]}).candidates).toHaveLength(0)
})
it('rejects malformed protection in both shared validators and geometry normalization',()=>{
 const {map,scene}=fixture()
 map.tokens[0].lightSource!.flameProtected='yes' as any
 expect(validateAndMigrateSharedResource('maps',{maps:[map]}).status).toBe('invalid')
 expect(validateSharedStateShape('maps',{maps:[map]})).toMatchObject({ok:false,reason:'invalid-token-light-source'})
 expect(normalizeMapGeometryEntity({...scene,flameProtected:'yes'})).toBeUndefined()
})
it('retains legacy lamp defaults and permits an explicit unprotected override',()=>{
 const {map}=fixture();map.tokens[0].lightSource={enabled:true,sourceKind:'lamp',color:'#ffffff',brightRadiusFeet:15,dimRadiusFeet:30,startedAtWorldMinute:0,durationMinutes:360,expiresAtWorldMinute:360}
 expect(collectStrongWindProtectedFlames(map)).toHaveLength(1)
 map.tokens[0].lightSource.flameProtected=false
 expect(collectStrongWindProtectedFlames(map)).toHaveLength(0)
 expect(reconcileDnd5ePluginAreasOnMap(map,[],1).tokens[0].lightSource).toBeUndefined()
})
