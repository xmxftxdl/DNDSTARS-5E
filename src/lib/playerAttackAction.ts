import type { DiceRoll } from '../components/DiceRollOverlay'
import type { BattleMap, Token } from '../store/maps'
import type { Character, CombatSkill } from '../types/character'
import { canUseDoubleArrow } from './classFeatures'
import { isTokenAlive } from './combatTokens'
import {
  aoeTargetResolvedEvents,
  attackResolvedEvent,
  attackResolvedEvents,
  targetDodgeResolvedEvent,
  type HeadlessEventOf,
} from './headlessCombatEvents'
import type { HeadlessCombatEvent } from './headlessDmCombatEngine'
import { getSkillAoeTargeting } from './skillTargeting'
import type { SharedPlayerActionState } from './sharedCombatTypes'

export type PlayerAttackPrepareResult =
  | {
      ok: true
      actor: Character
      skill: CombatSkill
      targets: Token[]
      targetIds: string[]
      waiveAp: boolean
      doubleArrow: boolean
      isArrowSequence: boolean
    }
  | {
      ok: false
      reason: 'invalid-attack' | 'insufficient-ap'
    }

export function preparePlayerAttackAction(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: Character[]
}): PlayerAttackPrepareResult {
  const { action, map, characters } = input
  const actor = characters.find((character) => character.id === action.characterId)
  const skill = actor?.combatSkills.find((item) => item.id === action.skillId)
  const targetIds = action.targetTokenIds?.length
    ? action.targetTokenIds
    : action.targetTokenId
      ? [action.targetTokenId]
      : []
  const initialTargets = targetIds
    .map((targetId) => map.tokens.find((token) => token.id === targetId))
    .filter((target): target is Token => !!target)

  if (
    action.type !== 'attack-token' ||
    !actor ||
    !skill ||
    getSkillAoeTargeting(skill) ||
    initialTargets.length === 0 ||
    initialTargets.some((target) => !isTokenAlive(target, characters))
  ) {
    return { ok: false, reason: 'invalid-attack' }
  }

  const waiveAp = !!actor.combatBuffs?.galeComboReady
  if (!waiveAp && actor.currentAP < skill.apCost) return { ok: false, reason: 'insufficient-ap' }

  const doubleArrow = canUseDoubleArrow(actor, skill) && !!actor.combatBuffs?.doubleArrowReady
  const targets = expandRepeatedAttackTargets(skill, initialTargets)
  const isArrowSequence =
    skill.skillTreeId === 'multiShot' ||
    skill.skillTreeId === 'encircle' ||
    (!!action.targetTokenIds?.length && skill.skillTreeId === 'rageShot')

  return {
    ok: true,
    actor,
    skill,
    targets,
    targetIds,
    waiveAp,
    doubleArrow,
    isArrowSequence,
  }
}

export function canResolveSingleAttackWithHeadless(
  actor: Character,
  skill: CombatSkill,
  opts: { doubleArrow: boolean; targetCount: number },
): boolean {
  void opts.doubleArrow
  if (opts.targetCount !== 1) return false
  if (skill.remaining > 0 || skill.damageCount <= 0 || skill.damageSides <= 0) return false
  if (getSkillAoeTargeting(skill)) return false
  const buffs = actor.combatBuffs
  if (
    (buffs?.burstKickExtraD6 && skill.skillTreeId !== 'burstKick') ||
    (buffs?.windKickTreatKnockbackTargetId && skill.skillTreeId !== 'windKickCombo')
  ) {
    return false
  }
  return true
}

export type SingleAttackDisplayPlan =
  | {
      ok: false
      reason: 'invalid-attack'
    }
  | {
      ok: true
      resolved: HeadlessEventOf<'attack-resolved'>
      formula: string
      roll?: DiceRoll
      apLog: {
        amount: number
        action: string
        detail: string
      }
      combatLog: {
        text: string
        kind: 'attack' | 'damage'
      }
    }

export function planSingleAttackDisplay(input: {
  actor: Character
  skill: CombatSkill
  targetToken: Token
  events: HeadlessCombatEvent[]
}): SingleAttackDisplayPlan {
  const { actor, skill, targetToken, events } = input
  const resolved = attackResolvedEvent(events)
  if (!resolved) return { ok: false, reason: 'invalid-attack' }

  const dodgeEvent = targetDodgeResolvedEvent(events)
  const formula = resolved.hit
    ? `${resolved.damageValues.join(' + ')}${
        skill.damageBonus ? ` + ${skill.damageBonus}` : ''
      } = ${resolved.damageBeforeDefense}，攻防修正${resolved.modifier >= 0 ? '+' : '-'}${Math.abs(
        resolved.modifier,
      )}（差值${resolved.diff}），最终${resolved.total}`
    : '目标闪避成功，未造成伤害'
  const roll: DiceRoll | undefined = resolved.hit
    ? {
        values: resolved.damageValues,
        sides: skill.damageSides,
        bonus: resolved.total - resolved.diceTotal,
        total: resolved.total,
        label: `${skill.name} · headless DM`,
        formula,
        targetName: targetToken.label,
      }
    : undefined
  const dodgeText = dodgeEvent
    ? `，${targetToken.label} 闪避判定 ${dodgeEvent.d20Value}+${dodgeEvent.attackBonus}=${dodgeEvent.total} vs AC ${dodgeEvent.targetAc}，${
        dodgeEvent.dodged ? '成功' : '失败'
      }`
    : ''

  return {
    ok: true,
    resolved,
    formula,
    roll,
    apLog: {
      amount: resolved.waivedAp ? 0 : resolved.apCost,
      action: `使用 ${skill.name}`,
      detail: `目标 ${targetToken.label}`,
    },
    combatLog: {
      text: `${actor.name} 使用 ${skill.name} → ${targetToken.label}${dodgeText}，${
        resolved.hit ? `伤害 ${formula}` : formula
      }`,
      kind: resolved.hit ? 'damage' : 'attack',
    },
  }
}

