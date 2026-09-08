import type { MobileSpellView } from '../../../../packages/mobile-protocol/src'
import type { Dnd5eMetamagicId, Dnd5eSpellCastPayload } from '../../../../src/lib/sharedCombatTypes'

export type MobileSpellIntent = Pick<Partial<Dnd5eSpellCastPayload>,
  | 'conditionChoice' | 'effectDamageType' | 'enlargeReduceChoice' | 'enhanceAbilityChoice'
  | 'higherSlotDamageType' | 'areaTargetOrientation' | 'overchannel' | 'sculptedTargetIds'
  | 'metamagic' | 'empowered' | 'draconicResistance' | 'repellingBlast'
  | 'areaTargetAngleDegrees' | 'areaTargetRadiusFeet' | 'areaTargetWidthFeet'
  | 'areaTargetHeightFeet' | 'areaTargetLengthFeet'
  | 'wallOfFireShape' | 'wallOfFireAngleDegrees' | 'wallOfFireDamagingSide'
  | 'wallOfFireLengthFeet' | 'wallOfFireDiameterFeet'
  | 'bladeBarrierShape' | 'bladeBarrierAngleDegrees' | 'bladeBarrierLengthFeet'
  | 'bladeBarrierDiameterFeet' | 'excludedAreaTargetIds' | 'healingAllocations'
  | 'spellOriginAreaId' | 'damageMaximizationFeatureId'
> & { targetElevationFeet?: number; blindTargetCell?: boolean }

type SpellChoiceField = 'conditionChoice' | 'effectDamageType' | 'enlargeReduceChoice' | 'enhanceAbilityChoice' | 'higherSlotDamageType'
export function spellChoiceOptions(spell: MobileSpellView, slotLevel: number): Array<{ field: SpellChoiceField; label: string; options: Array<{ id: string; label: string }> }> {
  if (spell.id === 'blindness-deafness') return [{ field: 'conditionChoice', label: '施加状态', options: [{ id: 'blinded', label: '目盲' }, { id: 'deafened', label: '耳聋' }] }]
  if (spell.id === 'lesser-restoration') return [{ field: 'conditionChoice', label: '结束状态', options: [{ id: 'blinded', label: '目盲' }, { id: 'deafened', label: '耳聋' }, { id: 'paralyzed', label: '麻痹' }, { id: 'poisoned', label: '中毒' }, { id: 'disease', label: '疾病' }] }]
  if (spell.id === 'protection-from-energy') return [{ field: 'effectDamageType', label: '选择伤害抗性', options: [{ id: 'acid', label: '强酸' }, { id: 'cold', label: '寒冷' }, { id: 'fire', label: '火焰' }, { id: 'lightning', label: '闪电' }, { id: 'thunder', label: '雷鸣' }] }]
  if (spell.id === 'enlarge-reduce') return [{ field: 'enlargeReduceChoice', label: '选择形态', options: [{ id: 'enlarge', label: '变巨' }, { id: 'reduce', label: '缩小' }] }]
  if (spell.id === 'enhance-ability') return [{ field: 'enhanceAbilityChoice', label: '强化属性', options: [{ id: 'bear-endurance', label: '熊之坚韧' }, { id: 'bull-strength', label: '牛之蛮力' }, { id: 'cat-grace', label: '猫之优雅' }, { id: 'eagle-splendor', label: '鹰之威仪' }, { id: 'fox-cunning', label: '狐之狡黠' }, { id: 'owl-wisdom', label: '枭之洞察' }] }]
  if (spell.id === 'flame-strike' && slotLevel > spell.level) return [{ field: 'higherSlotDamageType', label: '升环额外伤害类型', options: [{ id: 'fire', label: '火焰' }, { id: 'radiant', label: '光耀' }] }]
  return []
}

export function defaultSpellIntent(spell: MobileSpellView, slotLevel: number): MobileSpellIntent {
  const choice = spellChoiceOptions(spell, slotLevel)[0]
  return choice ? { [choice.field]: choice.options[0]?.id } as MobileSpellIntent : {}
}

