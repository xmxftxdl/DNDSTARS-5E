import { buildDnd5eStructureSections, type Dnd5eStructureWallV1 } from './structureSections'
import {normalizeStructureLifetimes} from '../../../shared/structure-lifetime.mjs'
import {createFortressServants} from '../../../shared/fortress-services.mjs'
import {validateDnd5eMightyFortressSite,findDnd5eFortressRenewal,type Dnd5eFortressSiteQualifications} from './mightyFortressPlacement'
import {expireDnd5eStructureMapObjects} from './structureObjectExpiry'
import { placeDnd5eStructureSections } from './structureGeometry'
import { placeDnd5eStructureFloors, type Dnd5eStructureFloor } from './structureFloors'
import { placeDnd5eStructureStairs, type Dnd5eStructureStairFlight } from './structureStairs'
import {buildDnd5eFortressRooms} from './mightyFortressRooms'
import {buildDnd5eFortressRoomBlueprint,assertDnd5eFortressRoomAccess,type Dnd5eFortressRoomBlueprint} from './fortressRoomBlueprint'
import type {Dnd5eFortressFurnishingPlacement} from './fortressFurnishingDefinition'

export type Dnd5eFortressLayoutSelection=Pick<Parameters<typeof placeDnd5eMightyFortressKeep>[0],
 'towerThicknessInches'|'floorThicknessInches'|'stairs'|'stairOpenings'|'openings'|'authorizedCreatureIds'|'eastRoomsPerLevel'|'roomArchways'|'roomBlueprint'> & {furnishings?:readonly Dnd5eFortressFurnishingPlacement[]}

/** Host creation boundary: validate the complete site before generating any entities. */
export function prepareDnd5eMightyFortressStructure(input:Parameters<typeof placeDnd5eMightyFortressKeep>[0]&{
 qualifications:Dnd5eFortressSiteQualifications;renewal?:{structureId:string;casterId:string};
}){
 const renewal=input.renewal??(input.lifetime?findDnd5eFortressRenewal({...input,casterId:input.lifetime.casterId}):undefined)
 if(renewal&&input.lifetime&&renewal.casterId!==input.lifetime.casterId)return {ok:false as const,reason:'fortress-renewal-owner-invalid'}
 const site=validateDnd5eMightyFortressSite({...input,renewal})
 if(!site.ok)return site
 const old=renewal?input.geometry.structureLifetimes?.find(record=>record.id===renewal.structureId):undefined
 const owned=new Set(old?.entityIds??[])
 // Retain the lifetime until publication so replacement also cleans carried items atomically.
 const geometry=old?{...input.geometry,obstacles:input.geometry.obstacles.filter(entity=>!owned.has(entity.id)),
  doors:input.geometry.doors.filter(entity=>!owned.has(entity.id))}:input.geometry
 const map=old?expireDnd5eStructureMapObjects(input.map,[{schemaVersion:1,mapId:input.map.id,structureId:old.id}]):input.map
 return {ok:true as const,map,...placeDnd5eMightyFortressKeep({...input,map,geometry})}
}

