import { getEnemyTemplate } from './enemyPool'
import { getEnemyStatBlock, type EnemyStatBlock } from './enemyStatBlocks'

export const ENEMY_PLAYER_VISIBLE_DETAIL_SCHEMA_VERSION = 1

/**
 * Serializable, artwork-free detail snapshot explicitly published by the DM
 * on a map Token. It lets players inspect a room monster without receiving the
 * DM-only custom-monster catalogue or inline image data.
 */
export interface EnemyPlayerVisibleDetail {
  schemaVersion: typeof ENEMY_PLAYER_VISIBLE_DETAIL_SCHEMA_VERSION
  monsterId: string
  description?: string
  tags: readonly string[]
  statBlock: EnemyStatBlock
}

export function buildEnemyPlayerVisibleDetail(
  monsterId: string,
): EnemyPlayerVisibleDetail | undefined {
  const statBlock = getEnemyStatBlock(monsterId)
  // Every player already owns the bundled SRD catalogue. Map snapshots are
  // required only for room-owned/custom catalogue entries.
  if (!statBlock || statBlock.source === 'SRD 5.1') return undefined
  const template = getEnemyTemplate(monsterId)
  return {
    schemaVersion: ENEMY_PLAYER_VISIBLE_DETAIL_SCHEMA_VERSION,
    monsterId,
    description: template?.description,
    tags: [...(template?.tags ?? [])],
    statBlock,
  }
}

export function enemyPlayerVisibleDetailEquals(
  left: EnemyPlayerVisibleDetail | undefined,
  right: EnemyPlayerVisibleDetail | undefined,
): boolean {
  if (left === right) return true
  if (!left || !right) return false
  return JSON.stringify(left) === JSON.stringify(right)
}
