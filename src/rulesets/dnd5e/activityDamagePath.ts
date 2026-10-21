import {dnd5eEffectiveSizeRank,type Dnd5eHeadlessCombatState,type Dnd5eCombatant,type Dnd5eCombatEvent} from './headlessCombatEngine'
import type {Dnd5eActivityDefinitionV1,Dnd5eActivityAreaPlacementV1} from './activities/dnd5eActivityContracts'
import type {Dnd5eDamageType} from './damageTypes'
import {dnd5eCreatureHeightFeetForSizeRank} from './verticalCombatGeometry'
import {mapGeometryDamagePathHalved,mapGeometryTerrainElevationAtPoint} from '../../lib/mapGeometry'

/** Preserve component attribution while applying environmental attenuation before defenses. */
export function dnd5eDamagePathComponents<T extends {total:number;type?:Dnd5eDamageType}>(
 components:readonly T[],input:Omit<Parameters<typeof dnd5eActivityDamagePathAmount>[0],'amount'|'damageType'>):T[]{
 return components.map(component=>({...component,total:dnd5eActivityDamagePathAmount({...input,amount:component.total,damageType:component.type})}))
}

/** The transaction has already validated the effect's placement against Host geometry. */
export function dnd5eActivityDamagePathAmount(input:{
  state:Dnd5eHeadlessCombatState;actor:Dnd5eCombatant;target:Dnd5eCombatant
  activity?:Dnd5eActivityDefinitionV1;placement?:Dnd5eActivityAreaPlacementV1
  areaOrigin?:'self'|'point'|'event-target'
  effectOrigin?:{x:number;y:number;elevationFeet?:number}
  grantingAreaId?:string
  events?:Dnd5eCombatEvent[];spellEffect?:boolean
  amount:number;damageType?:Dnd5eDamageType;cannotBeReduced?:boolean
}):number {
  const scene=input.state.companionScene
  if(!scene||!input.damageType||!input.target.position)return input.amount
  const areaOrigin=input.areaOrigin??(input.activity?.target.kind==='area'?input.activity.target.origin:undefined)
  const fromGrant=input.activity?.target.kind==='creature'&&input.activity.target.rangeOrigin==='granting-area'
  const grant=fromGrant?scene.map.dnd5ePluginAreas?.find(area=>area.id===input.grantingAreaId&&
    area.sourceTokenId===input.actor.id&&area.grantedActivities?.some(item=>item.activityId===input.activity?.id)):undefined
  const grantOrigin=grant?.anchorCell?{
    x:scene.map.gridOffsetX+(grant.anchorCell.col+.5)*scene.map.gridSize,
    y:scene.map.gridOffsetY+(grant.anchorCell.row+.5)*scene.map.gridSize,
    elevationFeet:grant.vertical?.mode==='volume'
      ?grant.vertical.baseElevationFeet+(grant.vertical.shape==='sphere'?grant.vertical.heightFeet/2:0)
      :mapGeometryTerrainElevationAtPoint(scene.geometry??undefined,{x:scene.map.gridOffsetX+(grant.anchorCell.col+.5)*scene.map.gridSize,y:scene.map.gridOffsetY+(grant.anchorCell.row+.5)*scene.map.gridSize}),
  }:undefined
  if(fromGrant&&!grantOrigin)return input.amount
  const effectOrigin=input.effectOrigin??grantOrigin
  const pointArea=!!effectOrigin||areaOrigin==='point'||areaOrigin==='event-target'
  const origin=effectOrigin??(pointArea?input.placement:input.actor.position)
  if(!origin)return input.amount
  const elevation=effectOrigin?.elevationFeet??(pointArea?input.placement?.elevationFeet:input.actor.elevationFeet)
  const fromElevationFeet=(elevation??0)+(pointArea?0:dnd5eCreatureHeightFeetForSizeRank(dnd5eEffectiveSizeRank(input.actor))/2)
  const toElevationFeet=(input.target.elevationFeet??0)+dnd5eCreatureHeightFeetForSizeRank(dnd5eEffectiveSizeRank(input.target))/2
  if(input.damageType==='cold'&&input.spellEffect&&input.events)input.events.push({type:'cold-spell-path-resolved',actorId:input.actor.id,targetId:input.target.id,
    from:{x:origin.x,y:origin.y},to:{...input.target.position},fromElevationFeet,toElevationFeet})
  if(input.cannotBeReduced)return input.amount
  const areas=scene.map.dnd5ePluginAreas?.filter(area=>!area.modeState?.paused && (area.permanent===true ||
    (input.state.round<=area.expiresAfterRound && (scene.worldMinute==null||area.expiresAtWorldMinute==null||scene.worldMinute<area.expiresAtWorldMinute))))
  const halved=mapGeometryDamagePathHalved({map:{...scene.map,dnd5ePluginAreas:areas},geometry:scene.geometry??undefined,
    from:origin,to:input.target.position,fromElevationFeet,toElevationFeet,damageType:input.damageType})
  return halved?Math.floor(input.amount/2):input.amount
}
