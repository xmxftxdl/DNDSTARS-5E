import {
  DND5E_SRD_ENEMY_POOL,
  dnd5eMonsterToEnemyTemplate,
  type EnemyTemplate,
} from '../../lib/enemyPool'
import type { Dnd5eMonsterStatBlock } from '../../rulesets/dnd5e/monsters'

export function composeDnd5eEnemyPool(
  customMonsters: readonly Dnd5eMonsterStatBlock[],
  pluginMonsters: readonly Dnd5eMonsterStatBlock[],
): EnemyTemplate[] {
  const entries = [
    ...DND5E_SRD_ENEMY_POOL,
    ...pluginMonsters.map(dnd5eMonsterToEnemyTemplate),
    // 房间内已保存的同 ID 怪物拥有最高优先级，避免扩展覆盖战役内的定制版本。
    ...customMonsters.map(dnd5eMonsterToEnemyTemplate),
  ]
  return [...new Map(entries.map((entry) => [entry.id, entry])).values()]
}