export function spellPayloadIntent(intent: MobileSpellIntent): Partial<Dnd5eSpellCastPayload> {
  return {
    conditionChoice: intent.conditionChoice,
    effectDamageType: intent.effectDamageType,
    enlargeReduceChoice: intent.enlargeReduceChoice,
    enhanceAbilityChoice: intent.enhanceAbilityChoice,
    higherSlotDamageType: intent.higherSlotDamageType,
    areaTargetOrientation: intent.areaTargetOrientation,
    overchannel: intent.overchannel,
    sculptedTargetIds: intent.sculptedTargetIds,
    metamagic: intent.metamagic,
    empowered: intent.empowered,
    draconicResistance: intent.draconicResistance,
    repellingBlast: intent.repellingBlast,
    areaTargetAngleDegrees: intent.areaTargetAngleDegrees,
    areaTargetRadiusFeet: intent.areaTargetRadiusFeet,
    areaTargetWidthFeet: intent.areaTargetWidthFeet,
    areaTargetHeightFeet: intent.areaTargetHeightFeet,
    areaTargetLengthFeet: intent.areaTargetLengthFeet,
    wallOfFireShape: intent.wallOfFireShape,
    wallOfFireAngleDegrees: intent.wallOfFireAngleDegrees,
    wallOfFireDamagingSide: intent.wallOfFireDamagingSide,
    wallOfFireLengthFeet: intent.wallOfFireLengthFeet,
    wallOfFireDiameterFeet: intent.wallOfFireDiameterFeet,
    bladeBarrierShape: intent.bladeBarrierShape,
    bladeBarrierAngleDegrees: intent.bladeBarrierAngleDegrees,
    bladeBarrierLengthFeet: intent.bladeBarrierLengthFeet,
    bladeBarrierDiameterFeet: intent.bladeBarrierDiameterFeet,
    excludedAreaTargetIds: intent.excludedAreaTargetIds,
    healingAllocations: intent.healingAllocations,
    spellOriginAreaId: intent.spellOriginAreaId,
    damageMaximizationFeatureId: intent.damageMaximizationFeatureId,
  }
}

export function isMetamagicId(value: string): value is Dnd5eMetamagicId {
  return ['careful', 'distant', 'empowered', 'extended', 'heightened', 'quickened', 'subtle', 'twinned'].includes(value)
}

export function metamagicPayload(kind: Exclude<Dnd5eMetamagicId, 'empowered'>, fallbackTargetId?: string): NonNullable<Dnd5eSpellCastPayload['metamagic']> {
  if (kind === 'careful') return { kind, carefulTargetIds: fallbackTargetId ? [fallbackTargetId] : [] }
  if (kind === 'heightened') return { kind, heightenedTargetId: fallbackTargetId }
  return { kind }
}

export function metamagicLabel(kind: Exclude<Dnd5eMetamagicId, 'empowered'>): string {
  return ({ careful: '谨慎', distant: '远距', extended: '延效', heightened: '升阶', quickened: '瞬发', subtle: '精妙', twinned: '孪生' } as const)[kind]
}

export function spellTargetCapacity(spell: MobileSpellView, slotLevel: number, characterLevel: number, intent?: MobileSpellIntent) {
  const upcast = Math.max(0, slotLevel - spell.level)
  if (spell.id === 'eldritch-blast') return { maximum: characterLevel >= 17 ? 4 : characterLevel >= 11 ? 3 : characterLevel >= 5 ? 2 : 1, projectiles: true }
  if (spell.baseProjectiles != null) return { maximum: spell.baseProjectiles + upcast * (spell.additionalProjectilesPerHigherSlot ?? 0), projectiles: true }
  const maximum = intent?.metamagic?.kind === 'twinned'
    ? 2
    : Math.max(1, (spell.maximumTargets ?? 1) + upcast * (spell.additionalTargetsPerHigherSlot ?? 0))
  return { maximum, projectiles: spell.allowDuplicateTargets === true }
}