export interface ArrowSequenceDisplayPlan {
  resolvedEvents: HeadlessEventOf<'attack-resolved'>[]
  roll?: DiceRoll
  combatLog: {
    text: string
    kind: 'attack' | 'damage'
  }
}

export function planArrowSequenceDisplay(input: {
  actor: Character
  skill: CombatSkill
  targets: Token[]
  events: HeadlessCombatEvent[]
  targetLabelById?: (tokenId: string) => string
}): ArrowSequenceDisplayPlan {
  const { actor, skill, targets, events, targetLabelById } = input
  const resolvedEvents = attackResolvedEvents(events)
  const damageValues = resolvedEvents.flatMap((event) => event.damageValues)
  const total = resolvedEvents.reduce((sum, event) => sum + event.total, 0)
  const diceTotal = damageValues.reduce((sum, value) => sum + value, 0)
  const roll: DiceRoll | undefined =
    damageValues.length > 0
      ? {
          values: damageValues,
          sides: skill.damageSides,
          bonus: total - diceTotal,
          total,
          label: `${skill.name} · ${resolvedEvents.length} 段`,
          formula: resolvedEvents
            .map((event, index) =>
              event.hit
                ? `第 ${index + 1} 段 ${event.damageValues.join(' + ')}，攻防修正${
                    event.modifier >= 0 ? '+' : ''
                  }${event.modifier}，最终 ${event.total}`
                : `第 ${index + 1} 段被闪避`,
            )
            .join('；'),
          targetName: targets[0]?.label ?? skill.name,
        }
      : undefined

  return {
    resolvedEvents,
    roll,
    combatLog: {
      text: `${actor.name} 使用 ${skill.name}：${resolvedEvents
        .map((event, index) =>
          event.hit
            ? `第 ${index + 1} 段→${targetLabelById?.(event.targetTokenId) ?? event.targetTokenId} ${event.total} 点`
            : `第 ${index + 1} 段被闪避`,
        )
        .join('；')}。`,
      kind: total > 0 ? 'damage' : 'attack',
    },
  }
}

export interface AoeAttackDisplayPlan {
  resolvedEvents: HeadlessEventOf<'aoe-target-resolved'>[]
  roll: DiceRoll
  combatLog: {
    text: string
    kind: 'attack' | 'damage'
  }
}

export function planAoeAttackDisplay(input: {
  actor: Character
  skill: CombatSkill
  diceValues: number[]
  cellCount: number
  targetCount: number
  events: HeadlessCombatEvent[]
  targetLabelById?: (tokenId: string) => string
}): AoeAttackDisplayPlan {
  const { actor, skill, diceValues, cellCount, targetCount, events, targetLabelById } = input
  const resolvedEvents = aoeTargetResolvedEvents(events)
  const total = resolvedEvents.reduce((sum, event) => sum + event.total, 0)
  const diceTotal = diceValues.reduce((sum, value) => sum + value, 0)
  const roll: DiceRoll = {
    values: diceValues,
    sides: skill.damageSides,
    bonus: total - diceTotal,
    total,
    label: `${skill.name} · 覆盖 ${cellCount} 格`,
    formula: `${diceValues.join(' + ')}${skill.damageBonus ? ` + ${skill.damageBonus}` : ''}`,
    targetName: resolvedEvents
      .map((event) => `${targetLabelById?.(event.targetTokenId) ?? event.targetTokenId} ${event.total}`)
      .join('，'),
  }

  return {
    resolvedEvents,
    roll,
    combatLog: {
      text: `${actor.name} 结算 ${skill.name}：覆盖 ${cellCount} 格，${targetCount} 名目标在范围内。${resolvedEvents
        .map((event) => {
          const label = targetLabelById?.(event.targetTokenId) ?? event.targetTokenId
          const saveText =
            event.saveD20 != null
              ? `，敏捷豁免 ${event.saveD20}+${event.saveMod} vs DC${event.saveDc} ${
                  event.saveSuccess ? '成功半伤' : '失败全伤'
                }`
              : ''
          return `${label} ${event.total} 点${saveText}`
        })
        .join('；')}`,
      kind: total > 0 ? 'damage' : 'attack',
    },
  }
}

function expandRepeatedAttackTargets(skill: CombatSkill, targets: Token[]): Token[] {
  if ((skill.skillTreeId === 'multiShot' || skill.skillTreeId === 'encircle') && targets.length === 1) {
    const shots = Math.max(1, skill.arrowShots ?? 1)
    return Array.from({ length: shots }, () => targets[0])
  }
  return targets
}
