import {normalizeStructureLifetimes} from './structure-lifetime.mjs'

/** Shared browser/server spatial rule. Uses the cast-time envelope and token anchor. */
export function structureObjectOutsideBoundary(input) {
 if(input.mapId!==input.binding.mapId)return true
 const scene=input.geometry.maps.find(scene=>scene.mapId===input.binding.mapId)
 const records=normalizeStructureLifetimes(scene?.structureLifetimes??[])
 if(!records)throw Error('structure-object-lifetime-invalid')
 const source=records.find(record=>record.id===input.binding.structureId)
 if(!source)return true
 const boundary=source.objectBoundary
 if(!boundary)throw Error('structure-object-boundary-missing')
 const {x,y,elevationFeet}=input.position
 if(![x,y,elevationFeet].every(Number.isFinite))throw Error('structure-object-position-invalid')
 if(elevationFeet<boundary.bottomFeet-1e-6||elevationFeet>boundary.topFeet+1e-6)return true
 let sign=0
 for(let index=0;index<boundary.points.length;index++){
  const a=boundary.points[index],b=boundary.points[(index+1)%boundary.points.length]
  const cross=(b.x-a.x)*(y-a.y)-(b.y-a.y)*(x-a.x)
  if(Math.abs(cross)<=1e-6)continue
  if(sign&&Math.sign(cross)!==sign)return true
  sign=Math.sign(cross)
 }
 return false
}

