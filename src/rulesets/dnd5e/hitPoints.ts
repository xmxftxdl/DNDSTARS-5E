import type { Character } from '../../types/character'

export const DND5E_2014_RULESET_ID = 'dnd5e-2014-srd-5.1' as const

export type Dnd5eHitPointMaximumMode = 'fixed' | 'manual'

export interface Dnd5eClassHitPointRule {
  hitDieSides: number
  fixedHitPointsPerLevel: number
}

export interface Dnd5eShortRestHitDieSpend {
  poolIndex: number
  rolls: readonly number[]
}

export interface Dnd5eShortRestHitDiceResult {
  character: Character
  hitDiceSpent: number
  hitDiceHealing: number
  songOfRestHealing: number
  healingApplied: number
}

const CLASS_HIT_POINT_RULES: Readonly<Record<string, Dnd5eClassHitPointRule>> = {
  野蛮人: { hitDieSides: 12, fixedHitPointsPerLevel: 7 },
  吟游诗人: { hitDieSides: 8, fixedHitPointsPerLevel: 5 },
  牧师: { hitDieSides: 8, fixedHitPointsPerLevel: 5 },
  德鲁伊: { hitDieSides: 8, fixedHitPointsPerLevel: 5 },
  战士: { hitDieSides: 10, fixedHitPointsPerLevel: 6 },
  武僧: { hitDieSides: 8, fixedHitPointsPerLevel: 5 },
  圣武士: { hitDieSides: 10, fixedHitPointsPerLevel: 6 },
  游侠: { hitDieSides: 10, fixedHitPointsPerLevel: 6 },
  游荡者: { hitDieSides: 8, fixedHitPointsPerLevel: 5 },
  术士: { hitDieSides: 6, fixedHitPointsPerLevel: 4 },
  邪术师: { hitDieSides: 8, fixedHitPointsPerLevel: 5 },
  法师: { hitDieSides: 6, fixedHitPointsPerLevel: 4 },
}

function clampLevel(level: number): number {
  return Math.min(20, Math.max(1, Math.floor(Number(level) || 1)))
}

function parseHitDieSides(value: string | undefined): number {
  const match = value?.trim().match(/^\d*d(\d+)$/i)
  const parsed = Number(match?.[1])
  return Number.isFinite(parsed) && parsed >= 2 ? Math.floor(parsed) : 8
}

function abilityModifier(score: number): number {
  return Math.floor((Math.min(30, Math.max(1, Math.floor(Number(score) || 10))) - 10) / 2)
}

export function isDnd5e2014Character(character: Pick<Character, 'rulesetId'>): boolean {
  return character.rulesetId === DND5E_2014_RULESET_ID
}

/**
 * 原始斗士改变的是实际属性值而不是临时加值，因此持久化一次性标记。
 * 角色从20级降回19级或改换职业时撤销同一笔+4，避免多端同步反复叠加。
 */
export function syncDnd5ePrimalChampion(character: Character): Character {
  if (!isDnd5e2014Character(character)) return character
  const shouldApply = character.charClass === '野蛮人' && clampLevel(character.level) >= 20
  const applied = character.dnd5ePrimalChampionApplied === true
  if (shouldApply === applied) return character
  const delta = shouldApply ? 4 : -4
  const maximum = shouldApply ? 24 : 20
  return {
    ...character,
    abilities: {
      ...character.abilities,
      str: Math.min(maximum, Math.max(1, Math.floor(character.abilities.str) + delta)),
      con: Math.min(maximum, Math.max(1, Math.floor(character.abilities.con) + delta)),
    },
    dnd5ePrimalChampionApplied: shouldApply || undefined,
  }
}

export function dnd5eClassHitPointRule(
  character: Pick<Character, 'charClass' | 'hitDice'>,
): Dnd5eClassHitPointRule {
  const known = CLASS_HIT_POINT_RULES[character.charClass]
  if (known) return known
  const hitDieSides = parseHitDieSides(character.hitDice)
  return { hitDieSides, fixedHitPointsPerLevel: Math.floor(hitDieSides / 2) + 1 }
}

