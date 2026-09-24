import { useEffect } from 'react'
import { useMapStore } from '../../store/maps'
import { teleportationCircleCrossed, teleportationCircleExpiredAfterDeparture, travelThroughTeleportationCircle } from '../../rulesets/dnd5e/teleportationCircle'

/** Only the DM turns observed, already-authorized movement into portal travel. */
export function useTeleportationCircleTravel(enabled: boolean, notify: (message: string) => void, onTravelled: (travelers: Array<{ tokenId: string; sourceMapId: string; destinationMapId: string }>) => Promise<void>, combat?: { active: boolean; mapId?: string; round: number; tokenId?: string }) {
  useEffect(() => {
    if (!enabled) return
    let applying = false
    const unsubscribe = useMapStore.subscribe((state, previous) => {
      if (applying || state.maps === previous.maps) return
      let maps = state.maps
      const messages: string[] = []
      const traveled = new Set<string>()
      const travelers: Array<{ tokenId: string; sourceMapId: string; destinationMapId: string }> = []
      for (const map of state.maps) {
        const before = previous.maps.find(m => m.id === map.id)
        if (!before) continue
        for (const area of map.dnd5ePluginAreas ?? []) {
          if (!area.teleportationExit || !area.anchorCell || !before.dnd5ePluginAreas?.some(a => a.id === area.id)) continue
          for (const token of map.tokens) {
            const old = before.tokens.find(t => t.id === token.id)
            if (!old || traveled.has(token.id) || token.type === 'obstacle' || old.x === token.x && old.y === token.y) continue
            if (!teleportationCircleCrossed(map, area, old, token)) continue
            const next = travelThroughTeleportationCircle(maps, map.id, area.id, token.id)
            if (!next) { messages.push(`${token.label}未能穿越传送法阵：出口不存在、已过期、重复角色或没有可用落点。`); continue }
            maps = next
            traveled.add(token.id)
            travelers.push({ tokenId: token.id, sourceMapId: map.id, destinationMapId: area.teleportationExit.mapId })
            messages.push(`${token.label}穿过传送法阵，到达${maps.find(m => m.id === area.teleportationExit?.mapId)?.name ?? '目标地图'}。`)
          }
        }
      }
      if (maps !== state.maps) {
        applying = true
        useMapStore.setState({ maps })
        applying = false
        void onTravelled(travelers).then(() => useMapStore.getState().saveSharedNow()).then(() => messages.forEach(notify)).catch(() => {
          notify('传送同步失败，正在重新读取服务器状态。')
          void useMapStore.getState().loadShared()
        })
      } else messages.forEach(notify)
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
  }, [enabled, notify, onTravelled, combat?.active, combat?.mapId, combat?.round, combat?.tokenId])
}
