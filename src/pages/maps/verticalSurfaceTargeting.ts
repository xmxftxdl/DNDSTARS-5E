import { cellToPixel, type GridCell } from '../../lib/gridCombat'
import { mapGeometryRuntimeForMap, mapGeometryTerrainElevationAtPoint } from '../../lib/mapGeometry'
import { dnd5eActivityOutcomeAllowsChoicesV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityChoices'
import { resolveDnd5eActivityAreaMapSelectionV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityMapInteraction'
import { dnd5ePluginSpellActivity } from '../../rulesets/dnd5e/pluginSpellTransaction'
import { dnd5ePluginSpellDefinition } from '../../rulesets/dnd5e/plugins/pluginContentCatalog'
import {mapGeometryWithObjectSurfaces} from '../../rulesets/dnd5e/mapObjectSurfaceGeometry'
import type { Dnd5eSpellTargetingSession } from '../../application/combat/spells/SpellTargetingContracts'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'

export function verticalSurfaceTargetingActivity(targeting: Dnd5eSpellTargetingSession) {
  const activity=dnd5ePluginSpellActivity(dnd5ePluginSpellDefinition(targeting.spellId))
  if(!activity)return undefined
  const outcomes=activity.outcomes.filter(outcome=>dnd5eActivityOutcomeAllowsChoicesV1(outcome,targeting.activityChoices))
  return outcomes.some(outcome=>outcome.operations.some(operation=>operation.kind==='create-persistent-area' &&
    operation.surfaceAtPlacementElevation && operation.requireAllSurfaceMaterials && operation.anchorMode==='fixed' &&
    (operation.drawingTextChoiceId || ['surface-inscription','surface-color','surface-drawing'].includes(operation.visual?.preset??''))))
    ? {...activity,outcomes} : undefined
}

/** A map click picks the nearest eligible exposed face, never a hidden/back face. */
export function pickVerticalSurfaceAtCell(input:{targeting:Dnd5eSpellTargetingSession;map:BattleMap;source:Token;cell:GridCell;characters?:readonly Character[];worldMinute?:number}) {
  const activity=verticalSurfaceTargetingActivity(input.targeting),geometry=mapGeometryWithObjectSurfaces(input.map,mapGeometryRuntimeForMap(input.map.id),input.characters)
  if(!activity||!geometry||activity.target.kind!=='area')return undefined
  const aim=cellToPixel(input.cell,input.map)
  const candidates=[]
  for(const entity of geometry.obstacles)for(let edgeIndex=0;edgeIndex<entity.points.length;edgeIndex++){
    const a=entity.points[edgeIndex],b=entity.points[(edgeIndex+1)%entity.points.length]
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)
    if(length<=0)continue
    const fraction=Math.max(0,Math.min(1,((aim.x-a.x)*dx+(aim.y-a.y)*dy)/(length*length)))
    const point={x:a.x+dx*fraction,y:a.y+dy*fraction}
    const distance=Math.hypot(point.x-aim.x,point.y-aim.y)
    if(distance>input.map.gridSize*0.8)continue
    const selected=resolveDnd5eActivityAreaMapSelectionV1({activity,map:input.map,actorToken:input.source,characters:input.characters,worldMinute:input.worldMinute,
      anchorCell:input.cell,verticalSurface:{entityId:entity.id,edgeIndex,centerFraction:fraction},
      targetElevationFeet:input.targeting.targetElevationFeet??mapGeometryTerrainElevationAtPoint(geometry,point),
      dimensions:{widthFeet:input.targeting.areaTargetWidthFeet,heightFeet:input.targeting.areaTargetHeightFeet,volumeHeightFeet:input.targeting.areaTargetVolumeHeightFeet}})
    if(selected)candidates.push({selected,distance})
  }
  candidates.sort((a,b)=>a.distance-b.distance)
  return candidates[0]?.selected
}
