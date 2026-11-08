import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5ePersistentAreaTurnTransition } from '../../pages/maps/persistentAreaTurnBoundary'
import { advanceDnd5ePluginAreasAtTurnBoundary, collectDnd5ePersistentAreaTriggers, collectDnd5eExpiringPersistentAreaDetonationTriggers, expireDnd5ePluginAreasAtTurnBoundary, reconcileDnd5ePluginAreasOnMap, reconcileDnd5ePluginAreasAndConcentrationOnMap } from './pluginAreas'
import { dnd5ePersistentAreaFlightCapableTokenIds, dnd5ePersistentAreaSizeRanks } from './pluginAreaTransactions'
import { expireDnd5eWebAreaAtTurnBoundary } from './webAreaRules'

/** Read-only check using the existing area lifecycle. It grants no dice or publication. */
export function bountifulDeathHasInactiveAreaBoundary(map: BattleMap, characters: readonly Character[], transition: Pick<Dnd5ePersistentAreaTurnTransition, 'boundaries'>): boolean {
  if (!map.dnd5ePluginAreas?.length) return true
  const before = JSON.stringify({ map, characters })
  for (const boundary of transition.boundaries) {
    const advanced = advanceDnd5ePluginAreasAtTurnBoundary({ ...boundary, map })
    if (advanced.movedAreaIds.length || JSON.stringify(advanced.map) !== JSON.stringify(map)) return false
    const context = { map, round: boundary.round, turnKey: boundary.turnKey,
      flightCapableTokenIds: dnd5ePersistentAreaFlightCapableTokenIds({ map, characters, round: boundary.round }),
      sizeRanksByTokenId: dnd5ePersistentAreaSizeRanks({ map, characters, round: boundary.round }) }
    if (collectDnd5ePersistentAreaTriggers({ ...context, timing: boundary.timing, targetTokenId: boundary.tokenId }).length ||
      (map.dnd5ePluginAreas ?? []).some(area => area.sourceTokenId === boundary.tokenId && collectDnd5ePersistentAreaTriggers({ ...context, areaId: area.id, timing: boundary.timing === 'turn-start' ? 'source-turn-start' : 'source-turn-end' }).length) ||
      collectDnd5eExpiringPersistentAreaDetonationTriggers({ ...boundary, map }).length) return false
    const web = expireDnd5eWebAreaAtTurnBoundary({ ...boundary, map, characters })
    const expired = expireDnd5ePluginAreasAtTurnBoundary({ ...boundary, map: web.map })
    const reconciled = reconcileDnd5ePluginAreasAndConcentrationOnMap(web.map, web.characters, boundary.round, reconcileDnd5ePluginAreasOnMap(expired, web.characters, boundary.round), [map])
    if (JSON.stringify({ map: reconciled.map, characters: reconciled.characters }) !== before) return false
  }
  return true
}