/**
 * 2014 单职业固定生命值方案：1 级取完整职业生命骰，之后使用职业固定值；
 * 每一级都加入体质调整值，并保证该级至少获得 1 点生命值。
 */
export function dnd5eFixedMaxHp(
  character: Pick<Character, 'charClass' | 'hitDice' | 'level' | 'abilities' | 'dnd5eClassChoices'>,
): number {
  const level = clampLevel(character.level)
  const rule = dnd5eClassHitPointRule(character)
  const constitutionModifier = abilityModifier(character.abilities.con)
  const firstLevel = Math.max(1, rule.hitDieSides + constitutionModifier)
  const laterLevel = Math.max(1, rule.fixedHitPointsPerLevel + constitutionModifier)
  const draconicResilience = character.charClass === '术士' &&
    character.dnd5eClassChoices?.classes?.sorcerer?.subclass === 'draconic'
    ? level
    : 0
  return firstLevel + (level - 1) * laterLevel + draconicResilience
}

export function dnd5eRolledMaxHpRange(
  character: Pick<Character, 'charClass' | 'hitDice' | 'level' | 'abilities' | 'dnd5eClassChoices'>,
): { minimum: number; maximum: number } {
  const level = clampLevel(character.level)
  const rule = dnd5eClassHitPointRule(character)
  const constitutionModifier = abilityModifier(character.abilities.con)
  const firstLevel = Math.max(1, rule.hitDieSides + constitutionModifier)
  const draconicResilience = character.charClass === '术士' &&
    character.dnd5eClassChoices?.classes?.sorcerer?.subclass === 'draconic'
    ? level
    : 0
  return {
    minimum: firstLevel + (level - 1) * Math.max(1, 1 + constitutionModifier) + draconicResilience,
    maximum: firstLevel + (level - 1) * Math.max(1, rule.hitDieSides + constitutionModifier) + draconicResilience,
  }
}

/**
 * Old saves did not record whether HP was fixed or rolled. Preserve any plausible rolled total;
 * impossible values (for example a level-12 fighter with 1 HP maximum) migrate to fixed HP.
 */
export function dnd5eHitPointMaximumMode(
  character: Pick<Character, 'charClass' | 'hitDice' | 'level' | 'abilities' | 'maxHp' | 'hitPointMaximumMode' | 'dnd5eClassChoices'>,
): Dnd5eHitPointMaximumMode {
  if (character.hitPointMaximumMode === 'fixed' || character.hitPointMaximumMode === 'manual') {
    return character.hitPointMaximumMode
  }
  const currentMaximum = Math.max(1, Math.floor(Number(character.maxHp) || 1))
  const fixedMaximum = dnd5eFixedMaxHp(character)
  const rolledRange = dnd5eRolledMaxHpRange(character)
  return currentMaximum === fixedMaximum || currentMaximum < rolledRange.minimum || currentMaximum > rolledRange.maximum
    ? 'fixed'
    : 'manual'
}

function syncHitPointDice(
  character: Pick<Character, 'level' | 'hitPointDice'>,
  hitDieSides: number,
): Array<{ sides: number; current: number; max: number }> {
  const level = clampLevel(character.level)
  const existing = character.hitPointDice?.length === 1 && character.hitPointDice[0].sides === hitDieSides
    ? character.hitPointDice[0]
    : undefined
  if (!existing) return [{ sides: hitDieSides, current: level, max: level }]

  const previousMaximum = Math.max(0, Math.floor(Number(existing.max) || 0))
  const previousCurrent = Math.min(previousMaximum, Math.max(0, Math.floor(Number(existing.current) || 0)))
  const current = level > previousMaximum
    ? Math.min(level, previousCurrent + (level - previousMaximum))
    : Math.min(level, previousCurrent)
  return [{ sides: hitDieSides, current, max: level }]
}

