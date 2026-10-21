import { MAP_GEOMETRY_MAX_ENTITIES, normalizeMapGeometry, type MapGeometryObstacle, type MapGeometryState } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'

/** Local feet; top and thickness are explicit so ceiling clearance is never guessed. */
export interface Dnd5eStructureFloor {
  id: string; x: number; y: number; widthFeet: number; depthFeet: number;
  topFeet: number; thicknessInches: number;
  /** Local 10-foot panel coordinates reserved for stairs or other openings. */
  openings?: readonly { column: number; row: number }[];
}

export function placeDnd5eStructureFloors(input: {
  map: BattleMap; geometry: MapGeometryState; structureId: string; floors: readonly Dnd5eStructureFloor[];
  origin: { x: number; y: number }; rotationDegrees: number; elevationFeet: number; createdAt: number;
}): MapGeometryState {
  const scale=input.map.gridSize/(input.map.feetPerCell??5)
  if(input.geometry.mapId!==input.map.id || !/^[a-z0-9][a-z0-9._:-]{0,95}$/.test(input.structureId) ||
    ![scale,input.origin.x,input.origin.y,input.rotationDegrees,input.elevationFeet,input.createdAt].every(Number.isFinite) || scale<=0) throw new Error('structure-floor-placement-invalid')
  const angle=input.rotationDegrees*Math.PI/180
  const point=(x:number,y:number)=>({x:input.origin.x+(x*Math.cos(angle)-y*Math.sin(angle))*scale,
    y:input.origin.y+(x*Math.sin(angle)+y*Math.cos(angle))*scale})
  const ids=new Set([...input.geometry.walls,...input.geometry.doors,...input.geometry.obstacles,...input.geometry.windows??[],...input.geometry.lights??[]].map(entity=>entity.id))
  const floorIds=new Set<string>(), obstacles:MapGeometryObstacle[]=[]
  for(const floor of input.floors){
    const hp=floor.thicknessInches*30
    if(!/^[a-z0-9][a-z0-9._-]{0,95}$/.test(floor.id)||floorIds.has(floor.id)||
      ![floor.x,floor.y,floor.widthFeet,floor.depthFeet,floor.topFeet,floor.thicknessInches].every(Number.isFinite)||
      floor.widthFeet<=0||floor.depthFeet<=0||floor.thicknessInches<=0||!Number.isSafeInteger(hp)||hp>1_000_000) throw new Error('structure-floor-invalid')
    floorIds.add(floor.id)
    const columns=Math.ceil(floor.widthFeet/10),rows=Math.ceil(floor.depthFeet/10)
    if(columns*rows>MAP_GEOMETRY_MAX_ENTITIES) throw new Error('structure-map-budget-exceeded')
    const openings=new Set<string>()
    for(const opening of floor.openings??[]){
      const key=`${opening.column}:${opening.row}`
      if(!Number.isInteger(opening.column)||!Number.isInteger(opening.row)||opening.column<0||opening.row<0||opening.column>=columns||opening.row>=rows||openings.has(key)) throw new Error('structure-floor-opening-invalid')
      openings.add(key)
    }
    for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
      if(openings.has(`${column}:${row}`))continue
      const id=`${input.structureId}:floor:${floor.id}.${row}.${column}`
      if(ids.has(id))throw new Error('structure-entity-id-conflict')
      ids.add(id)
      if(ids.size>MAP_GEOMETRY_MAX_ENTITIES)throw new Error('structure-map-budget-exceeded')
      const x=floor.x+column*10,y=floor.y+row*10,right=floor.x+Math.min(floor.widthFeet,(column+1)*10),bottom=floor.y+Math.min(floor.depthFeet,(row+1)*10)
      const points=[point(x,y),point(right,y),point(right,bottom),point(x,bottom)]
      if(points.some(p=>p.x<0||p.y<0||p.x>input.map.width||p.y>input.map.height))throw new Error('structure-outside-map')
      obstacles.push({id,kind:'obstacle',label:floor.id,points,cover:'total',surfaceMaterial:'stone',
        blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,baseHeightFeet:input.elevationFeet+floor.topFeet-floor.thicknessInches/12,
        heightFeet:floor.thicknessInches/12,createdAt:input.createdAt,
        dnd5eDurability:{hitPoints:hp,maxHitPoints:hp,damageThreshold:0,armorClass:15,damageImmunities:['poison','psychic']}})
    }
  }
  const geometry=normalizeMapGeometry({...input.geometry,obstacles:[...input.geometry.obstacles,...obstacles]})
  if(!geometry)throw new Error('structure-geometry-invalid')
  return geometry
}
