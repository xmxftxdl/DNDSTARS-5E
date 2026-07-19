import type { Token } from '../store/maps'
import { EQUIPMENT_SLOT_LABELS, EQUIPMENT_SLOTS } from './equipmentDefaults'
import { formatEquipmentStatLine, DEFAULT_ENEMY_AC } from './combatStats'
import { getEnemyStatBlock, getPrimaryAttackAction } from './enemyStatBlocks'

export function enemyHasDerivedCombat(poolId?: string): boolean {
  return !!poolId && !!getEnemyStatBlock(poolId)
}

export function getEnemyAc(poolId: string): number {
  return getEnemyStatBlock(poolId)?.ac ?? DEFAULT_ENEMY_AC
}

export function getEnemyMaxHp(poolId: string, fallback = 1): number {
  return getEnemyStatBlock(poolId)?.maxHp ?? fallback
}

export function getTokenTargetAc(token: Token): number | undefined {
  return token.poolId ? getEnemyStatBlock(token.poolId)?.ac : undefined
}

export interface EnemyDerivedCombatStats {
  ac: number
  maxHp: number
  toHit?: number
  damageDice?: string
  damageType?: string
  attackName?: string
}

/** 怪物战斗数值直接来自 SRD stat block，不再经过旧攻防派生公式。 */
export function getEnemyDerivedCombatStats(poolId: string): EnemyDerivedCombatStats | undefined {
  const block = getEnemyStatBlock(poolId)
  if (!block) return undefined
  const primary = getPrimaryAttackAction(block)
  return {
    ac: block.ac,
    maxHp: block.maxHp,
    toHit: primary?.toHit,
    damageDice: primary?.damageDice,
    damageType: primary?.damageType,
    attackName: primary?.name,
  }
}

export function getEnemyEquipmentSlots(poolId: string): { slot: string; label: string; name?: string; stats: string }[] {
  const equipment = getEnemyStatBlock(poolId)?.equipment
  if (!equipment) return []
  return EQUIPMENT_SLOTS.map((slot) => {
    const item = equipment[slot]
    return {
      slot,
      label: EQUIPMENT_SLOT_LABELS[slot],
      name: item?.name,
      stats: item ? formatEquipmentStatLine(item) : '',
    }
  })
}