export function syncDnd5eHitPoints(inputCharacter: Character): Character {
  if (!isDnd5e2014Character(inputCharacter)) return inputCharacter
  const character = syncDnd5ePrimalChampion(inputCharacter)

  const level = clampLevel(character.level)
  const rule = dnd5eClassHitPointRule(character)
  const mode = dnd5eHitPointMaximumMode(character)
  const previousMaximum = Math.max(1, Math.floor(Number(character.maxHp) || 1))
  const maxHp = mode === 'fixed'
    ? dnd5eFixedMaxHp({ ...character, level })
    : previousMaximum
  const previousCurrent = Math.max(0, Math.floor(Number(character.currentHp) || 0))
  const currentHp = previousCurrent > 0 && maxHp > previousMaximum
    ? Math.min(maxHp, previousCurrent + (maxHp - previousMaximum))
    : Math.min(maxHp, previousCurrent)

  return {
    ...character,
    level,
    maxHp,
    currentHp,
    hitDice: `${level}d${rule.hitDieSides}`,
    hitPointDice: syncHitPointDice(character, rule.hitDieSides),
    hitPointMaximumMode: mode,
  }
}

/**
 * SRD 5.1 短休生命骰结算。每枚生命骰分别加入体质调整值（最低恢复 0），
 * 同一次短休若至少花费一枚生命骰，休憩曲只额外结算一次。
 */
export function resolveDnd5eShortRestHitDice(input: {
  character: Character
  spends: readonly Dnd5eShortRestHitDieSpend[]
  songOfRest?: { dieSides: 6 | 8 | 10 | 12; roll: number }
}): Dnd5eShortRestHitDiceResult {
  if (!isDnd5e2014Character(input.character)) throw new RangeError('Character is not using D&D 5e 2014')
  const pools = input.character.hitPointDice?.map((pool) => ({
    sides: Math.max(2, Math.floor(pool.sides)),
    current: Math.max(0, Math.floor(pool.current)),
    max: Math.max(0, Math.floor(pool.max)),
  })) ?? []
  const spentByPool = new Map<number, number>()
  let hitDiceSpent = 0
  let hitDiceHealing = 0
  const constitutionModifier = abilityModifier(input.character.abilities.con)

  for (const spend of input.spends) {
    if (!Number.isInteger(spend.poolIndex) || spend.poolIndex < 0 || spend.poolIndex >= pools.length) {
      throw new RangeError('Unknown Hit Die pool')
    }
    const pool = pools[spend.poolIndex]
    const alreadySpent = spentByPool.get(spend.poolIndex) ?? 0
    if (spend.rolls.length < 1 || alreadySpent + spend.rolls.length > pool.current) {
      throw new RangeError('Not enough Hit Dice')
    }
    for (const roll of spend.rolls) {
      if (!Number.isInteger(roll) || roll < 1 || roll > pool.sides) throw new RangeError('Invalid Hit Die roll')
      hitDiceHealing += Math.max(0, roll + constitutionModifier)
      hitDiceSpent += 1
    }
    spentByPool.set(spend.poolIndex, alreadySpent + spend.rolls.length)
  }
  if (hitDiceSpent < 1) throw new RangeError('At least one Hit Die must be spent')

  let songOfRestHealing = 0
  if (input.songOfRest) {
    const { dieSides, roll } = input.songOfRest
    if (![6, 8, 10, 12].includes(dieSides) || !Number.isInteger(roll) || roll < 1 || roll > dieSides) {
      throw new RangeError('Invalid Song of Rest roll')
    }
    songOfRestHealing = roll
  }
  for (const [poolIndex, spent] of spentByPool) {
    pools[poolIndex] = { ...pools[poolIndex], current: pools[poolIndex].current - spent }
  }
  const currentHp = Math.max(0, Math.floor(input.character.currentHp))
  const maxHp = Math.max(1, Math.floor(input.character.maxHp))
  const nextHp = Math.min(maxHp, currentHp + hitDiceHealing + songOfRestHealing)

  return {
    character: { ...input.character, currentHp: nextHp, hitPointDice: pools },
    hitDiceSpent,
    hitDiceHealing,
    songOfRestHealing,
    healingApplied: nextHp - currentHp,
  }
}
