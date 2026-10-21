import type { BattleMap } from '../../store/maps'
import { dnd5eCompanionGuardAreaFitsMap, type Dnd5eCompanionGuardArea } from '../../rulesets/dnd5e/companionGuardArea'

export function companionGuardOverlays(map: BattleMap, isDM: boolean, viewerCharacterId?: string): Dnd5eCompanionGuardArea[] {
  const regions = new Map<string,Dnd5eCompanionGuardArea>()
  for (const token of map.tokens) {
    const summon=token.dnd5eSummon, order=token.dnd5eCombatState?.companionCommand
    if (!summon?.commandPolicy || summon.controlEnded || !order?.guardArea || order.command!=='attack' ||
      order.sourceOwnerId!==summon.sourceTokenId || order.sourceFeatureId!==summon.featureId ||
      (!isDM && (!viewerCharacterId || summon.sourceCharacterId!==viewerCharacterId)) ||
      !dnd5eCompanionGuardAreaFitsMap(map,order.guardArea)) continue
    const area=order.guardArea
    regions.set([area.mapId,area.minX,area.minY,area.maxX,area.maxY].join(':'),area)
  }
  return [...regions.values()]
}
