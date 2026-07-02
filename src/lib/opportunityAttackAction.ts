import type { DiceRoll } from '../components/DiceRollOverlay'
import type {
  HeadlessCombatResult,
  HeadlessOpportunityAttackAction,
} from './headlessDmCombatEngine'
import { opportunityResolvedEvent } from './headlessCombatEvents'

export function buildOpportunityAttackAction(input: {
  attackerTokenId: string
  targetTokenId: string
  d20Value: number
  damageValues?: number[]
}): HeadlessOpportunityAttackAction {
  return {
    type: 'opportunity-attack-token',
    actorTokenId: input.attackerTokenId,
    targetTokenId: input.targetTokenId,
    d20Value: input.d20Value,
    damageValues: input.damageValues,
  }
}

export function shouldRollOpportunityDamage(input: {
  d20Value: number
  attackBonus: number
  targetAc: number
}): boolean {
  return input.d20Value + input.attackBonus >= input.targetAc || input.d20Value >= 20
}

export type OpportunityAttackSettlementPlan =
  | {
      status: 'rejected'
      log: { text: string; kind: 'system' }
    }
  | {
      status: 'ignored'
    }
  | {
      status: 'accepted'
      roll: DiceRoll
      combatLog: { text: string; kind: 'attack' | 'damage' }
    }

export function planOpportunityAttackSettlement(input: {
  result: HeadlessCombatResult
  attackerName: string
  targetName: string
  critDamageLabel: string
}): OpportunityAttackSettlementPlan {
  if (!input.result.ok) {
    return {
      status: 'rejected',
      log: {
        text: `${input.attackerName} 借机攻击未执行：${input.result.reason}`,
        kind: 'system',
      },
    }
  }

  const resolved = opportunityResolvedEvent(input.result.events)
  if (!resolved) return { status: 'ignored' }

  const total = resolved.total
  const bonus = total - resolved.rawDamage
  const formula = resolved.hit
    ? formatOpportunityDamageFormula({
        damageValues: resolved.damageValues,
        isCrit: resolved.isCrit,
        critDamageLabel: input.critDamageLabel,
        damageBeforeDefense: resolved.damageBeforeDefense,
        modifier: resolved.modifier,
        diff: resolved.diff,
        total: resolved.total,
      })
    : undefined

  return {
    status: 'accepted',
    roll: {
      values: resolved.damageValues,
      sides: 6,
      bonus,
      total,
      label: `借机攻击 · ${resolved.d20Value}+${resolved.attackBonus} vs AC${resolved.targetAc}${
        resolved.isCrit ? ' 重击' : ''
      }${resolved.hit ? '' : ' 未中'}`,
      formula,
      targetName: input.targetName,
      d20Roll: {
        value: resolved.d20Value,
        modifier: resolved.attackBonus,
        ac: resolved.targetAc,
        hit: resolved.hit,
        isCrit: resolved.isCrit,
      },
    },
    combatLog: {
      text: `${input.attackerName} 借机攻击 ${input.targetName}：D20 ${resolved.d20Value} + ${
        resolved.attackBonus
      } = ${resolved.d20Value + resolved.attackBonus} vs AC ${resolved.targetAc}，${
        resolved.hit ? '命中' : '未命中'
      }${formula ? `；伤害 ${formula}` : ''}；最终 ${resolved.total} 点伤害`,
      kind: total > 0 ? 'damage' : 'attack',
    },
  }
}

function formatOpportunityDamageFormula(input: {
  damageValues: number[]
  isCrit: boolean
  critDamageLabel: string
  damageBeforeDefense: number
  modifier: number
  diff: number
  total: number
}): string {
  const critText = input.isCrit ? ` × 暴击${input.critDamageLabel}` : ''
  return `${input.damageValues.join(' + ')}${critText}${input.isCrit ? ` = ${input.damageBeforeDefense}` : ''} ${
    input.modifier >= 0 ? '+' : '-'
  } ${Math.abs(input.modifier)}攻防修正(差值${input.diff}) = ${input.total}`
}
