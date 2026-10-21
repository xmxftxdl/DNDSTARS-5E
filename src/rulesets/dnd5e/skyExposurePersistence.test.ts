import {expect,it} from 'vitest'
import {validateSharedStateShape,projectMapGeometryForPlayer} from '../../../scripts/shared-server-core.mjs'
import {createEmptyMapGeometry,normalizeMapGeometryEntity} from '../../lib/mapGeometry'
const region={id:'courtyard',kind:'obstacle',label:'Courtyard',terrainRegion:true,skyExposure:'open',
 points:[{x:0,y:0},{x:50,y:0},{x:50,y:50},{x:0,y:50}],baseHeightFeet:0,heightFeet:0,
 blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,cover:'none',createdAt:1}
const payload=(body:unknown)=>({schemaVersion:3,maps:[{...createEmptyMapGeometry('map',1),environment:'indoors',obstacles:[body]}],updatedAt:1})
it('preserves local sky exposure through the server, player projection and JSON reconstruction',()=>{
 for(const skyExposure of ['open','covered']){
  const data=payload({...region,skyExposure})
  expect(validateSharedStateShape('map-geometry',data)).toEqual({ok:true})
  const projected=projectMapGeometryForPlayer(data,null,0)
  expect(normalizeMapGeometryEntity(JSON.parse(JSON.stringify(projected.maps[0].obstacles[0])))).toMatchObject({skyExposure,terrainRegion:true})
 }
})
it('rejects malformed exposure and exposure attached to a solid body',()=>{
 for(const body of [{...region,skyExposure:'maybe'},{...region,skyExposure:3},{...region,terrainRegion:false}]){
  expect(validateSharedStateShape('map-geometry',payload(body))).toMatchObject({ok:false})
  expect(normalizeMapGeometryEntity(body)).toBeUndefined()
 }
})
