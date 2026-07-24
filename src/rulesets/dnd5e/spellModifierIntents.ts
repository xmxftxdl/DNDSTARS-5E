import { getClassResource } from '../../lib/classResources'
import type { Dnd5eMetamagicId, Dnd5eSpellMetamagicPayload } from '../../lib/sharedCombatTypes'
import type { Character } from '../../types/character'
import type { Dnd5eActionIconMotif } from '../../lib/dnd5eActionIcons'
import type { Dnd5eClassId } from './classes'
import { dnd5eCharacterClassLevel } from './multiclass'
import {
  dnd5eCanEmpowerSpell,
  dnd5eCanOverchannelSpell,
  dnd5eCanSculptSpell,
  dnd5eDraconicElementalResistanceType,
  dnd5eMetamagicAvailableForSpell,
  dnd5eMetamagicCost,
  getDnd5eSrdCombatSpell,
  type Dnd5eSrdSpellDefinition,
} from './spells'

export const DND5E_SPELL_MODIFIER_INTENT_SCHEMA_VERSION = 1 as const

export type Dnd5eSpellModifierIntentId =
  | 'evocation-sculpt-spells'
  | 'evocation-overchannel'
  | `metamagic-${Dnd5eMetamagicId}`
  | 'draconic-elemental-resistance'
  | 'repelling-blast'

export type Dnd5eSpellModifierOperationV1 =
  | { kind: 'sculpt-spell' }
  | { kind: 'overchannel' }
  | { kind: 'metamagic'; metamagic: Exclude<Dnd5eMetamagicId, 'empowered'> }
  | { kind: 'empowered-spell' }
  | { kind: 'draconic-elemental-resistance' }
  | { kind: 'repelling-blast' }

export interface Dnd5eSpellModifierIntentDefinitionV1 {
  schemaVersion: typeof DND5E_SPELL_MODIFIER_INTENT_SCHEMA_VERSION
  id: Dnd5eSpellModifierIntentId
  label: string
  description: string
  iconMotif: Dnd5eActionIconMotif
  source: {
    classId: Dnd5eClassId
    minimumLevel: number
    subclassId?: string
    selection?: { groupId: string; optionId: string }
  }
  operation: Dnd5eSpellModifierOperationV1
  exclusiveGroup?: 'primary-metamagic'
  incompatibleWith?: readonly Dnd5eSpellModifierIntentId[]
  minimumResourceCost?: { resourceId: string; label: string; amount: number }
}

export interface Dnd5eAvailableSpellModifierIntentV1 {
  definition: Dnd5eSpellModifierIntentDefinitionV1
  available: boolean
  unavailableReason?: string
  resource?: { label: string; current: number; maximum?: number }
}

export interface Dnd5eResolvedSpellModifierOptionsV1 {
  sculptSpell?: boolean
  overchannel?: boolean
  metamagic?: Dnd5eSpellMetamagicPayload
  empowered?: boolean
  draconicResistance?: boolean
  repellingBlast?: boolean
}

export interface Dnd5eSpellModifierResolutionV1 {
  ok: boolean
  options: Dnd5eResolvedSpellModifierOptionsV1
  effectiveEconomy?: 'action' | 'bonus-action' | 'reaction' | 'special'
  requiresTargetConfiguration: boolean
  reasons: readonly string[]
  labels: readonly string[]
  resourceCosts: Readonly<Record<string, number>>
}

