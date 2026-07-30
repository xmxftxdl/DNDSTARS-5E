import type { Character } from '../../types/character'
import {
  dnd5eCharacterClassLevel,
  dnd5eEffectiveSpellcastingSources,
  dnd5eSpellDamageDiceCounts,
  dnd5eSpellDelayedDamageDiceCount,
  dnd5eSpellProjectileCount,
  dnd5eSpellUsesSequencedAttacks,
  getDnd5eSrdCombatSpell,
  type Dnd5eSrdSpellDefinition,
} from '../../rulesets/dnd5e'
import { dnd5e2014Adapter as rules } from '../../rulesets/dnd5e/dnd5e2014Adapter'
import { DND5E_DAMAGE_TYPE_LABELS } from '../../rulesets/dnd5e/damageTypes'

export interface Dnd5eCombatSpellDamagePreview {
  slotLevel: number
  summary: string
  featureBonuses: readonly string[]
}

function signedBonus(value: number): string {
  if (value === 0) return ''
  return value > 0 ? `+${value}` : `${value}`
}

function diceFormula(count: number, sides: number, bonus = 0): string {
  return `${count}d${sides}${signedBonus(bonus)}`
}

function spellcastingModifier(
  character: Character,
  castingClassId: string,
): number {
  const source = dnd5eEffectiveSpellcastingSources(character)
    .find((candidate) => candidate.classId === castingClassId)
  const ability = source?.definition.spellcasting?.ability
  return ability ? rules.abilityModifier(character.abilities[ability]) : 0
}

function spellDamageFeatureBonuses(
  character: Character,
  castingClassId: string,
  spell: Dnd5eSrdSpellDefinition,
): {
  perDamageRoll: number
  once: number
  labels: string[]
} {
  const modifier = spellcastingModifier(character, castingClassId)
  const classChoices = character.dnd5eClassChoices?.classes
  const labels: string[] = []
  let perDamageRoll = 0
  let once = 0

  const invocations = classChoices?.warlock?.selections?.['eldritch-invocations'] ?? []
  if (
    spell.id === 'eldritch-blast' &&
    dnd5eCharacterClassLevel(character, 'warlock') >= 1 &&
    invocations.includes('agonizing-blast')
  ) {
    perDamageRoll += modifier
    labels.push(`痛苦魔爆 ${signedBonus(modifier)}（每道命中）`)
  }

  if (
    castingClassId === 'wizard' &&
    dnd5eCharacterClassLevel(character, 'wizard') >= 10 &&
    classChoices?.wizard?.subclass === 'evocation' &&
    spell.school === '塑能'
  ) {
    const bonus = Math.max(0, rules.abilityModifier(character.abilities.int))
    once += bonus
    labels.push(`强化塑能 +${bonus}（一次伤害掷骰）`)
  }

  const dragonAncestor = classChoices?.sorcerer?.selections?.['dragon-ancestor']?.[0]
  if (
    castingClassId === 'sorcerer' &&
    dnd5eCharacterClassLevel(character, 'sorcerer') >= 6 &&
    classChoices?.sorcerer?.subclass === 'draconic' &&
    dragonAncestor?.split('-').at(-1) === spell.damageType
  ) {
    const bonus = Math.max(0, rules.abilityModifier(character.abilities.cha))
    once += bonus
    labels.push(`元素亲和 +${bonus}（一次伤害掷骰）`)
  }

  return { perDamageRoll, once, labels }
}

/**
 * Returns the damage declaration the Host will use for a core spell at the
 * selected slot. It intentionally describes dice rather than expected damage.
 */
