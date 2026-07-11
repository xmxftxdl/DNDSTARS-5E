import type { DiceRoll, D20AttackRoll } from '../components/DiceRollOverlay'
import type { EnemyAttackRoll } from './enemyAi'
import type {
  HeadlessCombatResult,
  HeadlessDmCombatState,
  HeadlessEnemyAttackAction,
} from './headlessDmCombatEngine'
import { resolveHeadlessDmAuthorityAction } from './headlessDmAuthority'
import { apSpentEvent, enemyAttackResolvedEvent } from './headlessCombatEvents'

export function buildEnemyAttackHeadlessAction(input: {
  actorTokenId: string
  targetTokenId: string
  actionIndex?: number
  diceValues?: number[]
  huntingBacklashValues?: number[]
  saveD20?: number
  useStableMind?: boolean
  actorApAlreadySpent?: boolean
  targetWantsDodge?: boolean
  targetDodgeD20?: number
  targetDodgeApAlreadySpent?: boolean
  useArcaneSurgeOnLethal?: boolean
}): HeadlessEnemyAttackAction {
  return {
    type: 'enemy-attack-token',
    actorTokenId: input.actorTokenId,
    targetTokenId: input.targetTokenId,
    ...(input.actionIndex !== undefined ? { actionIndex: input.actionIndex } : {}),
    ...(input.diceValues !== undefined ? { diceValues: input.diceValues } : {}),
    ...(input.huntingBacklashValues !== undefined ? { huntingBacklashValues: input.huntingBacklashValues } : {}),
    ...(input.saveD20 !== undefined ? { saveD20: input.saveD20 } : {}),
    ...(input.useStableMind !== undefined ? { useStableMind: input.useStableMind } : {}),
    ...(input.actorApAlreadySpent !== undefined ? { actorApAlreadySpent: input.actorApAlreadySpent } : {}),
    ...(input.targetWantsDodge !== undefined ? { targetWantsDodge: input.targetWantsDodge } : {}),
    ...(input.targetDodgeD20 !== undefined ? { targetDodgeD20: input.targetDodgeD20 } : {}),
    ...(input.targetDodgeApAlreadySpent !== undefined ? { targetDodgeApAlreadySpent: input.targetDodgeApAlreadySpent } : {}),
    ...(input.useArcaneSurgeOnLethal !== undefined ? { useArcaneSurgeOnLethal: input.useArcaneSurgeOnLethal } : {}),
  }
}

export function resolveEnemyAttackAuthority(
  state: HeadlessDmCombatState,
  action: HeadlessEnemyAttackAction,
): HeadlessCombatResult {
  return resolveHeadlessDmAuthorityAction(state, action)
}

export type EnemyAttackSettlementPlan =
  | {
      status: 'rejected'
      log: { text: string; kind: 'system' }
    }
  | {
      status: 'ignored'
    }
  | {
      status: 'accepted'
      damageValues: number[]
      damageTotal: number
      damageBonus: number
      roll: DiceRoll
      combatLog: { text: string; kind: 'attack' | 'damage' }
    }

export function planEnemyAttackSettlement(input: {
  result: HeadlessCombatResult
  attack: EnemyAttackRoll
  combatLabel: string
  d20Roll?: D20AttackRoll
}): EnemyAttackSettlementPlan {
  if (!input.result.ok) {
    return {
      status: 'rejected',
      log: {
        text: `敌人攻击未执行：${input.result.reason}`,
        kind: 'system',
      },
    }
  }

  const resolved = enemyAttackResolvedEvent(input.result.events)
  if (!resolved) return { status: 'ignored' }

  const damageValues = resolved.damageValues
  const damageTotal = resolved.total
  const damageBonus = resolved.total - resolved.diceTotal
  const roll: DiceRoll = {
    values: damageValues,
    sides: input.attack.sides,
    bonus: damageBonus,
    total: damageTotal,
    label: input.combatLabel ? `${input.attack.label} · ${input.combatLabel}` : input.attack.label,
    formula:
      damageValues.length > 0
        ? `${damageValues.join(' + ')}${damageBonus >= 0 ? ' + ' : ' - '}${Math.abs(damageBonus)} = ${damageTotal}`
        : undefined,
    targetName: input.attack.targetName,
    d20Roll: input.d20Roll,
  }

  return {
    status: 'accepted',
    damageValues,
    damageTotal,
    damageBonus,
    roll,
    combatLog: {
      text: `${input.attack.label} -> ${input.attack.targetName}：伤害骰 ${
        damageValues.length > 0 ? damageValues.join(' + ') : '无'
      }，加值 ${damageBonus}，最终 ${damageTotal} 点${input.combatLabel ? `；${input.combatLabel}` : ''}`,
      kind: damageTotal > 0 ? 'damage' : 'attack',
    },
  }
}

export function planEnemyAttackApLog(input: {
  result: HeadlessCombatResult
  actorTokenId: string
  attackerName: string
  targetName: string
  fallbackApMax: number
}): { text: string; kind: 'turn' } | undefined {
  if (!input.result.ok) return undefined
  const enemyApEvent = apSpentEvent(input.result.events, { tokenId: input.actorTokenId, characterId: null })
  if (!enemyApEvent) return undefined
  const ap = input.result.state.enemyApByToken[input.actorTokenId] ?? {
    current: enemyApEvent.after,
    max: input.fallbackApMax,
  }
  return {
    text: `${input.attackerName} 花费 ${enemyApEvent.amount} AP：攻击 ${input.targetName}。剩余 AP ${ap.current}/${ap.max}`,
    kind: 'turn',
  }
}
