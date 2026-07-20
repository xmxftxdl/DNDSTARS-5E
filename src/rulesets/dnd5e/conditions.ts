import type { AbilityKey } from '../../lib/dnd'

/** D&D 5e 2014／SRD 5.1 的标准战斗状态。力竭继续由 exhaustionLevel 单独处理。 */
export const DND5E_STANDARD_CONDITION_IDS = [
  'blinded',
  'charmed',
  'deafened',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious',
] as const

export type Dnd5eStandardConditionId = typeof DND5E_STANDARD_CONDITION_IDS[number]

export interface Dnd5eStandardConditionRule {
  id: Dnd5eStandardConditionId
  label: string
  aliases: readonly string[]
  incapacitated?: boolean
  speedZero?: boolean
  cannotMove?: boolean
  cannotSpeak?: boolean
  cannotSee?: boolean
  cannotHear?: boolean
  attackRollsDisadvantage?: boolean
  attackRollsAdvantage?: boolean
  abilityChecksDisadvantage?: boolean
  attacksAgainstHaveAdvantage?: boolean
  attacksAgainstHaveDisadvantage?: boolean
  strengthDexteritySavesAutomaticallyFail?: boolean
  dexteritySavesDisadvantage?: boolean
  hitsWithinFiveFeetAreCritical?: boolean
  special?: readonly ('cannot-attack-source' | 'cannot-approach-source' | 'crawl-or-stand' | 'drop-held-items' | 'unaware')[]
}

export const DND5E_STANDARD_CONDITIONS: Readonly<Record<Dnd5eStandardConditionId, Dnd5eStandardConditionRule>> = {
  blinded: {
    id: 'blinded', label: '目盲', aliases: ['blinded', '目盲'], cannotSee: true,
    attackRollsDisadvantage: true, attacksAgainstHaveAdvantage: true,
  },
  charmed: {
    id: 'charmed', label: '魅惑', aliases: ['charmed', '魅惑'], special: ['cannot-attack-source'],
  },
  deafened: {
    id: 'deafened', label: '耳聋', aliases: ['deafened', '耳聋'], cannotHear: true,
  },
  frightened: {
    id: 'frightened', label: '恐慌', aliases: ['frightened', '惊惧', '恐慌'], special: ['cannot-approach-source'],
  },
  grappled: {
    id: 'grappled', label: '擒抱', aliases: ['grappled', '擒抱'], speedZero: true,
  },
  incapacitated: {
    id: 'incapacitated', label: '失能', aliases: ['incapacitated', '失能'], incapacitated: true,
  },
  invisible: {
    id: 'invisible', label: '隐形', aliases: ['invisible', '隐形'],
    attackRollsAdvantage: true, attacksAgainstHaveDisadvantage: true,
  },
  paralyzed: {
    id: 'paralyzed', label: '麻痹', aliases: ['paralyzed', '麻痹'], incapacitated: true,
    cannotMove: true, cannotSpeak: true, attacksAgainstHaveAdvantage: true,
    strengthDexteritySavesAutomaticallyFail: true, hitsWithinFiveFeetAreCritical: true,
  },
  petrified: {
    id: 'petrified', label: '石化', aliases: ['petrified', '石化'], incapacitated: true,
    cannotMove: true, cannotSpeak: true, attacksAgainstHaveAdvantage: true,
    strengthDexteritySavesAutomaticallyFail: true, hitsWithinFiveFeetAreCritical: true,
  },
  poisoned: {
    id: 'poisoned', label: '中毒', aliases: ['poisoned', '中毒'],
    attackRollsDisadvantage: true, abilityChecksDisadvantage: true,
  },
  prone: {
    id: 'prone', label: '倒地', aliases: ['prone', '倒地'],
    attackRollsDisadvantage: true, special: ['crawl-or-stand'],
  },
  restrained: {
    id: 'restrained', label: '束缚', aliases: ['restrained', '束缚'], speedZero: true,
    attackRollsDisadvantage: true, attacksAgainstHaveAdvantage: true, dexteritySavesDisadvantage: true,
  },
  stunned: {
    id: 'stunned', label: '震慑', aliases: ['stunned', '震慑'], incapacitated: true,
    cannotMove: true, cannotSpeak: true, attacksAgainstHaveAdvantage: true,
    strengthDexteritySavesAutomaticallyFail: true,
  },
  unconscious: {
    id: 'unconscious', label: '昏迷', aliases: ['unconscious', '昏迷'], incapacitated: true,
    cannotMove: true, cannotSpeak: true, attacksAgainstHaveAdvantage: true,
    strengthDexteritySavesAutomaticallyFail: true, hitsWithinFiveFeetAreCritical: true,
    special: ['drop-held-items', 'unaware'],
  },
}

