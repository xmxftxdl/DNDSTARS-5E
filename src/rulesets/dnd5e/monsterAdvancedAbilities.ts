import type { Dnd5eSrdSpellDefinition } from './spells'

const VAMPIRE_FORMS = [
  'srd-5.1:vampire-vampire',
  'srd-5.1:vampire-bat',
  'srd-5.1:vampire-mist',
] as const

const WEREBEAR_FORMS = [
  'srd-5.1:werebear-human',
  'srd-5.1:werebear-hybrid',
  'srd-5.1:werebear-bear',
] as const

const WEREWOLF_FORMS = [
  'srd-5.1:werewolf-human',
  'srd-5.1:werewolf-hybrid',
  'srd-5.1:werewolf-wolf',
] as const

const STRUCTURED_SHAPECHANGE_FORMS: readonly (readonly string[])[] = [
  VAMPIRE_FORMS,
  WEREBEAR_FORMS,
  WEREWOLF_FORMS,
]

export function dnd5eMonsterShapechangeFormIds(statBlockId: string): readonly string[] {
  const forms = STRUCTURED_SHAPECHANGE_FORMS.find((candidate) => candidate.includes(statBlockId))
  return forms?.filter((formId) => formId !== statBlockId) ?? []
}

export function dnd5eMonsterHasStructuredShapechange(statBlockId: string): boolean {
  return STRUCTURED_SHAPECHANGE_FORMS.some((forms) => forms.includes(statBlockId))
}

export interface Dnd5eLegendaryWingAttackRule {
  rangeFeet: number
  saveDc: number
  damage: { count: number; sides: number; bonus: number }
}

/** Parses only the fixed SRD 5.1 dragon Wing Attack wording. */
export function parseDnd5eLegendaryWingAttack(
  actionId: string,
  description: string,
): Dnd5eLegendaryWingAttackRule | undefined {
  if (actionId !== 'wing-attack-costs-2-actions') return undefined
  const range = /within\s+(\d+)\s*ft\./i.exec(description) ?? /(\d+)\s*尺内/.exec(description)
  const save = /DC\s+(\d+)\s+Dexterity saving throw/i.exec(description) ?? /DC\s*(\d+).*敏捷豁免/.exec(description)
  const damage = /take\s+\d+\s+\((\d+)d(\d+)\s*\+\s*(\d+)\)\s+bludgeoning damage/i.exec(description) ??
    /\((\d+)d(\d+)\s*\+\s*(\d+)\).*钝击伤害/.exec(description)
  if (!range || !save || !damage) return undefined
  return {
    rangeFeet: Number(range[1]),
    saveDc: Number(save[1]),
    damage: { count: Number(damage[1]), sides: Number(damage[2]), bonus: Number(damage[3]) },
  }
}

export interface Dnd5eMonsterCoreSpellCompatibility {
  automation: 'full' | 'manual'
  reason?: string
}

/**
 * The monster spell path intentionally starts with effects whose target,
 * dice, attack/save and damage can all be revalidated without player-class
 * assumptions. Complex riders keep using the existing DM adjudication path.
 */
export function dnd5eMonsterCoreSpellCompatibility(
  spell: Dnd5eSrdSpellDefinition,
): Dnd5eMonsterCoreSpellCompatibility {
  if (['blight', 'disintegrate', 'finger-of-death'].includes(spell.id)) {
    return {
      automation: 'manual',
      reason: spell.id === 'blight'
        ? '构装/亡灵免疫与植物目标最大伤害尚未结构化'
        : spell.id === 'disintegrate'
          ? '降至 0 HP 时的解离结果尚未结构化'
          : '击杀人形生物后的僵尸创建尚未结构化',
    }
  }
  if (
    spell.concentration ||
    spell.appliedEffect ||
    spell.onHitEffect ||
    spell.onFailedSaveEffect ||
    spell.sustainedAttack ||
    spell.delayedDamage ||
    spell.spellAttackMissDamage
  ) {
    return { automation: 'manual', reason: '包含持续、专注或命中附带效果' }
  }
  if (spell.additionalDamageComponents?.length) {
    return { automation: 'manual', reason: '包含多种伤害分量' }
  }
  if ([
    'spell-attack',
    'saving-throw',
    'healing',
    'stabilize',
    'power-word-kill',
    'power-word-stun',
  ].includes(spell.effect)) return { automation: 'full' }
  return { automation: 'manual', reason: `效果类型 ${spell.effect} 尚未进入怪物核心施法白名单` }
}
