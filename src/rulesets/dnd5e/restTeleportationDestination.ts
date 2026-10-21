import type { BattleMap } from '../../store/maps'
import type { SharedCampaignTimeState } from '../../lib/campaignTime'
import { validCampaignRestLocations } from '../../../shared/campaign-rest-locations.mjs'
import type { TeleportationCircleExit } from './teleportationCircle'

/** Resolve only Host-persisted records; there is no client destination parameter. */
export function dnd5eLastLongRestDestination(input: {
  clock: SharedCampaignTimeState; sourceMap: BattleMap; maps: readonly BattleMap[]; characterId: string
}): TeleportationCircleExit | undefined {
  const {clock,sourceMap,maps,characterId}=input
  if(!sourceMap.dnd5ePlane || !validCampaignRestLocations(clock.restLocations,clock.worldMinute))return undefined
  const record=clock.restLocations?.find(row=>row.characterId===characterId&&row.plane===sourceMap.dnd5ePlane)
  if(!record)return undefined
  const destinations=maps.filter(map=>map.id===record.mapId&&map.dnd5ePlane===sourceMap.dnd5ePlane)
  if(destinations.length!==1)return undefined
  const map=destinations[0]
  if(record.x<0||record.y<0||record.x>map.width||record.y>map.height)return undefined
  return {mapId:map.id,x:record.x,y:record.y,elevationFeet:record.elevationFeet}
}
