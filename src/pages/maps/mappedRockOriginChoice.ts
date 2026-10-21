import type { BattleMap } from '../../store/maps'
import { showAppActionChoice, showAppAlert } from '../../lib/appDialog'
import { dnd5ePersistentAreaLooseRocks } from '../../rulesets/dnd5e/persistentAreaObjectOrigin'

/** Selection is advisory; the Host revalidates the rock and live area on submission. */
export async function promptMappedRockOrigin(map: BattleMap, areaId: string | undefined, label: string): Promise<string | null> {
  const area = map.dnd5ePluginAreas?.find(candidate => candidate.id === areaId)
  const rocks = area ? dnd5ePersistentAreaLooseRocks(map, area) : []
  if (!rocks.length) {
    await showAppAlert({ title: '没有可用岩石', message: '区域内需要由 DM 标记为岩石、未固定且未被穿戴或携带的物体。' })
    return null
  }
  return showAppActionChoice({ title: `${label} · 选择岩石`, message: '选择要投出的松动岩石，然后点击攻击目标。',
    options: rocks.map(rock => ({ id: rock.id, label: `${rock.label || '岩石'} · 第 ${Math.floor((rock.x-map.gridOffsetX)/map.gridSize)+1} 列，第 ${Math.floor((rock.y-map.gridOffsetY)/map.gridSize)+1} 行` })) })
}
