import { automationCapabilityFromLegacyStatus, type AutomationCapability } from '../../../domain/automation/automationCapability'
import type { RegisteredContentDefinition } from '../../../domain/content/contentDefinitionRegistry'
import { DND5E_STANDARD_CONDITION_IDS, type Dnd5eStandardConditionId } from '../conditions'
import type { Dnd5eContentPackageV2 } from '../contentPackageV2'
import type {
  Dnd5ePluginFeatureDefinition,
  Dnd5ePluginItemDefinition,
  Dnd5ePluginStaticCombatModifiers,
} from '../pluginApi'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import type { Dnd5eAdvancementDefinitionV1 } from './dnd5eAdvancementContracts'
import { dnd5eContentPackageActivityProjectionV1 } from './dnd5eContentPackageActivityProjection'
import type { Dnd5eEffectDefinitionV1, Dnd5eEffectModifierV1 } from './dnd5eEffectContracts'
import type { Dnd5eFormulaV1 } from './dnd5eFormula'
import { dnd5eWorkshopDamageFormulaAsFormulaV1, type Dnd5eWorkshopDamageFormulaV1 } from '../workshopDamageFormula'

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

function diceFormula(id: string, dice: { count: number; sides: number; bonus: number; modifierFormula?: Dnd5eWorkshopDamageFormulaV1 }): Dnd5eFormulaV1 {
  const rolled: Dnd5eFormulaV1 = { kind: 'dice', rollId: id, count: dice.count, sides: dice.sides }
  const values: Dnd5eFormulaV1[] = [rolled]
  if (dice.bonus !== 0) values.push({ kind: 'constant', value: dice.bonus })
  const dynamicModifier = dnd5eWorkshopDamageFormulaAsFormulaV1(dice.modifierFormula)
  if (dynamicModifier) values.push(dynamicModifier)
  return values.length === 1 ? rolled : { kind: 'add', values }
}

function featurePassiveEffects(
  ownerId: string,
  ownerName: string,
  feature: Pick<Dnd5ePluginFeatureDefinition, 'passiveEffects'>,
): readonly Dnd5eEffectDefinitionV1[] {
  return (feature.passiveEffects ?? []).map((passive) => {
    const id = `${ownerId}.passive.${safeSegment(passive.id)}`
    return {
      schemaVersion: 1,
      id,
      name: `${ownerName} · ${passive.id}`,
      duration: { kind: 'permanent' },
      modifiers: [{
        kind: 'damage-reduction',
        amount: { kind: 'constant', value: passive.amount },
        damageTypes: passive.damageTypes,
        minimumIncomingDamage: passive.minimumIncomingDamage,
        maximumCurrentHitPointPercent: passive.maximumCurrentHitPointPercent,
        oncePerTurn: passive.oncePerTurn,
      }],
      triggers: [{
        id: `${id}.trigger`, event: 'before-damage', effectId: id, decision: 'automatic',
        ...(passive.oncePerTurn ? { limit: { uses: 1, reset: 'turn' as const } } : {}),
      }],
      stacking: 'unique-by-source',
    }
  })
}