const definitions: readonly Dnd5eSpellModifierIntentDefinitionV1[] = [
  {
    schemaVersion: 1,
    id: 'evocation-sculpt-spells',
    label: '法术塑形',
    description: '预激活后，为下一次合资格的塑能范围法术选择受保护生物；资格与数量由 Host 复核。',
    iconMotif: 'control',
    source: { classId: 'wizard', minimumLevel: 2, subclassId: 'evocation' },
    operation: { kind: 'sculpt-spell' },
  },
  {
    schemaVersion: 1,
    id: 'evocation-overchannel',
    label: '超限导能',
    description: '预激活后，下一次合资格的 1–5 环塑能伤害法术采用最大伤害；反复使用的反噬由 Host 结算。',
    iconMotif: 'arcane',
    source: { classId: 'wizard', minimumLevel: 14, subclassId: 'evocation' },
    operation: { kind: 'overchannel' },
    incompatibleWith: ['metamagic-empowered'],
  },
  {
    schemaVersion: 1,
    id: 'metamagic-careful',
    label: '谨慎法术',
    description: '消耗 1 点术法点，为下一次合资格的豁免法术选择自动通过豁免的生物。',
    iconMotif: 'control',
    source: { classId: 'sorcerer', minimumLevel: 3, selection: { groupId: 'metamagic', optionId: 'careful' } },
    operation: { kind: 'metamagic', metamagic: 'careful' },
    exclusiveGroup: 'primary-metamagic',
    minimumResourceCost: { resourceId: 'dnd5e-sorcery-points', label: '术法点', amount: 1 },
  },
  {
    schemaVersion: 1,
    id: 'metamagic-distant',
    label: '远距法术',
    description: '消耗 1 点术法点，使下一次合资格法术的施法距离翻倍，或将触及距离改为 30 尺。',
    iconMotif: 'arcane',
    source: { classId: 'sorcerer', minimumLevel: 3, selection: { groupId: 'metamagic', optionId: 'distant' } },
    operation: { kind: 'metamagic', metamagic: 'distant' },
    exclusiveGroup: 'primary-metamagic',
    minimumResourceCost: { resourceId: 'dnd5e-sorcery-points', label: '术法点', amount: 1 },
  },
  {
    schemaVersion: 1,
    id: 'metamagic-empowered',
    label: '强效法术',
    description: '消耗 1 点术法点，在伤害骰掷出后重掷至多等于魅力调整值的伤害骰；可与另一种超魔法并用。',
    iconMotif: 'force',
    source: { classId: 'sorcerer', minimumLevel: 3, selection: { groupId: 'metamagic', optionId: 'empowered' } },
    operation: { kind: 'empowered-spell' },
    incompatibleWith: ['evocation-overchannel'],
    minimumResourceCost: { resourceId: 'dnd5e-sorcery-points', label: '术法点', amount: 1 },
  },
  {
    schemaVersion: 1,
    id: 'metamagic-extended',
    label: '延效法术',
    description: '消耗 1 点术法点，使下一次持续至少 1 分钟的合资格法术持续时间翻倍。',
    iconMotif: 'divination',
    source: { classId: 'sorcerer', minimumLevel: 3, selection: { groupId: 'metamagic', optionId: 'extended' } },
    operation: { kind: 'metamagic', metamagic: 'extended' },
    exclusiveGroup: 'primary-metamagic',
    minimumResourceCost: { resourceId: 'dnd5e-sorcery-points', label: '术法点', amount: 1 },
  },
  {
    schemaVersion: 1,
    id: 'metamagic-heightened',
    label: '升阶法术',
    description: '消耗 3 点术法点，指定一个目标，使其对下一次合资格法术进行的第一次豁免具有劣势。',
    iconMotif: 'control',
    source: { classId: 'sorcerer', minimumLevel: 3, selection: { groupId: 'metamagic', optionId: 'heightened' } },
    operation: { kind: 'metamagic', metamagic: 'heightened' },
    exclusiveGroup: 'primary-metamagic',
    minimumResourceCost: { resourceId: 'dnd5e-sorcery-points', label: '术法点', amount: 3 },
  },
  {
    schemaVersion: 1,
    id: 'metamagic-quickened',
    label: '瞬发法术',
    description: '消耗 2 点术法点，将下一次施法时间为一个动作的合资格法术改为附赠动作。',
    iconMotif: 'lightning',
    source: { classId: 'sorcerer', minimumLevel: 3, selection: { groupId: 'metamagic', optionId: 'quickened' } },
    operation: { kind: 'metamagic', metamagic: 'quickened' },
    exclusiveGroup: 'primary-metamagic',
    minimumResourceCost: { resourceId: 'dnd5e-sorcery-points', label: '术法点', amount: 2 },
  },
  {
    schemaVersion: 1,
    id: 'metamagic-subtle',
    label: '精妙法术',
    description: '消耗 1 点术法点，使下一次合资格法术无需言语和姿势成分。',
    iconMotif: 'illusion',
    source: { classId: 'sorcerer', minimumLevel: 3, selection: { groupId: 'metamagic', optionId: 'subtle' } },
    operation: { kind: 'metamagic', metamagic: 'subtle' },
    exclusiveGroup: 'primary-metamagic',
    minimumResourceCost: { resourceId: 'dnd5e-sorcery-points', label: '术法点', amount: 1 },
  },
  {
    schemaVersion: 1,
    id: 'metamagic-twinned',
    label: '孪生法术',
    description: '消耗与环位相关的术法点，使下一次只以一个生物为目标的合资格法术改为选择两个目标。',
    iconMotif: 'arcane',
    source: { classId: 'sorcerer', minimumLevel: 3, selection: { groupId: 'metamagic', optionId: 'twinned' } },
    operation: { kind: 'metamagic', metamagic: 'twinned' },
    exclusiveGroup: 'primary-metamagic',
    minimumResourceCost: { resourceId: 'dnd5e-sorcery-points', label: '术法点', amount: 1 },
  },
  {
    schemaVersion: 1,
    id: 'draconic-elemental-resistance',
    label: '元素亲和抗性',
    description: '施放与龙族先祖关联伤害类型相同的法术时，消耗 1 点术法点获得对应抗性 1 小时。',
    iconMotif: 'armor',
    source: { classId: 'sorcerer', minimumLevel: 6, subclassId: 'draconic' },
    operation: { kind: 'draconic-elemental-resistance' },
    minimumResourceCost: { resourceId: 'dnd5e-sorcery-points', label: '术法点', amount: 1 },
  },
  {
    schemaVersion: 1,
    id: 'repelling-blast',
    label: '斥力魔爆',
    description: '预激活后，下一次魔能爆的每道命中射线将目标沿远离施法者方向推开至多 10 尺。',
    iconMotif: 'force',
    source: {
      classId: 'warlock',
      minimumLevel: 2,
      selection: { groupId: 'eldritch-invocations', optionId: 'repelling-blast' },
    },
    operation: { kind: 'repelling-blast' },
  },
] as const

