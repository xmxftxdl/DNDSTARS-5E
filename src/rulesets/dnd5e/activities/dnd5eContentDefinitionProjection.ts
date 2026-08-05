import { automationCapabilityFromLegacyStatus, type AutomationCapability } from '../../../domain/automation/automationCapability'
import type { RegisteredContentDefinition } from '../../../domain/content/contentDefinitionRegistry'
import { DND5E_STANDARD_CONDITION_IDS, type Dnd5eStandardConditionId } from '../conditions'
import type { Dnd5eContentPackageV2 } from '../contentPackageV2'
import type { Dnd5ePluginStaticCombatModifiers } from '../pluginApi'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import type { Dnd5eAdvancementDefinitionV1 } from './dnd5eAdvancementContracts'
import { dnd5eContentPackageActivityProjectionV1 } from './dnd5eContentPackageActivityProjection'
import type { Dnd5eEffectDefinitionV1, Dnd5eEffectModifierV1 } from './dnd5eEffectContracts'

const CONDITIONS = new Set<string>(DND5E_STANDARD_CONDITION_IDS)

function safeSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 120) || 'content'
}

function definitionId(kind: RegisteredContentDefinition['kind'], localId: string): string {
  return safeSegment(`${kind}.${localId}`)
}

function permanentEffect(
  id: string,
  name: string,
  staticModifiers: Dnd5ePluginStaticCombatModifiers | undefined,
): Dnd5eEffectDefinitionV1 | undefined {
  if (!staticModifiers) return undefined
  const modifiers: Dnd5eEffectModifierV1[] = []
  if (staticModifiers.armorClassBonus) modifiers.push({ kind: 'armor-class', mode: 'add', value: { kind: 'constant', value: staticModifiers.armorClassBonus } })
  if (staticModifiers.speedBonusFeet) modifiers.push({ kind: 'speed', mode: 'add', value: { kind: 'constant', value: staticModifiers.speedBonusFeet } })
  if (staticModifiers.savingThrowBonus) modifiers.push({ kind: 'saving-throw', mode: 'add', value: { kind: 'constant', value: staticModifiers.savingThrowBonus } })
  staticModifiers.damageResistances?.forEach((damageType) => modifiers.push({ kind: 'damage-resistance', damageType }))
  staticModifiers.damageImmunities?.forEach((damageType) => modifiers.push({ kind: 'damage-immunity', damageType }))
  staticModifiers.conditionImmunities?.forEach((condition) => {
    if (CONDITIONS.has(condition)) modifiers.push({ kind: 'condition-immunity', condition: condition as Dnd5eStandardConditionId })
  })
  const grants = [
    ...(staticModifiers.initiativeBonus ? [`initiative-bonus:${staticModifiers.initiativeBonus}`] : []),
    ...(staticModifiers.darkvisionRangeFeet ? [`darkvision-feet:${staticModifiers.darkvisionRangeFeet}`] : []),
  ]
  if (!modifiers.length && !grants.length) return undefined
  return {
    schemaVersion: 1,
    id: `${id}.static`,
    name,
    duration: { kind: 'permanent' },
    modifiers,
    grants,
    stacking: 'unique-by-source',
  }
}

function combinedCapability(activities: readonly Dnd5eActivityDefinitionV1[]): AutomationCapability {
  if (!activities.length) return automationCapabilityFromLegacyStatus('reference-only')
  if (activities.every((activity) => activity.automation.level === 'full')) return automationCapabilityFromLegacyStatus('full')
  const limitations = activities.flatMap((activity) => activity.automation.limitations)
  if (activities.every((activity) => activity.automation.level === 'display-only')) {
    return automationCapabilityFromLegacyStatus('reference-only', limitations)
  }
  return automationCapabilityFromLegacyStatus('partial', limitations.length ? limitations : ['部分 Activity 仍使用兼容执行器或 DM 裁定。'])
}

function definition(
  value: Dnd5eContentPackageV2,
  kind: RegisteredContentDefinition['kind'],
  localId: string,
  name: string,
  payload: unknown,
  automation: AutomationCapability,
  options: {
    description?: string
    activities?: readonly Dnd5eActivityDefinitionV1[]
    effects?: readonly Dnd5eEffectDefinitionV1[]
    advancements?: readonly Dnd5eAdvancementDefinitionV1[]
  } = {},
): RegisteredContentDefinition {
  return {
    schemaVersion: 1,
    id: definitionId(kind, localId),
    namespace: value.manifest.id,
    version: value.manifest.version,
    kind,
    name,
    description: options.description,
    source: { packageId: value.manifest.id, packageVersion: value.manifest.version },
    payload: structuredClone(payload),
    activities: options.activities?.map((activity) => structuredClone(activity)),
    effects: options.effects?.map((effect) => structuredClone(effect)),
    advancements: options.advancements?.map((advancement) => structuredClone(advancement)),
    automation,
  }
}

