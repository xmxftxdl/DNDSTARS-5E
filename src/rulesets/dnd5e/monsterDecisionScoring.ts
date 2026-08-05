import type { Dnd5eMonsterBehaviorStyle } from './monsters'
import type { MonsterDecisionProvider } from './monsterDecisionContracts'

function rounded(value: number): string {
  return (Math.round(value * 10) / 10).toString()
}

interface BehaviorWeights {
  damage: number
  cover: number
  opportunityRisk: number
  distance: number
  dodge: number
  dash: number
  retreat: number
  targetPriority: number
  survival: number
  control: number
  support: number
  resource: number
}

const BEHAVIOR_WEIGHTS: Readonly<Record<Dnd5eMonsterBehaviorStyle, BehaviorWeights>> = {
  balanced: { damage: 1, cover: 1, opportunityRisk: 1, distance: 1, dodge: 1, dash: 1, retreat: 0, targetPriority: 1, survival: 1, control: 1, support: 1, resource: 1 },
  aggressive: { damage: 1.25, cover: 0.55, opportunityRisk: 0.6, distance: 1.05, dodge: 0.5, dash: 1.25, retreat: -3, targetPriority: 0.9, survival: 0.55, control: 0.8, support: 0.65, resource: 0.75 },
  defensive: { damage: 0.9, cover: 1.8, opportunityRisk: 1.45, distance: 1.15, dodge: 1.45, dash: 0.8, retreat: 3, targetPriority: 1.05, survival: 1.55, control: 1.15, support: 1.25, resource: 1.15 },
  skirmisher: { damage: 1.05, cover: 1.5, opportunityRisk: 1.55, distance: 1.45, dodge: 1, dash: 0.9, retreat: 5, targetPriority: 1.1, survival: 1.3, control: 1, support: 0.9, resource: 1 },
  cowardly: { damage: 0.72, cover: 2.1, opportunityRisk: 1.9, distance: 1.7, dodge: 1.8, dash: 1.2, retreat: 8, targetPriority: 0.8, survival: 2, control: 0.7, support: 1.1, resource: 1.35 },
}

export const DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V2: MonsterDecisionProvider = {
  id: 'dnd5e:deterministic-tactical-v2',
  schemaVersion: 1,
  scoreCandidate(context, candidate) {
    const metrics = candidate.metrics
    const weights = BEHAVIOR_WEIGHTS[context.behaviorStyle]
    const reasons: string[] = [`行为风格：${context.behaviorStyle}`]
    let score = 0

    if (metrics.attacksThisTurn) {
      score += 30 * weights.damage + metrics.expectedDamage * 8 * weights.damage
      reasons.push(`本回合可攻击，期望伤害 ${rounded(metrics.expectedDamage)}`)
      if (metrics.targetCurrentHp > 0) {
        const finishingChance = Math.min(1, metrics.expectedDamage / metrics.targetCurrentHp)
        score += finishingChance * 18 * weights.damage
        if (finishingChance >= 0.75) reasons.push('具有较高的击倒目标机会')
      }
      score += metrics.hitProbability * 6 * weights.damage
    }
    if (metrics.defensiveCoverBonus > 0) {
      score += metrics.defensiveCoverBonus * 2.5 * weights.cover
      reasons.push(`精确掩护路线提供 +${metrics.defensiveCoverBonus} AC 防御收益`)
    }
    if (metrics.opportunityAttackRisk > 0) {
      score -= metrics.opportunityAttackRisk * 24 * weights.opportunityRisk
      reasons.push(`路线可能承受 ${metrics.opportunityAttackRisk} 次借机攻击`)
    }
    if (metrics.usesNimbleEscape) {
      score += 8 + (context.behaviorStyle === 'skirmisher' ? 5 : 0)
      reasons.push('以附赠动作使用灵巧脱逃，路线不触发借机攻击')
    }
    const preferredDistanceError = Math.max(
      0,
      Math.abs(metrics.targetDistanceFeet - metrics.preferredDistanceFeet) - 5,
    )
    score -= preferredDistanceError * (metrics.attacksThisTurn ? 0.12 : 0.04) * weights.distance
    if (metrics.distanceImprovementFeet > 0) {
      score += metrics.distanceImprovementFeet * (metrics.dashes ? 0.7 : 0.22) * weights.distance
      reasons.push(`改善与目标的战术距离 ${rounded(metrics.distanceImprovementFeet)} 尺`)
    }
    score -= metrics.movementFeet * 0.035
    if (candidate.kind === 'retreat-attack') score += weights.retreat
    if (metrics.dodges) {
      score += 9 * weights.dodge
      reasons.push('无法形成更高收益攻击时采取闪避')
    }
    if (metrics.dashes) {
      score += 4 * weights.dash
      reasons.push('使用疾走建立下一回合威胁')
    }
    const hpRatio = Math.max(0, Math.min(1, context.currentHp / Math.max(1, context.maxHp)))
    if (context.behaviorStyle === 'cowardly' && hpRatio < 0.5) {
      if (candidate.kind === 'retreat-attack' || metrics.dodges) {
        score += (1 - hpRatio) * 30
        reasons.push('低生命值下优先保全自身')
      }
      if (metrics.usesPreciseCoverRoute) score += (1 - hpRatio) * 12
    }
    if (metrics.consumesAction && !metrics.attacksThisTurn && !metrics.dodges && !metrics.dashes) {
      score -= 10
    }
    return { candidateId: candidate.id, score, reasons }
  },
}