/** Walls and slabs share one vertical plan; each occupied story has ten feet of clear space. */
export function placeDnd5eMightyFortressKeep(input:
  Omit<Parameters<typeof placeDnd5eMightyFortressShell>[0], 'keepHeightFeet'> & {
    floorThicknessInches: number;
    eastRoomsPerLevel?: readonly number[];
    roomArchways?: readonly string[];
    roomBlueprint?: readonly Dnd5eFortressRoomBlueprint[];
    authorizedCreatureIds?: readonly string[];
    /** Trusted imported-module recipe, not a player request field. */
    mealTemplateId?: string;
    stairOpenings?: readonly { level: 2 | 3; column: number; row: number }[];
    stairs?: readonly Dnd5eStructureStairFlight[];
    lifetime?: {casterId:string;worldMinute:number};
  },
) {
  const delegates=input.authorizedCreatureIds??[]
  if(delegates.length>256||new Set(delegates).size!==delegates.length||delegates.some(id=>typeof id!=='string'||!id||id.length>160||id.trim()!==id||
    !input.map.tokens.some(token=>token.type!=='obstacle'&&!token.dnd5eSpellEffect&&(token.characterId??token.id)===id)))throw Error('fortress-delegate-invalid')
  const thickness=input.floorThicknessInches/12
  if(!Number.isFinite(thickness)||thickness<=0||!Number.isSafeInteger(input.floorThicknessInches*30)||input.floorThicknessInches*30>1_000_000) {
    throw new Error('fortress-floor-thickness-required')
  }
  if(input.stairOpenings?.some(opening=>opening.level!==2&&opening.level!==3)) throw new Error('fortress-stair-level-invalid')
  const levels=[0,10+thickness,20+2*thickness]
  const floors:Dnd5eStructureFloor[]=[1,2,3].map(index=>({id:index===3?'keep-roof':`keep-level-${index+1}`,
    x:35,y:35,widthFeet:50,depthFeet:50,topFeet:index*(10+thickness),thicknessInches:input.floorThicknessInches,
    openings:input.stairOpenings?.filter(opening=>opening.level===index+1).map(({column,row})=>({column,row}))}))
  for(const [id,x,y] of [['nw',0,0],['ne',100,0],['sw',0,100],['se',100,100]] as const){
    floors.push({id:`tower-${id}-roof`,x,y,widthFeet:20,depthFeet:20,topFeet:30,thicknessInches:input.floorThicknessInches})
  }
  const shell=placeDnd5eMightyFortressShell({...input,keepHeightFeet:3*(10+thickness)})
  const floorsGeometry=placeDnd5eStructureFloors({...input,geometry:shell,floors})
  const stairGeometry=input.stairs?.length ? placeDnd5eStructureStairs({...input,geometry:floorsGeometry,stairs:input.stairs}) : floorsGeometry
  if(input.roomBlueprint&&(input.eastRoomsPerLevel?.some(Boolean)||input.roomArchways?.length))throw Error('fortress-room-layout-conflict')
  const rooms=input.roomBlueprint?buildDnd5eFortressRoomBlueprint(input.roomBlueprint,levels):buildDnd5eFortressRooms(input.eastRoomsPerLevel??[0,0,0],levels,input.roomArchways)
  if(input.roomBlueprint)assertDnd5eFortressRoomAccess(rooms,input.stairs??[],input.stairOpenings??[],levels)
  const geometry=rooms.sections.length?placeDnd5eStructureSections({...input,geometry:stairGeometry,...rooms,surfaceMaterial:'stone'}):stairGeometry
  if(input.lifetime){
    const {casterId,worldMinute}=input.lifetime
    if(!casterId||casterId.length>160||!Number.isSafeInteger(worldMinute)||worldMinute<0||!Number.isSafeInteger(worldMinute+10080))throw new Error('fortress-lifetime-invalid')
    if(geometry.structureLifetimes?.some(entry=>entry.id===input.structureId))throw new Error('fortress-lifetime-conflict')
    const prior=new Set([...input.geometry.obstacles,...input.geometry.doors].map(entity=>entity.id))
    const angle=input.rotationDegrees*Math.PI/180,scale=input.map.gridSize/(input.map.feetPerCell??5)
    const footprint=[[0,0],[120,0],[120,120],[0,120]].map(([x,y])=>[
      Math.round((input.origin.x+(x*Math.cos(angle)-y*Math.sin(angle))*scale)*1e6)/1e6,
      Math.round((input.origin.y+(x*Math.sin(angle)+y*Math.cos(angle))*scale)*1e6)/1e6])
    const siteKey=JSON.stringify([[...footprint].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),input.elevationFeet])
    geometry.structureLifetimes=[...geometry.structureLifetimes??[],{id:input.structureId,casterId,createdWorldMinute:worldMinute,
      replacementGroup:'mighty-fortress',siteKey,
      fortressServices:{authorizedCreatureIds:[...delegates],mealDay:Math.floor(worldMinute/1440),mealsServed:0,mealReceipts:[],servants:createFortressServants(),
        ...(input.mealTemplateId?{mealTemplateId:input.mealTemplateId}:{})},
      objectBoundary:{points:footprint.map(([x,y])=>({x,y})),bottomFeet:input.elevationFeet,topFeet:input.elevationFeet+Math.max(30,3*(10+thickness))},
      expiresWorldMinute:worldMinute+10080,entityIds:[...geometry.obstacles,...geometry.doors].filter(entity=>!prior.has(entity.id)).map(entity=>entity.id)}]
    if(!normalizeStructureLifetimes(geometry.structureLifetimes))throw new Error('fortress-lifetime-invalid')
  }
  return {geometry,levelElevationsFeet:levels.map(height=>input.elevationFeet+height)}
}