const CONDITION_BY_ALIAS = new Map<string, Dnd5eStandardConditionId>()
for (const condition of Object.values(DND5E_STANDARD_CONDITIONS)) {
  CONDITION_BY_ALIAS.set(condition.id, condition.id)
  CONDITION_BY_ALIAS.set(condition.label, condition.id)
  for (const alias of condition.aliases) CONDITION_BY_ALIAS.set(alias.trim().toLowerCase(), condition.id)
}

export function dnd5eStandardConditionId(value: string | undefined): Dnd5eStandardConditionId | undefined {
  return value ? CONDITION_BY_ALIAS.get(value.trim().toLowerCase()) : undefined
}

export function dnd5eConditionLabel(value: string): string {
  const condition = dnd5eStandardConditionId(value)
  return condition ? DND5E_STANDARD_CONDITIONS[condition].label : value
}

export function dnd5eHasStandardCondition(
  creature: { conditions?: readonly string[] },
  condition: Dnd5eStandardConditionId,
): boolean {
  return (creature.conditions ?? []).some((value) => dnd5eStandardConditionId(value) === condition)
}

export function dnd5eActiveStandardConditions(
  creature: { conditions?: readonly string[] },
): readonly Dnd5eStandardConditionId[] {
  return [...new Set((creature.conditions ?? []).flatMap((value) => {
    const condition = dnd5eStandardConditionId(value)
    return condition ? [condition] : []
  }))]
}

export interface Dnd5eStandardConditionMutation {
  ok: boolean
  conditions: string[]
  reason?: 'condition-immune'
}

/**
 * DM 权威状态标签编辑使用的纯函数。
 *
 * - 标准状态统一保存为稳定英文 ID，避免中文别名和英文 ID 重复叠加。
 * - 不认识的插件状态原样保留，状态面板不会误删规则包扩展。
 * - 免疫只阻止新增；DM 仍可移除历史遗留的无效状态。
 */
export function setDnd5eStandardCondition(input: {
  conditions?: readonly string[]
  condition: Dnd5eStandardConditionId
  active: boolean
  conditionImmunities?: readonly string[]
}): Dnd5eStandardConditionMutation {
  const normalized: string[] = []
  const seen = new Set<string>()
  for (const value of input.conditions ?? []) {
    const standard = dnd5eStandardConditionId(value)
    const next = standard ?? value
    const key = standard ? `standard:${standard}` : `extension:${value}`
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(next)
  }

  const alreadyActive = normalized.includes(input.condition)
  const immune = (input.conditionImmunities ?? [])
    .some((value) => dnd5eStandardConditionId(value) === input.condition)
  if (input.active && !alreadyActive && immune) {
    return { ok: false, reason: 'condition-immune', conditions: normalized }
  }

  const withoutCondition = normalized.filter((value) => dnd5eStandardConditionId(value) !== input.condition)
  return {
    ok: true,
    conditions: input.active ? [...withoutCondition, input.condition] : withoutCondition,
  }
}

export function dnd5eConditionIncapacitated(creature: { conditions?: readonly string[] }): boolean {
  return dnd5eActiveStandardConditions(creature)
    .some((condition) => DND5E_STANDARD_CONDITIONS[condition].incapacitated === true)
}

export function dnd5eConditionSetsSpeedToZero(creature: { conditions?: readonly string[] }): boolean {
  return dnd5eActiveStandardConditions(creature)
    .some((condition) => DND5E_STANDARD_CONDITIONS[condition].speedZero === true || DND5E_STANDARD_CONDITIONS[condition].cannotMove === true)
}