export const DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V3: MonsterDecisionProvider = {
  id: 'dnd5e:deterministic-tactical-v3',
  schemaVersion: 1,
  scoreCandidate(context, candidate) {
    const base = DETERMINISTIC_TACTICAL_MONSTER_DECISION_PROVIDER_V2.scoreCandidate(context, candidate)
    const metrics = candidate.metrics
    const weights = BEHAVIOR_WEIGHTS[context.behaviorStyle]
    const reasons = [...base.reasons]
    let score = base.score
    const maximumHp = Math.max(1, metrics.targetMaximumHp ?? metrics.targetCurrentHp)
    const targetHpRatio = Math.max(0, Math.min(1, metrics.targetCurrentHp / maximumHp))
    const priorityWeight = Math.max(0, Math.min(1, metrics.targetPriorityWeight ?? 0))
    if (priorityWeight > 0) {
      score += priorityWeight * 48 * weights.targetPriority
      reasons.push(`符合 DM 目标偏好 ${rounded(priorityWeight * 100)}%`)
    }
    if (metrics.attacksThisTurn && targetHpRatio <= 0.35) {
      score += (1 - targetHpRatio) * 12 * weights.damage
      reasons.push('优先压制低生命值目标')
    }
    if (metrics.attacksThisTurn && metrics.targetConcentrating) {
      score += Math.max(2, metrics.hitProbability * 10) * weights.control
      reasons.push('命中可能迫使目标进行专注豁免')
    }
    if ((metrics.targetThreat ?? 0) > 0) {
      score += Math.min(12, Math.log2(1 + (metrics.targetThreat ?? 0)) * 2.5) * weights.targetPriority
      reasons.push('目标已对该怪物造成有效威胁')
    }
    if ((metrics.controlValue ?? 0) !== 0) {
      score += (metrics.controlValue ?? 0) * weights.control
      reasons.push((metrics.controlValue ?? 0) > 0 ? '能力具有控制或多目标收益' : '范围控制会对友方造成负面影响')
    }
    if ((metrics.supportValue ?? 0) > 0) {
      score += (metrics.supportValue ?? 0) * weights.support
      reasons.push('能力具有治疗或保护收益')
    }
    if ((metrics.affectedEnemyCount ?? 0) > 1) {
      score += Math.min(18, ((metrics.affectedEnemyCount ?? 1) - 1) * 5) * weights.control
      reasons.push(`范围协同覆盖 ${metrics.affectedEnemyCount} 名敌人`)
    }
    if ((metrics.affectedAllyCount ?? 0) > 0) {
      score -= (metrics.affectedAllyCount ?? 0) * 18
      reasons.push(`范围会影响 ${metrics.affectedAllyCount} 名友方`)
    }
    if ((metrics.allyEmergency ?? 0) > 0) {
      score += Math.min(1, metrics.allyEmergency ?? 0) * 16 * weights.support
      reasons.push('优先支援濒危队友')
    }
    if ((metrics.expectedIncomingDamage ?? 0) > 0) {
      const hpRatio = Math.max(0, Math.min(1, context.currentHp / Math.max(1, context.maxHp)))
      score -= (metrics.expectedIncomingDamage ?? 0) * (1.25 - hpRatio * 0.5) * weights.survival
      reasons.push(`预计承伤 ${rounded(metrics.expectedIncomingDamage ?? 0)}`)
    }
    if ((metrics.targetSupportCount ?? 0) > 0) {
      score -= (metrics.targetSupportCount ?? 0) * 1.5 * weights.survival
    }
    if ((metrics.resourceCost ?? 0) > 0) {
      score -= (metrics.resourceCost ?? 0) * weights.resource
      reasons.push('计入有限资源成本')
    }
    return { candidateId: candidate.id, score, reasons: reasons.slice(0, 12) }
  },
}
