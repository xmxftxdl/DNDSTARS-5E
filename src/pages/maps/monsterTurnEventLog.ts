import type { Token } from '../../store/maps'
import type { Dnd5eCombatEvent } from '../../application/combat/dnd5eCombatRules'
import { getDnd5eSrdMonster } from '../../rulesets/dnd5e/monsters'
import { dnd5eConditionLabel } from '../../rulesets/dnd5e/conditions'

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
    if (event.type === 'confused-turn-behavior-resolved') {
      const actorName = tokenName(tokens, event.actorId, '受术者')
      const outcome = event.mode === 'random-movement-no-action'
        ? `1d8 = ${event.directionRoll ?? '—'}（${[
            '北', '东北', '东', '东南', '南', '西南', '西', '西北',
          ][Math.max(0, Math.min(7, (event.directionRoll ?? 1) - 1))]}），必须沿该方向用尽移动力，且不能执行动作`
        : event.mode === 'no-movement-or-action'
          ? '本回合不能移动，也不能执行动作'
          : event.mode === 'random-melee-attack'
            ? event.forcedTargetId
              ? `必须用动作对触及范围内随机目标“${tokenName(tokens, event.forcedTargetId, '目标')}”进行一次近战攻击`
              : '触及范围内没有生物，本回合不执行动作'
            : '本回合可以正常行动'
      return [{
        kind: 'system',
        text: `${actorName}的困惑行为：1d10 = ${event.roll}，${outcome}。`,
      }]
    }
    if (event.type === 'active-effect-random-condition-resolved') {
      const targetName = tokenName(tokens, event.targetId, '目标')
      const threshold = `${event.minimum}–${event.dieSides}`
      const outcome = event.triggered
        ? event.condition === 'banished'
          ? '触发，暂时进入以太位面，直到其下回合开始'
          : `触发 ${event.condition}`
        : '未触发'
      return [{
        kind: 'system',
        text: `${targetName}的回合结束随机状态检定：1d${event.dieSides} = ${event.roll}（触发 ${threshold}），${outcome}。`,
      }]
    }
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
      if (event.effectKind === 'aura') {
        const ability = ({
          str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力',
        } as const)[event.ability]
        const condition = dnd5eConditionLabel(event.condition)
        return [{
          kind: 'system',
          text: `${tokenName(tokens, event.targetId, '目标')}受到${
            tokenName(tokens, event.sourceId, '灵光来源')
          }的“${event.featureName ?? event.ruleId}”影响：${ability}豁免 ${
            event.total
          } vs DC ${event.dc}，${event.success
            ? '成功并获得对该来源的免疫'
            : `失败并陷入${condition}`}。`,
        }]
      }
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
