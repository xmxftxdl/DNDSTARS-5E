import type { Token } from '../../store/maps'
import type { Dnd5eCombatEvent } from '../../application/combat/dnd5eCombatRules'
import { getDnd5eSrdMonster } from '../../rulesets/dnd5e/monsters'

export interface Dnd5eMonsterTurnLogEntry {
  text: string
  kind: 'system'
}

function tokenFor(tokens: readonly Token[], id: string): Token | undefined {
  return tokens.find((token) => token.id === id)
}

function tokenName(tokens: readonly Token[], id: string, fallback: string): string {
  return tokenFor(tokens, id)?.label ?? fallback
}

function rechargeActionDetails(tokens: readonly Token[], actorId: string, actionId: string) {
  const token = tokenFor(tokens, actorId)
  const monster = token?.poolId ? getDnd5eSrdMonster(token.poolId) : undefined
  const action = monster?.actions.find((candidate) => candidate.id === actionId)
  const usage = action?.usage?.kind === 'recharge' ? action.usage : undefined
  return {
    name: action?.name ?? actionId,
    dieSides: usage?.dieSides ?? 6,
    minimum: usage?.minimum,
  }
}

export function dnd5eMonsterTurnEventLogEntries(
  events: readonly Dnd5eCombatEvent[],
  tokens: readonly Token[],
): Dnd5eMonsterTurnLogEntry[] {
  return events.flatMap((event): Dnd5eMonsterTurnLogEntry[] => {
    if (event.type === 'monster-berserk-resolved') {
      const actorName = tokenName(tokens, event.actorId, '怪物')
      return [{
        kind: 'system',
        text: `${actorName}的狂暴检定：1d6 = ${event.roll}（需要 6），${
          event.berserk ? '进入狂暴状态' : '未进入狂暴状态'
        }。`,
      }]
    }
    if (event.type === 'monster-berserk-ended') {
      return [{
        kind: 'system',
        text: `${tokenName(tokens, event.actorId, '怪物')}恢复至满生命值，狂暴状态结束。`,
      }]
    }
    if (event.type === 'monster-recharge-resolved') {
      const actorName = tokenName(tokens, event.actorId, '怪物')
      const action = rechargeActionDetails(tokens, event.actorId, event.actionId)
      const threshold = action.minimum == null
        ? ''
        : `（需要 ${action.minimum}–${action.dieSides}）`
      return [{
        kind: 'system',
        text: `${actorName}的${action.name}充能检定：1d${action.dieSides} = ${event.roll}${threshold}，${
          event.ready ? '充能完成' : '未充能'
        }。`,
      }]
    }
    if (event.type === 'monster-mechanic-triggered') {
      return [{
        kind: 'system',
        text: `${tokenName(tokens, event.actorId, '怪物')} 触发“${event.mechanicName}”，恢复 ${event.amount} 点生命值（当前 ${event.hpAfter}）。`,
      }]
    }
    if (event.type === 'monster-mechanic-v2-triggered') {
      const details = event.outcomes.map((outcome) => {
        if (outcome.kind === 'healing') return `恢复 ${outcome.amount ?? 0} 点生命值`
        if (outcome.kind === 'temporary-hit-points') return `获得 ${outcome.amount ?? 0} 点临时生命值`
        if (outcome.kind === 'damage') return `造成 ${outcome.amount ?? 0} 点伤害`
        if (outcome.kind === 'remove-standard-condition') {
          return `${outcome.applied ? '移除' : '未找到'}状态 ${outcome.condition ?? ''}`
        }
        return `${outcome.applied ? '施加' : '未能施加'}状态 ${outcome.condition ?? ''}`
      }).join('，')
      return [{
        kind: 'system',
        text: `${tokenName(tokens, event.actorId, '怪物')} 触发“${event.mechanicName}”${details ? `：${details}` : ''}。`,
      }]
    }
    if (event.type === 'monster-turn-start-gaze-averted') {
      return [{
        kind: 'system',
        text: `${tokenName(tokens, event.targetId, '目标')}移开目光，暂时无法看见${
          tokenName(tokens, event.sourceId, '凝视来源')
        }。`,
      }]
    }
    if (event.type === 'monster-turn-start-gaze-save-resolved') {
      const outcome = event.success
        ? '成功'
        : event.immediatelyPetrified
          ? '失败并立即石化'
          : '失败，开始石化并陷入束缚'
      return [{
        kind: 'system',
        text: `${tokenName(tokens, event.targetId, '目标')}直视${
          tokenName(tokens, event.sourceId, '凝视来源')
        }：体质豁免 ${event.total} vs DC ${event.dc}，${outcome}。`,
      }]
    }
    return []
  })
}
