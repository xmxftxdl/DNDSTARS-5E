import { MAP_GEOMETRY_MAX_ENTITIES, normalizeMapGeometry, type MapGeometryState, type MapGeometryObstacle } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'

export interface Dnd5eStructureStairFlight {
  id: string;
  from: { x: number; y: number; elevationFeet: number };
  to: { x: number; y: number; elevationFeet: number };
  widthFeet: number;
  thicknessInches: number;
}

/** Generates stair traversal surfaces, split into independently destructible ten-foot runs. */
export function placeDnd5eStructureStairs(input: {
  map: BattleMap; geometry: MapGeometryState; structureId: string; stairs: readonly Dnd5eStructureStairFlight[];
  origin: {x:number;y:number}; rotationDegrees:number; elevationFeet:number; createdAt:number;
}): MapGeometryState {
  const scale=input.map.gridSize/(input.map.feetPerCell??5),angle=input.rotationDegrees*Math.PI/180
  if(input.geometry.mapId!==input.map.id || !/^[a-z0-9][a-z0-9._:-]{0,95}$/.test(input.structureId) ||
    ![scale,input.origin.x,input.origin.y,input.rotationDegrees,input.elevationFeet,input.createdAt].every(Number.isFinite)||scale<=0) throw new Error('structure-stair-placement-invalid')
  const transform=(x:number,y:number)=>({x:input.origin.x+(x*Math.cos(angle)-y*Math.sin(angle))*scale,
    y:input.origin.y+(x*Math.sin(angle)+y*Math.cos(angle))*scale})
  const ids=new Set([...input.geometry.walls,...input.geometry.doors,...input.geometry.obstacles,...input.geometry.windows??[],...input.geometry.lights??[]].map(entity=>entity.id))
  const flightIds=new Set<string>(),obstacles:MapGeometryObstacle[]=[]
  for(const flight of input.stairs){
    const hp=flight.thicknessInches*30,dx=flight.to.x-flight.from.x,dy=flight.to.y-flight.from.y,length=Math.hypot(dx,dy)
    if(!/^[a-z0-9][a-z0-9._-]{0,95}$/.test(flight.id)||flightIds.has(flight.id)||
      ![flight.from.x,flight.from.y,flight.from.elevationFeet,flight.to.x,flight.to.y,flight.to.elevationFeet,flight.widthFeet,flight.thicknessInches].every(Number.isFinite)||
      length<=0||flight.from.elevationFeet===flight.to.elevationFeet||flight.widthFeet<=0||flight.widthFeet>10||flight.thicknessInches<=0||!Number.isSafeInteger(hp)||hp>1_000_000) throw new Error('structure-stair-flight-invalid')
    flightIds.add(flight.id)
    const count=Math.ceil(length/10)
    if(count+ids.size>MAP_GEOMETRY_MAX_ENTITIES)throw new Error('structure-map-budget-exceeded')
    const at=(distance:number)=>({x:flight.from.x+dx*distance/length,y:flight.from.y+dy*distance/length,
      elevationFeet:input.elevationFeet+flight.from.elevationFeet+(flight.to.elevationFeet-flight.from.elevationFeet)*distance/length})
    const ox=-dy/length*flight.widthFeet/2,oy=dx/length*flight.widthFeet/2
    for(let index=0;index<count;index++){
      const a=at(index*10),b=at(Math.min(length,(index+1)*10)),id=`${input.structureId}:stairs:${flight.id}.${index}`
      if(ids.has(id))throw new Error('structure-entity-id-conflict')
      ids.add(id)
      const points=[transform(a.x+ox,a.y+oy),transform(b.x+ox,b.y+oy),transform(b.x-ox,b.y-oy),transform(a.x-ox,a.y-oy)]
      if(points.some(p=>p.x<0||p.y<0||p.x>input.map.width||p.y>input.map.height))throw new Error('structure-outside-map')
      obstacles.push({id,kind:'obstacle',label:flight.id,points,cover:'none',surfaceMaterial:'stone',
        baseHeightFeet:Math.min(a.elevationFeet,b.elevationFeet),heightFeet:0,
        blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:input.createdAt,
        stairPath:{schemaVersion:1,widthFeet:flight.widthFeet,widthMapUnits:flight.widthFeet*scale,thicknessInches:flight.thicknessInches,points:[{...transform(a.x,a.y),elevationFeet:a.elevationFeet},{...transform(b.x,b.y),elevationFeet:b.elevationFeet}]},
        dnd5eDurability:{hitPoints:hp,maxHitPoints:hp,damageThreshold:0,armorClass:15,damageImmunities:['poison','psychic']}})
    }
  }
  const geometry=normalizeMapGeometry({...input.geometry,obstacles:[...input.geometry.obstacles,...obstacles]})
  if(!geometry)throw new Error('structure-geometry-invalid')
  return geometry
}
