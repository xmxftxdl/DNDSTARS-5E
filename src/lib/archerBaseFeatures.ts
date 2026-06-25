import type { Character } from '../types/character'
import { rollD20 } from './archerCombat'
import { findClassTrait, getClassFeatureDef } from './classFeatures'
import { abilityMod, proficiencyBonus, SKILLS } from './dnd'

/** 敌人近战物理攻击加值（闪避时对方进行一次攻击判定） */
export const ENEMY_MELEE_ATTACK_BONUS = 4

export function canAttemptDodge(c: Character): boolean {
  return c.currentAP >= 1
}

/** 闪避确认弹窗文案（应用内 Modal，勿在 setTimeout 中使用 window.confirm） */
export function formatDodgePrompt(c: Character): string {
  const apHint = canAttemptDodge(c)
    ? '闪避将消耗 1 AP，对方进行一次攻击判定（对抗你的 AC）。'
    : '当前行动点不足，选择闪避也无法生效，仍将受到全额伤害。'
  return `${c.name} 即将受到物理攻击（默认命中并受到全额伤害）。\n\n是否尝试闪避？\n· 承受伤害：直接掷伤害\n· 尝试闪避：${apHint}`
}

/** @deprecated 战斗流程请使用应用内闪避弹窗 */
export function promptDodgeChoice(c: Character): boolean {
  void c
  return false
}

/** @deprecated 使用 promptDodgeChoice */
export function offerDodgeAttempt(c: Character): boolean {
  return promptDodgeChoice(c) && canAttemptDodge(c)
}

export interface DodgeCheckResult {
  dodged: boolean
  d20: number
  total: number
  targetAc: number
  attackBonus: number
}

/** 闪避：对方进行一次攻击判定 d20+加值 vs 角色 AC；未命中则闪避成功 */
export function resolveDodgeCheck(
  target: Character,
  attackBonus = ENEMY_MELEE_ATTACK_BONUS,
  d20Override?: number,
): DodgeCheckResult {
  const targetAc = target.ac
  const d20 = d20Override ?? rollD20()
  const total = d20 + attackBonus
  return {
    dodged: total < targetAc,
    d20,
    total,
    targetAc,
    attackBonus,
  }
}

export function formatDodgeLabel(result: DodgeCheckResult): string {
  const outcome = result.dodged ? '闪避成功' : '闪避失败'
  return `${outcome} · 攻击判定 ${result.d20}+${result.attackBonus}=${result.total} vs AC ${result.targetAc}`
}

export interface PhysicalHitResolution {
  combatLabel: string
  dodged: boolean
  damageDealt: number
  dodgeRoll?: DodgeCheckResult
}

/** 物理近战：先确认是否闪避；不闪避则直接受伤，闪避则对方攻击判定 */
export function resolvePhysicalEnemyHit(
  target: Character,
  damage: number,
  wantsDodge: boolean,
  spendAp: () => boolean,
  attackBonus = ENEMY_MELEE_ATTACK_BONUS,
  d20Override?: number,
): PhysicalHitResolution {
  if (!wantsDodge) {
    return { combatLabel: '受击（未尝试闪避）', dodged: false, damageDealt: damage }
  }
  if (!spendAp()) {
    return { combatLabel: '尝试闪避 · 行动点不足', dodged: false, damageDealt: damage }
  }
  const dodge = resolveDodgeCheck(target, attackBonus, d20Override)
  if (dodge.dodged) {
    return { combatLabel: formatDodgeLabel(dodge), dodged: true, damageDealt: 0, dodgeRoll: dodge }
  }
  return { combatLabel: formatDodgeLabel(dodge), dodged: false, damageDealt: damage, dodgeRoll: dodge }
}

export function agileLeapMoveFeet(c: Character): number {
  const trait = findClassTrait(c, 'agileLeap')
  if (!trait) return 0
  const def = getClassFeatureDef('agileLeap')
  return def?.rangeAtRank?.(trait.level) ?? 10
}

export function canOfferAgileLeap(c: Character): boolean {
  const trait = findClassTrait(c, 'agileLeap')
  return !!trait && trait.uses > 0 && (c.combatBuffs?.agileLeapMoveFeet ?? 0) <= 0
}

export function offerAgileLeap(c: Character): { accepted: boolean; feet: number } {
  if (!canOfferAgileLeap(c)) return { accepted: false, feet: 0 }
  const feet = agileLeapMoveFeet(c)
  return { accepted: false, feet }
}

export function canOfferGaleCombo(c: Character): boolean {
  const trait = findClassTrait(c, 'galeCombo')
  return !!trait && trait.uses > 0 && !c.combatBuffs?.galeComboReady
}

export function offerGaleCombo(c: Character, effectLabel: string): boolean {
  void c
  void effectLabel
  return false
}

export function hasWildernessGuide(c: Character): boolean {
  return !!findClassTrait(c, 'wildernessGuide')
}

export function hasDarkvision(c: Character): boolean {
  const text = `${c.race} ${c.notes} ${c.traits.map((t) => t.description).join(' ')}`
  return /黑暗视觉|darkvision/i.test(text)
}

export function wildernessPassiveAdvantage(
  c: Character,
  skillKey: 'survival' | 'perception',
  context: { isDaytime?: boolean; inWilderness?: boolean },
): boolean {
  if (!hasWildernessGuide(c)) return false
  if (skillKey === 'perception' && context.inWilderness) return true
  if (skillKey === 'survival') {
    if (context.isDaytime) return true
    if (!context.isDaytime && hasDarkvision(c)) return true
  }
  return false
}

export function skillCheckModifier(c: Character, skillKey: string): number {
  const skill = SKILLS.find((s) => s.key === skillKey)
  if (!skill) return 0
  const prof = c.skills.includes(skillKey) ? proficiencyBonus(c.level) : 0
  return abilityMod(c.abilities[skill.ability]) + prof
}

export interface SkillCheckResult {
  d20: number
  d20Second?: number
  modifier: number
  total: number
  advantage: boolean
  label: string
}

export function rollSkillCheck(
  c: Character,
  skillKey: 'survival' | 'perception',
  opts: { advantage?: boolean; disadvantage?: boolean; label?: string },
): SkillCheckResult {
  const mod = skillCheckModifier(c, skillKey)
  const d20a = rollD20()
  let d20b: number | undefined
  let d20 = d20a
  const advantage = !!(opts.advantage && !opts.disadvantage)
  const disadvantage = !!(opts.disadvantage && !opts.advantage)
  if (advantage) {
    d20b = rollD20()
    d20 = Math.max(d20a, d20b)
  } else if (disadvantage) {
    d20b = rollD20()
    d20 = Math.min(d20a, d20b)
  }
  const skillLabel = SKILLS.find((s) => s.key === skillKey)?.label ?? skillKey
  let advLabel = ''
  if (advantage) advLabel = '（优势）'
  else if (disadvantage) advLabel = '（劣势）'
  return {
    d20,
    d20Second: d20b,
    modifier: mod,
    total: d20 + mod,
    advantage,
    label: `${opts.label ?? skillLabel}检定${advLabel} · ${d20}+${mod} = ${d20 + mod}`,
  }
}
