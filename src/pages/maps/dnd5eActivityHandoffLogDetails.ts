import type { Dnd5eActivityDefinitionV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityContracts'
import type { Dnd5eFormulaV1 } from '../../rulesets/dnd5e/activities/dnd5eFormula'
import type { Dnd5eCombatEvent } from '../../application/combat/dnd5eCombatRules'
import type { Dnd5ePluginDiceRollResult } from '../../rulesets/dnd5e/pluginApi'

export interface Dnd5eActivityMapObjectLockLogDetail {
  mode: 'arcane-lock' | 'knock'
  suppressionMinutes?: number
}

function activityFormulaValue(
  formula: Dnd5eFormulaV1,
  rolls: Readonly<Record<string, Dnd5ePluginDiceRollResult>>,
): number | undefined {
  if (formula.kind === 'constant') return formula.value
  if (formula.kind === 'reference') return undefined
  if (formula.kind === 'dice') {
    const roll = rolls[formula.rollId]
    return roll?.values.length === formula.count
      ? roll.values.reduce((total, value) => total + value, 0)
      : undefined
  }
  if (formula.kind === 'floor' || formula.kind === 'ceil' || formula.kind === 'round') {
    const value = activityFormulaValue(formula.value, rolls)
    if (value == null) return undefined
    return formula.kind === 'floor' ? Math.floor(value) : formula.kind === 'ceil' ? Math.ceil(value) : Math.round(value)
  }
  if (formula.kind === 'clamp') {
    const value = activityFormulaValue(formula.value, rolls)
    if (value == null) return undefined
    return Math.min(formula.maximum ?? Number.POSITIVE_INFINITY, Math.max(formula.minimum ?? Number.NEGATIVE_INFINITY, value))
  }
  if (!('values' in formula)) return undefined
  const values = formula.values.map((entry) => activityFormulaValue(entry, rolls))
  if (values.some((value) => value == null)) return undefined
  const resolved = values as number[]
  if (formula.kind === 'add') return resolved.reduce((total, value) => total + value, 0)
  if (formula.kind === 'multiply') return resolved.reduce((total, value) => total * value, 1)
  if (formula.kind === 'minimum') return Math.min(...resolved)
  return Math.max(...resolved)
}

function activityFormulaLabel(formula: Dnd5eFormulaV1): string {
  if (formula.kind === 'constant') return String(formula.value)
  if (formula.kind === 'reference') return formula.reference.kind
  if (formula.kind === 'dice') return `${formula.count}d${formula.sides}`
  if (formula.kind === 'floor' || formula.kind === 'ceil' || formula.kind === 'round') {
    return `${formula.kind}(${activityFormulaLabel(formula.value)})`
  }
  if (formula.kind === 'clamp') return `clamp(${activityFormulaLabel(formula.value)})`
  if (!('values' in formula)) return formula.kind
  const separator = formula.kind === 'add' ? ' + ' : formula.kind === 'multiply' ? ' × ' : formula.kind === 'minimum' ? ', min ' : ', max '
  return formula.values.map(activityFormulaLabel).join(separator)
}

export interface Dnd5eActivityExtraTurnRollResult {
  formula: string
  turns: number
}

export function dnd5eActivityExtraTurnRollResult(
  activity: Dnd5eActivityDefinitionV1 | undefined,
  rolls: Readonly<Record<string, Dnd5ePluginDiceRollResult>> | undefined,
): Dnd5eActivityExtraTurnRollResult | undefined {
  if (!activity || !rolls) return undefined
  const operation = activity.outcomes.flatMap((outcome) => outcome.operations)
    .find((candidate) => candidate.kind === 'grant-extra-turns')
  if (!operation || operation.kind !== 'grant-extra-turns') return undefined
  const turns = activityFormulaValue(operation.turns, rolls)
  return turns == null ? undefined : {
    formula: activityFormulaLabel(operation.turns),
    turns: Math.max(0, Math.floor(turns)),
  }
}

export function dnd5eActivityRollLogDetails(
  activity: Dnd5eActivityDefinitionV1 | undefined,
  rolls: Readonly<Record<string, Dnd5ePluginDiceRollResult>> | undefined,
  events: readonly Dnd5eCombatEvent[] = [],
): string[] {
  const rollDetails = Object.entries(rolls ?? {}).map(([rollId, roll]) => {
    const check = activity?.checks?.find((candidate) =>
      rollId === candidate.rollId || rollId.startsWith(`${candidate.rollId}:`) ||
      (candidate.kind === 'opposed-ability-check' &&
        (rollId === candidate.opposedRollId || rollId.startsWith(`${candidate.opposedRollId}:`))))
    if (check?.kind === 'opposed-ability-check') {
      const sourceRoll = rollId === check.rollId || rollId.startsWith(`${check.rollId}:`)
      const rollBaseId = sourceRoll ? check.rollId : check.opposedRollId
      const targetId = rollId.startsWith(`${rollBaseId}:`)
        ? rollId.slice(rollBaseId.length + 1)
        : undefined
      const settled = events.find((event) =>
        event.type === 'opposed-ability-check-resolved' &&
        event.activityId === activity?.id && event.checkId === check.id &&
        (targetId == null || event.targetId === targetId))
      const candidates = roll.values.join(' / ')
      if (settled?.type === 'opposed-ability-check-resolved') {
        const d20 = sourceRoll ? settled.sourceD20 : settled.targetD20
        const modifierValue = sourceRoll ? settled.sourceModifier : settled.targetModifier
        const total = sourceRoll ? settled.sourceTotal : settled.targetTotal
        const side = sourceRoll ? '主动方' : '目标方'
        const modifier = modifierValue === 0
          ? '+ 0'
          : `${modifierValue > 0 ? '+' : '-'} ${Math.abs(modifierValue)}`
        const outcome = sourceRoll
          ? `；对抗 ${settled.sourceTotal} vs ${settled.targetTotal}｜${settled.success ? '成功' : '失败'}`
          : ''
        return `Activity 对抗骰据：${rollId}｜候选 ${candidates}｜${side}采用 ${d20} ${modifier} = ${total}${outcome}`
      }
      return `Activity 对抗骰据：${rollId}｜候选 ${candidates}｜最终采用值见对抗结算`
    }
    if (check?.kind === 'attack-roll' || check?.kind === 'saving-throw') {
      const targetId = rollId.startsWith(`${check.rollId}:`)
        ? rollId.slice(check.rollId.length + 1)
        : undefined
      const settled = check.kind === 'attack-roll'
        ? events.find((event) => event.type === 'attack-resolved' &&
            (targetId == null || event.targetId === targetId))
        : events.find((event) => event.type === 'saving-throw-resolved' &&
            (targetId == null || event.targetId === targetId))
      const candidates = roll.values.join(' / ')
      if (settled?.type === 'attack-resolved' || settled?.type === 'saving-throw-resolved') {
        const authoritativeModifier = settled.total - settled.d20
        const modifier = authoritativeModifier === 0
          ? '+ 0'
          : `${authoritativeModifier > 0 ? '+' : '-'} ${Math.abs(authoritativeModifier)}`
        return `Activity d20 骰据：${rollId}｜候选 ${candidates}｜采用 ${settled.d20} ${modifier} = ${settled.total}`
      }
      return `Activity d20 骰据：${rollId}｜候选 ${candidates}｜最终采用值见命中/豁免结算`
    }
    if (
      check?.kind === 'ability-check' || check?.kind === 'skill-check' ||
      check?.kind === 'concentration-check'
    ) {
      const targetId = rollId.startsWith(`${check.rollId}:`)
        ? rollId.slice(check.rollId.length + 1)
        : undefined
      const settled = events.find((event) =>
        event.type === 'ability-check-resolved' &&
        (targetId == null || event.perceivedTargetId === targetId))
      const candidates = roll.values.join(' / ')
      if (settled?.type === 'ability-check-resolved') {
        const modifier = settled.modifier === 0
          ? '+ 0'
          : `${settled.modifier > 0 ? '+' : '-'} ${Math.abs(settled.modifier)}`
        const outcome = settled.dc == null
          ? ''
          : `；对抗 DC ${settled.dc}｜${settled.success ? '成功' : '失败'}`
        return `Activity 检定骰据：${rollId}｜候选 ${candidates}｜采用 ${settled.d20} ${modifier} = ${settled.total}${outcome}`
      }
      return `Activity 检定骰据：${rollId}｜候选 ${candidates}｜最终采用值见能力检定结算`
    }
    const modifier = roll.modifier === 0 ? '' : ` ${roll.modifier > 0 ? '+' : '-'} ${Math.abs(roll.modifier)}`
    return `Activity 骰据：${rollId}｜${roll.values.join(' + ')}${modifier} = ${roll.total}`
  })
  const extraTurns = dnd5eActivityExtraTurnRollResult(activity, rolls)
  return extraTurns
    ? [...rollDetails, `额外回合：${extraTurns.formula} = ${extraTurns.turns} 回合`]
    : rollDetails
}

export interface Dnd5eActivityMovementLogDetail {
  targetId: string
  mode: 'push' | 'pull' | 'teleport' | 'swap' | 'ascend' | 'descend'
  distanceFeet: number
}

export function dnd5eActivityChoicesFromPayload(payload: unknown): Record<string, string> | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined
  const activityChoices = (payload as Record<string, unknown>).activityChoices
  if (!activityChoices || typeof activityChoices !== 'object' || Array.isArray(activityChoices)) return undefined
  const choices = Object.fromEntries(
    Object.entries(activityChoices).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
  return Object.keys(choices).length > 0 ? choices : undefined
}

export function dnd5eActivityChoiceLogDetails(
  activity: {
    choices?: readonly {
      id: string
      label: string
      options: readonly { id: string; label: string }[]
      defaultOptionId?: string
    }[]
  } | undefined,
  choices: Readonly<Record<string, string>> | undefined,
): string[] {
  return (activity?.choices ?? []).flatMap((choice) => {
    const selectedId = choices?.[choice.id] ?? choice.defaultOptionId
    const selected = choice.options.find((option) => option.id === selectedId)
    return selected ? [`Activity 选项：${choice.label}｜${selected.label}（${selected.id}）`] : []
  })
}

/**
 * Map handoffs are committed outside the combat-event reducer, so expose the
 * rule-significant result beside the ordinary Headless event evidence.
 */
export function dnd5eActivityHandoffLogDetails(input: {
  mapObjectLocks?: readonly Dnd5eActivityMapObjectLockLogDetail[]
  movements?: readonly Dnd5eActivityMovementLogDetail[]
  targetLabelsById?: Readonly<Record<string, string>>
  targetElevationsFeetById?: Readonly<Record<string, number>>
} | undefined): string[] {
  const lockDetails = (input?.mapObjectLocks ?? []).map((lock) => {
    if (lock.mode === 'arcane-lock') return '地图物件锁：施加秘法锁'
    const suppressionMinutes = Number.isFinite(lock.suppressionMinutes)
      ? Math.max(1, Math.floor(lock.suppressionMinutes!))
      : 10
    return `地图物件锁：解除一个普通锁；若为秘法锁则压制 ${suppressionMinutes} 分钟`
  })
  const verticalMovementDetails = (input?.movements ?? []).flatMap((movement) => {
    if (movement.mode !== 'ascend' && movement.mode !== 'descend') return []
    const distanceFeet = Number.isFinite(movement.distanceFeet)
      ? Math.max(0, Math.floor(movement.distanceFeet))
      : 0
    const label = input?.targetLabelsById?.[movement.targetId] ?? movement.targetId
    const currentElevation = input?.targetElevationsFeetById?.[movement.targetId]
    const elevationDetail = Number.isFinite(currentElevation)
      ? `｜当前高度 ${Math.max(0, Math.floor(currentElevation!))} 尺`
      : ''
    return [`地图垂直位移：${label}｜${movement.mode === 'ascend' ? '上升' : '下降'} ${distanceFeet} 尺${elevationDetail}`]
  })
  return [...lockDetails, ...verticalMovementDetails]
}