/** Shell placement with the spell's outer-door limit; the host still validates the casting site. */
export function placeDnd5eMightyFortressShell(input:
  Omit<Parameters<typeof placeDnd5eStructureSections>[0], 'sections'> & { towerThicknessInches: number; keepHeightFeet?: number },
) {
  const sections = buildDnd5eMightyFortressShell(input)
  const byId = new Map(sections.map(section => [section.id, section]))
  let outerDoors = 0
  for (const opening of input.openings ?? []) {
    const section = byId.get(opening.sectionId)
    if (!section) throw new Error('structure-opening-invalid')
    if (section.wallId.startsWith('outer-')) {
      if (opening.kind !== 'door' || ++outerDoors > 4) {
        throw new Error('fortress-outer-door-invalid')
      }
    }
  }
  return placeDnd5eStructureSections({ ...input, sections, surfaceMaterial:'stone' })
}

/** Structural shell only. Doorways, floors and furnishings are separate components. */
export function buildDnd5eMightyFortressShell(input: { towerThicknessInches: number; keepHeightFeet?: number }) {
  const thickness = input.towerThicknessInches
  if (!Number.isFinite(thickness) || thickness <= 0 || thickness >= 120 || !Number.isSafeInteger(thickness * 30)) {
    throw new Error('fortress-tower-thickness-required')
  }
  const walls: Dnd5eStructureWallV1[] = []
  const add = (id: string, x1: number, y1: number, x2: number, y2: number, heightFeet: number, thicknessInches: number) => {
    walls.push({ id, from: { x: x1, y: y1 }, to: { x: x2, y: y2 }, bottomFeet: 0, heightFeet, thicknessInches })
  }
  // Rectangles are exterior dimensions. Inset centerlines by half the wall thickness.
  const rectangle = (id: string, x: number, y: number, size: number, height: number, inches: number) => {
    const inset = inches / 24
    add(`${id}-north`, x, y + inset, x + size, y + inset, height, inches)
    add(`${id}-south`, x, y + size - inset, x + size, y + size - inset, height, inches)
    add(`${id}-west`, x + inset, y + inches / 12, x + inset, y + size - inches / 12, height, inches)
    add(`${id}-east`, x + size - inset, y + inches / 12, x + size - inset, y + size - inches / 12, height, inches)
  }
  rectangle('tower-nw', 0, 0, 20, 30, thickness)
  rectangle('tower-ne', 100, 0, 20, 30, thickness)
  rectangle('tower-sw', 0, 100, 20, 30, thickness)
  rectangle('tower-se', 100, 100, 20, 30, thickness)
  add('outer-north', 20, 0.5, 100, 0.5, 20, 12)
  add('outer-south', 20, 119.5, 100, 119.5, 20, 12)
  add('outer-west', 0.5, 20, 0.5, 100, 20, 12)
  add('outer-east', 119.5, 20, 119.5, 100, 20, 12)
  rectangle('keep', 35, 35, 50, input.keepHeightFeet??30, 6)
  return buildDnd5eStructureSections(walls, {
    widthFeet: 10, heightFeet: 10, hitPointsPerInch: 30,
    combatProfile: { armorClass: 15, damageImmunities: ['poison', 'psychic'] },
  })
}
