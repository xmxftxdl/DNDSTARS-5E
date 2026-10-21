import { useEffect } from 'react'
import { useMapStore } from '../../store/maps'

import { teleportationCircleCrossed, teleportationCircleExpiredAfterDeparture } from '../../rulesets/dnd5e/teleportationCircle'

/** Only the DM turns observed, already-authorized movement into portal travel. */
export function useTeleportationCircleTravel(enabled: boolean, notify: (message: string) => void, commitTravel: (sourceMapId: string, areaId: string, tokenId: string, crossed?: boolean) => Promise<boolean>, combat?: { active: boolean; mapId?: string; round: number; tokenId?: string }) {
  useEffect(() => {
    if (!enabled) return
    let applying = false
    const unsubscribe = useMapStore.subscribe((state, previous) => {
      if (applying || state.maps === previous.maps) return
      const candidates: Array<{ sourceMapId: string; areaId: string; tokenId: string }> = []
      const traveled = new Set<string>()
      for (const map of state.maps) {
        const before = previous.maps.find(m => m.id === map.id)
        if (!before) continue
        for (const area of map.dnd5ePluginAreas ?? []) {
          if (!area.teleportationExit || !area.anchorCell || !before.dnd5ePluginAreas?.some(a => a.id === area.id)) continue
          for (const token of map.tokens) {
            const old = before.tokens.find(t => t.id === token.id)
            if (!old || traveled.has(token.id) || token.type === 'obstacle' || old.x === token.x && old.y === token.y) continue
            if (!teleportationCircleCrossed(map, area, old, token)) continue
            traveled.add(token.id)
            candidates.push({ sourceMapId: map.id, areaId: area.id, tokenId: token.id })
          }
        }
      }
      if (!candidates.length) return
      applying = true
      void (async () => {
        for (const candidate of candidates) await commitTravel(candidate.sourceMapId, candidate.areaId, candidate.tokenId, true)
      })().catch(() => {
        notify('传送同步失败，正在重新读取服务器状态。')
        void useMapStore.getState().loadShared()
      }).finally(() => { applying = false })
    })
    const expire = () => {
      const state = useMapStore.getState()
      const now = Date.now()
      let changed = false
      const maps = state.maps.map(map => {
        const areas = map.dnd5ePluginAreas?.filter(area =>
          (!area.teleportationExit?.expiresAt || area.teleportationExit.expiresAt > now) &&
          !(combat?.active && combat.mapId === map.id && teleportationCircleExpiredAfterDeparture(area, map, combat.round, combat.tokenId)))
        if (areas?.length === map.dnd5ePluginAreas?.length) return map
        changed = true
        return { ...map, dnd5ePluginAreas: areas }
      })
      if (changed) {
        useMapStore.setState({ maps })
        void useMapStore.getState().saveSharedNow().catch(() => notify('传送法阵到期同步失败。'))
      }
    }
    expire()
    const timer = setInterval(expire, 1000)
    return () => { unsubscribe(); clearInterval(timer) }
  }, [enabled, notify, commitTravel, combat?.active, combat?.mapId, combat?.round, combat?.tokenId])
}
