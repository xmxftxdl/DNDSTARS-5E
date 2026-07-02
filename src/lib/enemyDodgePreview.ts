import type { Token } from '../store/maps'
import type { Character, CombatSkill } from '../types/character'
import { attackDamageDiceCount, getEffectiveAbilityMod } from './archerCombat'
import { decideDodge, type DodgeDecision } from './aiPolicy'
import type { AbilityKey } from './dnd'
import { proficiencyBonus } from './dnd'
import { getTokenTargetAc } from './enemyCombatStats'

export interface EnemyDodgePreviewResult {
  decision: DodgeDecision
  attackBonus: number
  targetAc: number
}

export function buildEnemyDodgePreview(input: {
  combatActive: boolean
  target: Token
  attacker: Character
  skill: CombatSkill
  enemyAp: { current: number; max: number }
  fallbackAc?: number
}): EnemyDodgePreviewResult | null {
  const { combatActive, target, attacker, skill, enemyAp, fallbackAc = 12 } = input
  if (!combatActive || target.type !== 'enemy') return null
  if (enemyAp.current < 1) return null

  const attackAbility: AbilityKey = skill.tags?.includes('melee') ? 'str' : 'dex'
  const attackBonus = getEffectiveAbilityMod(attacker, attackAbility) + proficiencyBonus(attacker.level)
  const targetAc = getTokenTargetAc(target) ?? fallbackAc
  const diceCount = attackDamageDiceCount(skill, false)
  const estimatedDamage = diceCount * ((skill.damageSides + 1) / 2) + (skill.damageBonus ?? 0)
  const decision = decideDodge({
    currentAp: enemyAp.current,
    currentHp: target.hp ?? target.maxHp ?? 1,
    maxHp: target.maxHp ?? target.hp ?? 1,
    targetAc,
    incomingAttackBonus: attackBonus,
    estimatedDamage,
  })

  return { decision, attackBonus, targetAc }
}