export function dnd5eCombatSpellDamagePreview(
  character: Character,
  castingClassId: string,
  spellId: string,
  slotLevel: number,
): Dnd5eCombatSpellDamagePreview | undefined {
  const spell = getDnd5eSrdCombatSpell(spellId)
  if (!spell || !Number.isInteger(slotLevel) || slotLevel < spell.level) return undefined

  const damageDiceCounts = dnd5eSpellDamageDiceCounts(
    spell,
    character.level,
    slotLevel,
  )
  const primaryDiceCount = damageDiceCounts[0] ?? 0
  const hasPrimaryDamage = spell.damageType != null && primaryDiceCount > 0
  const hasAdditionalDamage = (spell.additionalDamageComponents?.length ?? 0) > 0
  const delayedDiceCount = dnd5eSpellDelayedDamageDiceCount(spell, slotLevel)
  const sustainedDiceCount = spell.sustainedAttack
    ? spell.sustainedAttack.dice.count + Math.floor(
        Math.max(0, slotLevel - spell.level) /
        Math.max(1, spell.sustainedAttack.dice.additionalDieEverySlotLevels ?? 1),
      )
    : 0
  if (!hasPrimaryDamage && !hasAdditionalDamage && delayedDiceCount < 1 && sustainedDiceCount < 1) {
    return undefined
  }

  const typeLabel = spell.damageType ? DND5E_DAMAGE_TYPE_LABELS[spell.damageType] : ''
  const castingModifier = spellcastingModifier(character, castingClassId)
  const features = spellDamageFeatureBonuses(character, castingClassId, spell)
  const standardBonus = spell.dice.bonus +
    (spell.bonusPerDie ? primaryDiceCount : 0) +
    (spell.addSpellcastingModifier ? castingModifier : 0) +
    features.perDamageRoll
  const summaries: string[] = []

  if (spell.id === 'magic-missile') {
    const projectileCount = dnd5eSpellProjectileCount(spell, character.level, slotLevel) ?? primaryDiceCount
    const totalBonus = projectileCount + features.once
    summaries.push(
      `${projectileCount}枚飞弹，每枚1d4+1${typeLabel}伤害；合计${diceFormula(projectileCount, 4, totalBonus)}`,
    )
  } else if (hasPrimaryDamage && dnd5eSpellUsesSequencedAttacks(spell)) {
    const projectileCount = dnd5eSpellProjectileCount(spell, character.level, slotLevel) ?? 1
    const perProjectileDice = spell.id === 'eldritch-blast' ? 1 : primaryDiceCount
    summaries.push(
      `${projectileCount}道攻击，每道${diceFormula(perProjectileDice, spell.dice.sides, standardBonus)}${typeLabel}伤害`,
    )
    if (features.once > 0) summaries.push(`首次造成伤害时额外+${features.once}`)
  } else if (hasPrimaryDamage) {
    summaries.push(
      `${diceFormula(primaryDiceCount, spell.dice.sides, standardBonus + features.once)}${typeLabel}伤害`,
    )
  }

  for (let index = 0; index < (spell.additionalDamageComponents?.length ?? 0); index += 1) {
    const component = spell.additionalDamageComponents![index]
    const count = damageDiceCounts[index + 1] ?? component.dice.count
    summaries.push(
      `${diceFormula(count, component.dice.sides, component.dice.bonus)}` +
      `${DND5E_DAMAGE_TYPE_LABELS[component.damageType]}伤害`,
    )
  }

  if (spell.delayedDamage && delayedDiceCount > 0) {
    summaries.push(
      `后续${diceFormula(
        delayedDiceCount,
        spell.delayedDamage.dice.sides,
        spell.delayedDamage.dice.bonus,
      )}${DND5E_DAMAGE_TYPE_LABELS[spell.delayedDamage.damageType]}伤害`,
    )
  }

  if (!hasPrimaryDamage && spell.sustainedAttack && sustainedDiceCount > 0) {
    summaries.push(
      `持续攻击${diceFormula(sustainedDiceCount, spell.sustainedAttack.dice.sides)}` +
      `${DND5E_DAMAGE_TYPE_LABELS[spell.sustainedAttack.damageType]}伤害`,
    )
  }

  return {
    slotLevel,
    summary: summaries.join('；'),
    featureBonuses: features.labels,
  }
}