export function dnd5eConditionImposesAttackDisadvantage(input: {
  attacker: { conditions?: readonly string[] }
  targetDistanceFeet?: number
  frighteningSourceVisible?: boolean
}): boolean {
  const active = dnd5eActiveStandardConditions(input.attacker)
  if (active.some((condition) => DND5E_STANDARD_CONDITIONS[condition].attackRollsDisadvantage === true)) return true
  return active.includes('frightened') && input.frighteningSourceVisible === true
}

export function dnd5eConditionGrantsAttackAdvantage(input: {
  target: { conditions?: readonly string[] }
  distanceFeet?: number
}): boolean {
  const active = dnd5eActiveStandardConditions(input.target)
  if (active.some((condition) => DND5E_STANDARD_CONDITIONS[condition].attacksAgainstHaveAdvantage === true)) return true
  return active.includes('prone') && (input.distanceFeet ?? Number.POSITIVE_INFINITY) <= 5
}

export function dnd5eConditionImposesAttackDisadvantageAgainstTarget(input: {
  target: { conditions?: readonly string[] }
  distanceFeet?: number
}): boolean {
  if (dnd5eActiveStandardConditions(input.target)
    .some((condition) => DND5E_STANDARD_CONDITIONS[condition].attacksAgainstHaveDisadvantage === true)) return true
  return dnd5eHasStandardCondition(input.target, 'prone') &&
    (input.distanceFeet ?? Number.POSITIVE_INFINITY) > 5
}

export function dnd5eConditionGrantsAttackAdvantageToAttacker(
  attacker: { conditions?: readonly string[] },
): boolean {
  return dnd5eActiveStandardConditions(attacker)
    .some((condition) => DND5E_STANDARD_CONDITIONS[condition].attackRollsAdvantage === true)
}

export function dnd5eConditionSavingThrowDisadvantage(
  creature: { conditions?: readonly string[] },
  ability: AbilityKey,
): boolean {
  return ability === 'dex' && dnd5eHasStandardCondition(creature, 'restrained')
}

export function dnd5eConditionSavingThrowAutomaticallyFails(
  creature: { conditions?: readonly string[] },
  ability: AbilityKey,
): boolean {
  if (ability !== 'str' && ability !== 'dex') return false
  return dnd5eActiveStandardConditions(creature)
    .some((condition) => DND5E_STANDARD_CONDITIONS[condition].strengthDexteritySavesAutomaticallyFail === true)
}

export function dnd5eConditionAbilityCheckDisadvantage(creature: { conditions?: readonly string[] }): boolean {
  return dnd5eActiveStandardConditions(creature)
    .some((condition) => DND5E_STANDARD_CONDITIONS[condition].abilityChecksDisadvantage === true)
}

export function dnd5eConditionHitIsAutomaticCritical(input: {
  target: { conditions?: readonly string[] }
  distanceFeet: number
}): boolean {
  if (input.distanceFeet > 5) return false
  return dnd5eActiveStandardConditions(input.target)
    .some((condition) => DND5E_STANDARD_CONDITIONS[condition].hitsWithinFiveFeetAreCritical === true)
}

export function dnd5eConditionPreventsAttackingSource(input: {
  attacker: { conditions?: readonly string[] }
  targetId: string
  sourceIdsByCondition?: Partial<Record<Dnd5eStandardConditionId, readonly string[]>>
}): boolean {
  return dnd5eHasStandardCondition(input.attacker, 'charmed') &&
    (input.sourceIdsByCondition?.charmed ?? []).includes(input.targetId)
}

export function dnd5eConditionPreventsApproachingSource(input: {
  mover: { conditions?: readonly string[] }
  sourceId: string
  sourceIdsByCondition?: Partial<Record<Dnd5eStandardConditionId, readonly string[]>>
  destinationIsCloser: boolean
}): boolean {
  return input.destinationIsCloser && dnd5eHasStandardCondition(input.mover, 'frightened') &&
    (input.sourceIdsByCondition?.frightened ?? []).includes(input.sourceId)
}
