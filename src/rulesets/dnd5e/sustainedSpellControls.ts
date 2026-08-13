import type { Dnd5eSustainedSpellControlId } from '../../lib/sharedCombatTypes'
import type { Character } from '../../types/character'
import type { Dnd5eCombatActionEconomy, Dnd5eCombatActionTargeting } from '../../lib/dnd5eCombatActionDescriptors'
import type { Dnd5eSrdSpellDefinition } from './spells'

export interface Dnd5eActiveSustainedSpellControl {
  id: Dnd5eSustainedSpellControlId
  spellId: string
  label: string
  description: string
  economy: Dnd5eCombatActionEconomy
  targeting: Dnd5eCombatActionTargeting
  slotLevel: number
}

const CONTROL_LABELS: Readonly<Record<Dnd5eSustainedSpellControlId, string>> = {
  'flame-blade': '火焰刀攻击',
  'spiritual-weapon': '移动并攻击：灵体武器',
  'call-lightning': '再次召雷',
  'expeditious-retreat': '脚底抹油：疾走',
  'heat-metal': '灼热金属：再次灼烧',
  'vampiric-touch': '吸血鬼之触攻击',
  sunbeam: '阳炎射线',
  'produce-flame': '投掷燃火术',
}

function controlTargeting(spell: Dnd5eSrdSpellDefinition): Dnd5eCombatActionTargeting {
  if (spell.sustainedAttack?.resolution === 'dash') return 'self'
  if (spell.area) return 'area'
  return 'creature'
}

/**
 * Restores a follow-up control exclusively from authoritative ActiveEffect and
 * concentration projections.  UI callers never infer a control from the spell
 * merely being prepared or present in the spellbook.
 */
export function dnd5eActiveSustainedSpellControl(
  character: Character,
  spell: Dnd5eSrdSpellDefinition,
): Dnd5eActiveSustainedSpellControl | undefined {
  const control = spell.sustainedAttack
  if (!control || control.origin !== 'caster') return undefined
  const activeEffect = character.dnd5eCombatState?.activeEffects?.find((effect) =>
    effect.source.kind === 'spell' &&
    effect.source.rulesId === spell.id &&
    effect.definitionId === `srd-5.1:spell:${spell.id}` &&
    Number.isInteger(effect.potency) &&
    effect.potency! >= spell.level &&
    (spell.concentration
      ? effect.duration.type === 'concentration' &&
        character.dnd5eCombatState?.concentrationSpellId === spell.id
      : effect.duration.type !== 'concentration'),
  )
  if (!activeEffect || activeEffect.potency == null) return undefined
  return {
    id: control.id,
    spellId: spell.id,
    label: CONTROL_LABELS[control.id],
    description: `${control.economy === 'bonus-action' ? '附赠动作' : '动作'} · 使用现有${spell.name}效果，不消耗法术位`,
    economy: control.economy,
    targeting: controlTargeting(spell),
    slotLevel: activeEffect.potency,
  }
}

export function dnd5eSustainedSpellControlLabel(id: Dnd5eSustainedSpellControlId): string {
  return CONTROL_LABELS[id]
}