const definitionById = new Map(definitions.map((definition) => [definition.id, definition]))

export function dnd5eSpellModifierIntentDefinitions(): readonly Dnd5eSpellModifierIntentDefinitionV1[] {
  return definitions
}

export function dnd5eSpellModifierIntentDefinition(
  id: Dnd5eSpellModifierIntentId,
): Dnd5eSpellModifierIntentDefinitionV1 | undefined {
  return definitionById.get(id)
}

function characterOwnsDefinition(
  character: Character,
  definition: Dnd5eSpellModifierIntentDefinitionV1,
): boolean {
  const { source } = definition
  if (dnd5eCharacterClassLevel(character, source.classId) < source.minimumLevel) return false
  const choices = character.dnd5eClassChoices?.classes?.[source.classId]
  if (source.subclassId && choices?.subclass !== source.subclassId) return false
  if (source.selection && !choices?.selections?.[source.selection.groupId]?.includes(source.selection.optionId)) return false
  return true
}

export function dnd5eAvailableSpellModifierIntents(
  character: Character,
): readonly Dnd5eAvailableSpellModifierIntentV1[] {
  return definitions.flatMap<Dnd5eAvailableSpellModifierIntentV1>((definition) => {
    if (!characterOwnsDefinition(character, definition)) return []
    const resourceCost = definition.minimumResourceCost
    if (!resourceCost) return [{ definition, available: true }]
    const resource = getClassResource(character, resourceCost.resourceId)
    const current = Math.max(0, Math.floor(resource?.current ?? 0))
    const maximum = resource ? Math.max(current, Math.floor(resource.max)) : undefined
    return [{
      definition,
      available: current >= resourceCost.amount,
      unavailableReason: current < resourceCost.amount
        ? `${resourceCost.label}不足（至少需要 ${resourceCost.amount} 点）。`
        : undefined,
      resource: { label: resourceCost.label, current, maximum },
    }]
  })
}

