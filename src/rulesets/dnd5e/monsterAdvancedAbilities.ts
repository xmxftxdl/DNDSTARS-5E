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

export interface Dnd5eMonsterCoreSpellCompatibility {
  automation: 'full' | 'manual'
  reason?: string
}

const MONSTER_CORE_ACTIVE_EFFECT_SPELL_IDS = new Set([
  'barkskin',
  'blur',
  'fly',
  'greater-invisibility',
  'invisibility',
  'longstrider',
  'mage-armor',
  'protection-from-poison',
])

const MONSTER_CORE_CONTROL_SPELL_IDS = new Set([
  'banishment',
  'hold-person',
])

const MONSTER_CORE_PERSISTENT_AREA_SPELL_IDS = new Set([
  'blade-barrier',
  'entangle',
  'insect-plague',
])

/**
 * The monster spell path intentionally starts with effects whose target,
 * dice, attack/save and damage can all be revalidated without player-class
 * assumptions. Complex riders keep using the existing DM adjudication path.
 */
export function dnd5eMonsterCoreSpellCompatibility(
  spell: Dnd5eSrdSpellDefinition,
): Dnd5eMonsterCoreSpellCompatibility {
  const supportedActiveEffect = spell.effect === 'active-effect' &&
    spell.appliedEffect === spell.id &&
    MONSTER_CORE_ACTIVE_EFFECT_SPELL_IDS.has(spell.id)
  if (spell.effect === 'persistent-area') {
    if (MONSTER_CORE_PERSISTENT_AREA_SPELL_IDS.has(spell.id)) {
      return { automation: 'full' }
    }
    return {
      automation: 'manual',
      reason: spell.id === 'cloudkill'
        ? '毒雾的自动移动、下沉与强风驱散尚未进入共享地图事务'
        : '该持续区域尚未进入怪物核心法术事务白名单',
    }
  }
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
    (spell.concentration && spell.id !== 'magic-weapon' && !supportedActiveEffect &&
      !MONSTER_CORE_CONTROL_SPELL_IDS.has(spell.id)) ||
    (spell.appliedEffect &&
      spell.appliedEffect !== 'darkvision' &&
      spell.appliedEffect !== 'see-invisibility' &&
      spell.appliedEffect !== 'warding-bond' &&
      (spell.appliedEffect !== 'sanctuary' || spell.id !== 'sanctuary') &&
      spell.appliedEffect !== 'magic-weapon' &&
      !supportedActiveEffect) ||
    spell.onHitEffect ||
    (spell.onFailedSaveEffect &&
      spell.onFailedSaveEffect !== 'charm-person' &&
      !(spell.id === 'hold-person' && spell.onFailedSaveEffect === 'hold-person') &&
      !(spell.id === 'banishment' && spell.onFailedSaveEffect === 'banishment') &&
      !(spell.id === 'thunderwave' && spell.onFailedSaveEffect === 'thunderwave-push')) ||
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
    'automatic-damage',
    'healing',
    'stabilize',
    'remove-condition',
    'sleep-hit-point-pool',
    'active-effect',
    'dispel-magic',
    'teleport',
    'power-word-kill',
    'power-word-stun',
  ].includes(spell.effect)) return { automation: 'full' }
  return { automation: 'manual', reason: `效果类型 ${spell.effect} 尚未进入怪物核心施法白名单` }
}