/** Builds the unified Item/Activity/Effect/Advancement view of a V2 package. */
export function dnd5eContentDefinitionsFromPackageV2(
  value: Dnd5eContentPackageV2,
): readonly RegisteredContentDefinition[] {
  const activityProjection = dnd5eContentPackageActivityProjectionV1(value)
  const activitiesBySource = new Map<string, Dnd5eActivityDefinitionV1[]>()
  for (const entry of activityProjection.entries) {
    const activity = activityProjection.activities.find((candidate) => candidate.id === entry.activityId)
    if (!activity) continue
    const key = `${entry.sourceKind}:${entry.sourceId}`
    activitiesBySource.set(key, [...(activitiesBySource.get(key) ?? []), activity])
  }
  const definitions: RegisteredContentDefinition[] = []

  for (const race of value.content.races) {
    const id = definitionId('race', race.id)
    const effect = permanentEffect(id, race.name, race.staticModifiers)
    const advancements: Dnd5eAdvancementDefinitionV1[] = race.grantedFeatureIds?.length ? [{
      schemaVersion: 1, id: `${id}.features`, level: 1, kind: 'grant',
      grants: race.grantedFeatureIds.map((featureId) => ({ namespace: value.manifest.id, id: definitionId('feature', featureId) })),
    }] : []
    definitions.push(definition(value, 'race', race.id, race.name, race,
      automationCapabilityFromLegacyStatus(race.automation ?? 'full', race.automationReasons), {
        description: race.description, effects: effect ? [effect] : [], advancements,
      }))
  }
  for (const background of value.content.backgrounds) {
    const id = definitionId('background', background.id)
    const advancements: Dnd5eAdvancementDefinitionV1[] = background.skillProficiencies.length ? [{
      schemaVersion: 1, id: `${id}.skills`, level: 1, kind: 'proficiency',
      category: 'skill', choices: background.skillProficiencies, count: background.skillProficiencies.length,
    }] : []
    definitions.push(definition(value, 'background', background.id, background.name, background,
      automationCapabilityFromLegacyStatus('full'), { description: background.description, advancements }))
  }
  for (const feature of value.content.features) {
    const activities = activitiesBySource.get(`feature:${feature.id}`) ?? []
    const id = definitionId('feature', feature.id)
    const effect = permanentEffect(id, feature.name, feature.staticModifiers)
    definitions.push(definition(value, 'feature', feature.id, feature.name, feature,
      activities.length ? combinedCapability(activities) : automationCapabilityFromLegacyStatus(feature.automation), {
        description: feature.description, activities, effects: effect ? [effect] : [],
      }))
  }
  for (const feat of value.content.feats) {
    const activities = activitiesBySource.get(`feat:${feat.id}`) ?? []
    const id = definitionId('feat', feat.id)
    const effect = permanentEffect(id, feat.name, feat.staticModifiers)
    definitions.push(definition(value, 'feat', feat.id, feat.name, feat,
      activities.length ? combinedCapability(activities) : automationCapabilityFromLegacyStatus(feat.automation), {
        description: feat.description, activities, effects: effect ? [effect] : [],
      }))
  }
  for (const spell of value.content.spells) {
    const activities = activitiesBySource.get(`spell:${spell.id}`) ?? []
    definitions.push(definition(value, 'spell', spell.id, spell.name, spell,
      combinedCapability(activities), { description: spell.description, activities }))
  }
  for (const item of value.content.items) {
    const activities = activitiesBySource.get(`item:${item.id}`) ?? []
    const status = item.magicItem?.automation === 'dm-adjudication'
      ? 'manual' as const
      : activities.length || item.equipment ? 'full' as const : 'reference-only' as const
    definitions.push(definition(value, 'item', item.id, item.name, item,
      activities.length ? combinedCapability(activities) : automationCapabilityFromLegacyStatus(status), {
        description: item.description, activities,
      }))
  }
  for (const method of value.content.abilityGenerationMethods) {
    definitions.push(definition(value, 'ability-generation', method.id, method.name, method,
      automationCapabilityFromLegacyStatus('full'), { description: method.summary }))
  }
  for (const classDefinition of value.content.classes ?? []) {
    const advancements: Dnd5eAdvancementDefinitionV1[] = []
    for (const feature of classDefinition.features) {
      const featureContentId = definitionId('feature', `class-feature.${classDefinition.id}.${feature.id}`)
      definitions.push(definition(
        value,
        'feature',
        `class-feature.${classDefinition.id}.${feature.id}`,
        feature.name,
        feature,
        automationCapabilityFromLegacyStatus(feature.automation),
        { description: feature.description },
      ))
      advancements.push({
        schemaVersion: 1,
        id: `${definitionId('class', classDefinition.id)}.grant.${safeSegment(feature.id)}`,
        level: feature.level,
        kind: 'grant',
        grants: [{ namespace: value.manifest.id, id: featureContentId }],
      })
    }
    if (classDefinition.spellcasting) {
      const kind = classDefinition.spellcasting.kind
      const progression = kind === 'pact'
        ? 'pact' as const
        : kind.startsWith('half-')
          ? 'half' as const
          : kind === 'one-third-known'
            ? 'one-third' as const
            : 'full' as const
      advancements.push({
        schemaVersion: 1,
        id: `${definitionId('class', classDefinition.id)}.spellcasting`,
        level: 1,
        kind: 'spell-progression',
        progression,
        ability: classDefinition.spellcasting.ability,
        spellListId: classDefinition.id,
      })
    }
    if (classDefinition.subclass) {
      advancements.push({
        schemaVersion: 1,
        id: `${definitionId('class', classDefinition.id)}.subclass`,
        level: classDefinition.subclass.level,
        kind: 'subclass',
        classId: classDefinition.id,
        count: 1,
      })
    }
    const classStatus = classDefinition.features.length > 0 &&
      classDefinition.features.every((feature) => feature.automation === 'manual')
      ? 'manual' as const
      : classDefinition.features.some((feature) => feature.automation !== 'full')
        ? 'partial' as const
        : classDefinition.features.length > 0
          ? 'full' as const
          : 'reference-only' as const
    definitions.push(definition(
      value,
      'class',
      classDefinition.id,
      classDefinition.name,
      classDefinition,
      automationCapabilityFromLegacyStatus(classStatus),
      { description: classDefinition.summary, advancements },
    ))
  }
  for (const subclass of value.content.subclasses) {
    const grants: Dnd5eAdvancementDefinitionV1[] = []
    const subclassActivities: Dnd5eActivityDefinitionV1[] = []
    for (const ability of subclass.abilities) {
      const sourceId = `${subclass.id}:${ability.id}`
      const activities = activitiesBySource.get(`subclass-ability:${sourceId}`) ?? []
      subclassActivities.push(...activities)
      const abilityContentId = definitionId('feature', `subclass-ability.${subclass.id}.${ability.id}`)
      definitions.push(definition(value, 'feature', `subclass-ability.${subclass.id}.${ability.id}`, ability.name, ability,
        activities.length ? combinedCapability(activities) : automationCapabilityFromLegacyStatus(ability.automation), {
          description: ability.description, activities,
        }))
      grants.push({
        schemaVersion: 1, id: `${definitionId('subclass', subclass.id)}.grant.${safeSegment(ability.id)}`,
        level: ability.level, kind: 'grant', grants: [{ namespace: value.manifest.id, id: abilityContentId }],
      })
    }
    if (subclass.spellcasting) grants.push({
      schemaVersion: 1, id: `${definitionId('subclass', subclass.id)}.spellcasting`, level: 3,
      kind: 'spell-progression', progression: subclass.spellcasting.progression,
      ability: subclass.spellcasting.ability, spellListId: subclass.spellcasting.spellListClassId,
    })
    definitions.push(definition(value, 'subclass', subclass.id, subclass.name, subclass,
      combinedCapability(subclassActivities), { description: subclass.summary, advancements: grants }))
  }
  for (const monster of value.content.monsters) {
    const monsterActivities = activityProjection.entries
      .filter((entry) => entry.sourceKind === 'monster-action' && entry.sourceId.startsWith(`${monster.id}:`))
      .flatMap((entry) => activityProjection.activities.filter((activity) => activity.id === entry.activityId))
    definitions.push(definition(value, 'monster', monster.slug, monster.name, monster,
      combinedCapability(monsterActivities), { description: monster.description, activities: monsterActivities }))
    for (const activity of monsterActivities) {
      const sourceId = activity.legacySource?.id?.split(':').at(-1) ?? activity.id
      definitions.push(definition(value, 'monster-action', `${monster.slug}.${sourceId}`, activity.name,
        { monsterId: monster.id, actionId: sourceId }, activity.automation, {
          description: activity.description, activities: [activity],
        }))
    }
  }
  return definitions
}