export function toggleDnd5eSpellModifierIntent(
  currentIds: ReadonlySet<Dnd5eSpellModifierIntentId>,
  id: Dnd5eSpellModifierIntentId,
): Set<Dnd5eSpellModifierIntentId> {
  const next = new Set(currentIds)
  if (next.delete(id)) return next
  const definition = definitionById.get(id)
  if (!definition) return next
  if (definition.exclusiveGroup) {
    for (const selectedId of next) {
      if (definitionById.get(selectedId)?.exclusiveGroup === definition.exclusiveGroup) next.delete(selectedId)
    }
  }
  for (const incompatibleId of definition.incompatibleWith ?? []) next.delete(incompatibleId)
  for (const selectedId of next) {
    if (definitionById.get(selectedId)?.incompatibleWith?.includes(id)) next.delete(selectedId)
  }
  next.add(id)
  return next
}

export function dnd5eSpellModifierIntentIdsFromOptions(
  options: Dnd5eResolvedSpellModifierOptionsV1 | undefined,
): Dnd5eSpellModifierIntentId[] {
  const ids: Dnd5eSpellModifierIntentId[] = []
  if (options?.sculptSpell) ids.push('evocation-sculpt-spells')
  if (options?.overchannel) ids.push('evocation-overchannel')
  if (options?.metamagic) ids.push(`metamagic-${options.metamagic.kind}`)
  if (options?.empowered) ids.push('metamagic-empowered')
  if (options?.draconicResistance) ids.push('draconic-elemental-resistance')
  if (options?.repellingBlast) ids.push('repelling-blast')
  return ids
}

function compatibleMetamagic(
  definition: Dnd5eSpellModifierIntentDefinitionV1,
  spell: Dnd5eSrdSpellDefinition,
  slotLevel: number,
): Dnd5eMetamagicId | undefined {
  if (definition.operation.kind === 'metamagic') {
    return dnd5eMetamagicAvailableForSpell(definition.operation.metamagic, spell, slotLevel)
      ? definition.operation.metamagic
      : undefined
  }
  return definition.operation.kind === 'empowered-spell' && dnd5eCanEmpowerSpell(spell)
    ? 'empowered'
    : undefined
}