function itemEffectDefinitions(
  ownerId: string,
  item: Dnd5ePluginItemDefinition,
): readonly Dnd5eEffectDefinitionV1[] {
  const effects: Dnd5eEffectDefinitionV1[] = []
  const equipment = item.equipment?.effects
  if (equipment) {
    const modifiers: Dnd5eEffectModifierV1[] = []
    if (equipment.weaponAttackBonus) modifiers.push({ kind: 'attack-roll', mode: 'add', value: { kind: 'constant', value: equipment.weaponAttackBonus } })
    if (equipment.weaponDamageBonus) modifiers.push({
      kind: 'weapon-damage-roll', mode: 'add', value: { kind: 'constant', value: equipment.weaponDamageBonus },
      appliesTo: item.equipment?.dnd5e?.kind === 'weapon' ? 'this-weapon' : 'all-weapon-attacks',
    })
    if (equipment.armorClassBonus) modifiers.push({ kind: 'armor-class', mode: 'add', value: { kind: 'constant', value: equipment.armorClassBonus } })
    if (equipment.savingThrowBonus) modifiers.push({ kind: 'saving-throw', mode: 'add', value: { kind: 'constant', value: equipment.savingThrowBonus } })
    if (equipment.speedBonusFeet) modifiers.push({ kind: 'speed', mode: 'add', value: { kind: 'constant', value: equipment.speedBonusFeet } })
    if (modifiers.length) effects.push({
      schemaVersion: 1, id: `${ownerId}.equipment`, name: `${item.name} · equipment`,
      duration: { kind: 'permanent' }, modifiers, stacking: 'unique-by-source',
    })
  }
  for (const [index, headless] of (item.headlessEffects ?? []).entries()) {
    const localId = safeSegment(headless.id ?? `${headless.kind}.${index}`)
    const id = `${ownerId}.headless.${localId}`
    const resource = headless.resourceId ? {
      resourceId: headless.resourceId,
      resourceCost: headless.resourceCost ?? 1,
    } : {}
    let modifier: Dnd5eEffectModifierV1
    let event: 'after-attack-roll' | 'attack-hit' | 'before-damage' | 'before-drop-to-zero'
    let decision: 'automatic' | 'actor-choice' = 'automatic'
    if (headless.kind === 'attack-roll-reroll') {
      modifier = {
        kind: 'attack-roll-reroll', maximumDice: headless.maximumDice,
        appliesTo: headless.appliesTo === 'attacks-with-this-weapon' ? 'this-weapon' : 'all-weapon-attacks',
        ...resource,
      }
      event = 'after-attack-roll'
      decision = 'actor-choice'
    } else if (headless.kind === 'on-hit-bonus-damage') {
      modifier = {
        kind: 'on-hit-bonus-damage', amount: diceFormula(`${id}.damage`, headless.damage),
        damageType: headless.damageType === 'inherit' ? 'inherit-primary' : headless.damageType,
        appliesTo: headless.appliesTo === 'attacks-with-this-weapon' ? 'this-weapon' : 'all-weapon-attacks',
        doubleDiceOnCritical: headless.doubleDiceOnCritical,
        oncePerTurn: headless.oncePerTurn,
        targetCreatureTypes: headless.targetCreatureTypes,
        ...resource,
      }
      event = 'attack-hit'
    } else if (headless.kind === 'damage-reduction') {
      modifier = {
        kind: 'damage-reduction',
        amount: headless.dice ? diceFormula(`${id}.reduction`, headless.dice) : { kind: 'constant', value: headless.amount },
        damageTypes: headless.damageTypes,
        oncePerTurn: headless.oncePerTurn,
        ...resource,
      }
      event = 'before-damage'
    } else {
      modifier = {
        kind: 'death-prevention', hitPointsAfter: headless.hitPointsAfter,
        preventsMassiveDamage: headless.preventsMassiveDamage,
        ...resource,
      }
      event = 'before-drop-to-zero'
    }
    const oncePerTurn = 'oncePerTurn' in headless && headless.oncePerTurn === true
    effects.push({
      schemaVersion: 1, id, name: `${item.name} · ${localId}`,
      duration: { kind: 'permanent' }, modifiers: [modifier],
      triggers: [{
        id: `${id}.trigger`, event, effectId: id, decision,
        ...(oncePerTurn ? { limit: { uses: 1, reset: 'turn' as const } } : {}),
      }],
      stacking: 'unique-by-source',
    })
  }
  return effects
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
    const activities = activitiesBySource.get(`race:${race.id}`) ?? []
    const id = definitionId('race', race.id)
    const effect = permanentEffect(id, race.name, race.staticModifiers)
    const advancements: Dnd5eAdvancementDefinitionV1[] = race.grantedFeatureIds?.length ? [{
      schemaVersion: 1, id: `${id}.features`, level: 1, kind: 'grant',
      grants: race.grantedFeatureIds.map((featureId) => ({ namespace: value.manifest.id, id: definitionId('feature', featureId) })),
    }] : []
    definitions.push(definition(value, 'race', race.id, race.name, race,
      activities.length ? combinedCapability(activities) : automationCapabilityFromLegacyStatus(race.automation ?? 'full', race.automationReasons), {
        description: race.description, activities, effects: effect ? [effect] : [], advancements,
      }))
  }
  for (const background of value.content.backgrounds) {
    const activities = activitiesBySource.get(`background:${background.id}`) ?? []
    const id = definitionId('background', background.id)
    const advancements: Dnd5eAdvancementDefinitionV1[] = background.skillProficiencies.length ? [{
      schemaVersion: 1, id: `${id}.skills`, level: 1, kind: 'proficiency',
      category: 'skill', choices: background.skillProficiencies, count: background.skillProficiencies.length,
    }] : []
    definitions.push(definition(value, 'background', background.id, background.name, background,
      activities.length ? combinedCapability(activities) : automationCapabilityFromLegacyStatus('partial', [
        '技能熟练可在建卡时应用；工具、语言选择与叙事背景特性仍需人物卡或 DM 流程确认',
      ]), {
        description: background.description, activities, advancements,
      }))
  }
  for (const feature of value.content.features) {
    const activities = activitiesBySource.get(`feature:${feature.id}`) ?? []
    const id = definitionId('feature', feature.id)
    const effect = permanentEffect(id, feature.name, feature.staticModifiers)
    const passiveEffects = featurePassiveEffects(id, feature.name, feature)
    definitions.push(definition(value, 'feature', feature.id, feature.name, feature,
      activities.length ? combinedCapability(activities) : automationCapabilityFromLegacyStatus(feature.automation), {
        description: feature.description, activities, effects: [...(effect ? [effect] : []), ...passiveEffects],
      }))
  }
  for (const feat of value.content.feats) {
    const activities = activitiesBySource.get(`feat:${feat.id}`) ?? []
    const id = definitionId('feat', feat.id)
    const effect = permanentEffect(id, feat.name, feat.staticModifiers)
    const passiveEffects = featurePassiveEffects(id, feat.name, feat)
    definitions.push(definition(value, 'feat', feat.id, feat.name, feat,
      activities.length ? combinedCapability(activities) : automationCapabilityFromLegacyStatus(feat.automation), {
        description: feat.description, activities, effects: [...(effect ? [effect] : []), ...passiveEffects],
      }))
  }
  for (const spell of value.content.spells) {
    const activities = activitiesBySource.get(`spell:${spell.id}`) ?? []
    definitions.push(definition(value, 'spell', spell.id, spell.name, spell,
      combinedCapability(activities), { description: spell.description, activities }))
  }
  for (const item of value.content.items) {
    const activities = activitiesBySource.get(`item:${item.id}`) ?? []
    const effects = itemEffectDefinitions(definitionId('item', item.id), item)
    const status = item.magicItem?.automation === 'dm-adjudication'
      ? 'manual' as const
      : activities.length || item.equipment ? 'full' as const : 'reference-only' as const
    definitions.push(definition(value, 'item', item.id, item.name, item,
      activities.length ? combinedCapability(activities) : automationCapabilityFromLegacyStatus(status), {
        description: item.description, activities, effects,
      }))
  }
  for (const method of value.content.abilityGenerationMethods) {
    definitions.push(definition(value, 'ability-generation', method.id, method.name, method,
      automationCapabilityFromLegacyStatus('full'), { description: method.summary }))
  }
  for (const classDefinition of value.content.classes ?? []) {
    const advancements: Dnd5eAdvancementDefinitionV1[] = []
    for (const feature of classDefinition.features) {
      const featureSourceId = `class-feature.${classDefinition.id}.${feature.id}`
      const featureActivities = activitiesBySource.get(`feature:${featureSourceId}`) ?? []
      const featureContentId = definitionId('feature', `class-feature.${classDefinition.id}.${feature.id}`)
      definitions.push(definition(
        value,
        'feature',
        `class-feature.${classDefinition.id}.${feature.id}`,
        feature.name,
        feature,
        featureActivities.length ? combinedCapability(featureActivities) : automationCapabilityFromLegacyStatus(feature.automation),
        { description: feature.description, activities: featureActivities },
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
    const classActivities = activitiesBySource.get(`class:${classDefinition.id}`) ?? []
    definitions.push(definition(
      value,
      'class',
      classDefinition.id,
      classDefinition.name,
      classDefinition,
      classActivities.length ? combinedCapability(classActivities) : automationCapabilityFromLegacyStatus(classStatus),
      { description: classDefinition.summary, activities: classActivities, advancements },
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
    const directSubclassActivities = activitiesBySource.get(`subclass:${subclass.id}`) ?? []
    definitions.push(definition(value, 'subclass', subclass.id, subclass.name, subclass,
      combinedCapability([...subclassActivities, ...directSubclassActivities]), {
        description: subclass.summary, activities: directSubclassActivities, advancements: grants,
      }))
  }
  for (const monster of value.content.monsters) {
    const monsterActivities = activityProjection.entries
      .filter((entry) => entry.sourceKind === 'monster-action' && entry.sourceId.startsWith(`${monster.id}:`))
      .flatMap((entry) => activityProjection.activities.filter((activity) => activity.id === entry.activityId))
    const directMonsterActivities = activitiesBySource.get(`monster:${monster.id}`) ?? []
    definitions.push(definition(value, 'monster', monster.slug, monster.name, monster,
      combinedCapability([...monsterActivities, ...directMonsterActivities]), {
        description: monster.description, activities: [...monsterActivities, ...directMonsterActivities],
      }))
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