export function resolveDnd5eSpellModifierIntents(input: {
  character: Character
  castingClassId: Dnd5eClassId
  spellId: string
  slotLevel: number
  modifierIds: readonly Dnd5eSpellModifierIntentId[]
}): Dnd5eSpellModifierResolutionV1 {
  const reasons: string[] = []
  const labels: string[] = []
  const resourceCosts: Record<string, number> = {}
  const options: Dnd5eResolvedSpellModifierOptionsV1 = {}
  const uniqueIds = [...new Set(input.modifierIds)]
  if (uniqueIds.length !== input.modifierIds.length) reasons.push('施法修正不能重复激活。')
  const spell = getDnd5eSrdCombatSpell(input.spellId)
  if (!spell && uniqueIds.length > 0) {
    return {
      ok: false,
      options,
      requiresTargetConfiguration: false,
      reasons: ['当前法术没有声明可由 Host 验证的施法修正兼容规则。'],
      labels,
      resourceCosts,
    }
  }
  if (!spell) return { ok: true, options, requiresTargetConfiguration: false, reasons, labels, resourceCosts }

  const owned = new Map(dnd5eAvailableSpellModifierIntents(input.character).map((entry) => [entry.definition.id, entry]))
  const exclusiveGroups = new Set<string>()
  let requiresTargetConfiguration = false
  for (const id of uniqueIds) {
    const definition = definitionById.get(id)
    const available = owned.get(id)
    if (!definition || !available) {
      reasons.push(`角色未拥有施法修正“${definition?.label ?? id}”。`)
      continue
    }
    labels.push(definition.label)
    if (!available.available) {
      reasons.push(available.unavailableReason ?? `${definition.label}当前不可用。`)
      continue
    }
    if (definition.exclusiveGroup) {
      if (exclusiveGroups.has(definition.exclusiveGroup)) {
        reasons.push('一次施法只能使用一种主要超魔法；强效法术除外。')
        continue
      }
      exclusiveGroups.add(definition.exclusiveGroup)
    }
    if (definition.incompatibleWith?.some((otherId) => uniqueIds.includes(otherId))) {
      reasons.push(`${definition.label}不能与${definition.incompatibleWith.map((otherId) => definitionById.get(otherId)?.label ?? otherId).join('、')}同时使用。`)
      continue
    }

    const operation = definition.operation
    if (operation.kind === 'sculpt-spell') {
      const classLevel = dnd5eCharacterClassLevel(input.character, input.castingClassId)
      const compatible = dnd5eCanSculptSpell({
        classId: input.castingClassId,
        subclassId: input.character.dnd5eClassChoices?.classes?.[input.castingClassId]?.subclass,
        level: classLevel,
      }, spell)
      if (!compatible) reasons.push(`${definition.label}只适用于合资格的塑能范围豁免法术。`)
      else {
        options.sculptSpell = true
        requiresTargetConfiguration = true
      }
      continue
    }
    if (operation.kind === 'overchannel') {
      const classLevel = dnd5eCharacterClassLevel(input.character, input.castingClassId)
      const compatible = dnd5eCanOverchannelSpell({
        classId: input.castingClassId,
        subclassId: input.character.dnd5eClassChoices?.classes?.[input.castingClassId]?.subclass,
        level: classLevel,
      }, spell, input.slotLevel)
      if (!compatible) reasons.push(`${definition.label}只适用于以 1–5 环施放的合资格法师塑能伤害法术。`)
      else options.overchannel = true
      continue
    }
    if (operation.kind === 'repelling-blast') {
      if (input.castingClassId !== 'warlock' || spell.id !== 'eldritch-blast') {
        reasons.push(`${definition.label}只能用于以邪术师施法来源施放的魔能爆。`)
      } else options.repellingBlast = true
      continue
    }
    if (operation.kind === 'draconic-elemental-resistance') {
      const classSelections = input.character.dnd5eClassChoices?.classes?.[input.castingClassId]?.selections ?? {}
      const damageType = dnd5eDraconicElementalResistanceType({
        classId: input.castingClassId,
        subclassId: input.character.dnd5eClassChoices?.classes?.[input.castingClassId]?.subclass,
        level: dnd5eCharacterClassLevel(input.character, input.castingClassId),
        classSelections,
      }, spell)
      if (!damageType) reasons.push(`${definition.label}只适用于与所选龙族先祖关联伤害类型相同的术士法术。`)
      else options.draconicResistance = true
    } else {
      const metamagic = compatibleMetamagic(definition, spell, input.slotLevel)
      if (input.castingClassId !== 'sorcerer') {
        reasons.push(`${definition.label}当前只能用于由术士施法来源提交的法术。`)
      } else if (!metamagic) {
        reasons.push(`${definition.label}不适用于该法术。`)
      } else if (metamagic === 'empowered') {
        options.empowered = true
      } else {
        options.metamagic = { kind: metamagic }
        if (metamagic === 'careful' || metamagic === 'heightened' || metamagic === 'twinned') {
          requiresTargetConfiguration = true
        }
      }
    }

    if (definition.minimumResourceCost) {
      const amount = definition.operation.kind === 'metamagic'
        ? dnd5eMetamagicCost(definition.operation.metamagic, input.slotLevel)
        : definition.minimumResourceCost.amount
      resourceCosts[definition.minimumResourceCost.resourceId] =
        (resourceCosts[definition.minimumResourceCost.resourceId] ?? 0) + amount
    }
  }

  for (const [resourceId, cost] of Object.entries(resourceCosts)) {
    const current = Math.max(0, Math.floor(getClassResource(input.character, resourceId)?.current ?? 0))
    if (!Number.isFinite(cost) || cost < 0 || current < cost) {
      reasons.push(`资源不足：${resourceId} 需要 ${cost}，当前 ${current}。`)
    }
  }

  const effectiveEconomy = options.metamagic?.kind === 'quickened'
    ? 'bonus-action'
    : spell.castingTime
  return {
    ok: reasons.length === 0,
    options,
    effectiveEconomy,
    requiresTargetConfiguration,
    reasons,
    labels,
    resourceCosts,
  }
}
