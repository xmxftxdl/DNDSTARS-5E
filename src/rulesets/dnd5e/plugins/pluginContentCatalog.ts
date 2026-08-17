import type { ClassResourceDefinition } from '../../../lib/classDefinitionTypes'
import type { AbilityKey } from '../../../lib/dnd'
import type { Character } from '../../../types/character'
import { dnd5eCharacterBuildFeatureIdsV1 } from '../buildChoices'
import { dnd5eCharacterClassLevel, normalizeDnd5eClassLevels } from '../classLevels'
import type { Dnd5eClassId } from '../classes'
import {
  declarativeSubclassResourceDieSidesV1,
  type DeclarativeSubclassSpellListV1,
} from '../declarativeSubclassAbility'
import type {
  Dnd5ePluginFeatureAction,
  Dnd5ePluginStaticCombatModifiers,
  Dnd5ePluginSubclassChoiceGroup,
} from '../pluginApi'
import { dnd5ePluginSubclassRegistry as pluginSubclasses } from '../pluginSubclassRegistry'
import { declarativeResourceMaximumForCharacter } from './pluginDeclarativeCompiler'
import type {
  RegisteredDnd5ePluginAbilityGeneration,
  RegisteredDnd5ePluginBackground,
  RegisteredDnd5ePluginFeat,
  RegisteredDnd5ePluginFeature,
  RegisteredDnd5ePluginItem,
  RegisteredDnd5ePluginMonster,
  RegisteredDnd5ePluginRace,
  RegisteredDnd5ePluginResource,
  RegisteredDnd5ePluginSpell,
  RegisteredDnd5ePluginSubclass,
} from './pluginRegistryContracts'
import { dnd5ePluginRegistryStore } from './pluginRegistryStore'
import {
  dnd5eBaseArmorProficiencies,
  dnd5eBaseSpellcastingCapabilityV1,
} from '../characterCapabilities'
import { declarativeClassGrantedFeatureIdsV1 } from '../declarativeClass'
import { dnd5eCharacterBuildProficienciesV1 } from '../buildChoices'

const {
  features: pluginFeatures,
  feats: pluginFeats,
  resources: pluginResources,
  races: pluginRaces,
  backgrounds: pluginBackgrounds,
  abilityGenerationMethods: pluginAbilityGenerationMethods,
  spells: pluginSpells,
  items: pluginItems,
  monsters: pluginMonsters,
} = dnd5ePluginRegistryStore

function clonePluginFeatureAction(
  action: Dnd5ePluginFeatureAction | undefined,
): Dnd5ePluginFeatureAction | undefined {
  return action ? structuredClone(action) : undefined
}

function cloneRegisteredStaticModifiers(
  value: Dnd5ePluginStaticCombatModifiers | undefined,
): Dnd5ePluginStaticCombatModifiers | undefined {
  return value ? {
    ...value,
    damageResistances: value.damageResistances ? [...value.damageResistances] : undefined,
    damageImmunities: value.damageImmunities ? [...value.damageImmunities] : undefined,
    conditionImmunities: value.conditionImmunities ? [...value.conditionImmunities] : undefined,
  } : undefined
}

export function registeredDnd5ePluginFeatures(): readonly RegisteredDnd5ePluginFeature[] {
  return [...pluginFeatures.values()]
    .map((feature) => ({
      ...feature,
      action: clonePluginFeatureAction(feature.action),
      declarativeAbility: feature.declarativeAbility ? structuredClone(feature.declarativeAbility) : undefined,
      automationReasons: feature.automationReasons ? [...feature.automationReasons] : undefined,
      staticModifiers: cloneRegisteredStaticModifiers(feature.staticModifiers),
      passiveEffects: feature.passiveEffects?.map((effect) => structuredClone(effect)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function registeredDnd5ePluginResources(): readonly RegisteredDnd5ePluginResource[] {
  return [...pluginResources.values()]
    .map((resource) => ({
      ...resource,
      maximum: Array.isArray(resource.maximum) ? [...resource.maximum] : resource.maximum,
      declarativeMaximum: resource.declarativeMaximum ? structuredClone(resource.declarativeMaximum) : undefined,
      declarativeDie: resource.declarativeDie ? structuredClone(resource.declarativeDie) : undefined,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'))
}

export function registeredDnd5ePluginSubclasses(
  classId?: Dnd5eClassId,
): readonly RegisteredDnd5ePluginSubclass[] {
  return [...pluginSubclasses.values()]
    .filter((subclass) => !classId || subclass.classId === classId)
    .map((subclass) => ({
      ...subclass,
      features: subclass.features.map((feature) => ({
        ...feature,
        action: clonePluginFeatureAction(feature.action),
        declarativeAbility: feature.declarativeAbility ? structuredClone(feature.declarativeAbility) : undefined,
        automationReasons: feature.automationReasons ? [...feature.automationReasons] : undefined,
      })),
      choiceGroups: subclass.choiceGroups?.map((group) => ({
        ...group,
        maxSelectionsByLevel: group.maxSelectionsByLevel?.map((step) => ({ ...step })),
        options: group.options.map((option) => ({ ...option })),
      })),
      spellLists: subclass.spellLists?.map((list) => ({
        ...list,
        entries: list.entries.map((entry) => ({ ...entry, spellIds: [...entry.spellIds] })),
      })),
      declarativeSpellcasting: subclass.declarativeSpellcasting
        ? structuredClone(subclass.declarativeSpellcasting)
        : undefined,
      declarativeCombatHooks: subclass.declarativeCombatHooks
        ? structuredClone(subclass.declarativeCombatHooks)
        : undefined,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function dnd5ePluginSubclassDefinition(subclassId: string): RegisteredDnd5ePluginSubclass | undefined {
  return registeredDnd5ePluginSubclasses().find((subclass) => subclass.id === subclassId)
}

export function dnd5ePluginSubclassSpellIds(
  subclassId: string | undefined,
  classLevel: number,
  mode?: DeclarativeSubclassSpellListV1['mode'],
): readonly string[] {
  if (!subclassId || classLevel < 1) return []
  const subclass = dnd5ePluginSubclassDefinition(subclassId)
  return [...new Set((subclass?.spellLists ?? [])
    .filter((list) => !mode || list.mode === mode)
    .flatMap((list) => list.entries
      .filter((entry) => entry.classLevel <= classLevel)
      .flatMap((entry) => entry.spellIds))
    .map((spellId) => {
      if (pluginSpells.has(spellId)) return spellId
      const ownedSpellId = `${subclass!.ownerPluginId}:${spellId}`
      return pluginSpells.has(ownedSpellId) ? ownedSpellId : spellId
    }))]
}

export function dnd5ePluginResourceDefinition(resourceId: string): RegisteredDnd5ePluginResource | undefined {
  return registeredDnd5ePluginResources().find((resource) => resource.id === resourceId)
}

export function dnd5ePluginSubclassChoiceLimit(
  group: Dnd5ePluginSubclassChoiceGroup,
  classLevel: number,
): number {
  let maximum = group.maxSelections
  for (const step of group.maxSelectionsByLevel ?? []) {
    if (classLevel < step.level) break
    maximum = step.maxSelections
  }
  return Math.max(0, Math.min(group.options.length, Math.floor(maximum)))
}

export function dnd5ePluginResourceDieSides(
  resource: Pick<RegisteredDnd5ePluginResource, 'classId' | 'declarativeDie'>,
  character: Character,
): number | undefined {
  return resource.declarativeDie
    ? declarativeSubclassResourceDieSidesV1(
        resource.declarativeDie,
        dnd5eCharacterClassLevel(character, resource.classId),
      )
    : undefined
}

function selectedDnd5eSubclassId(character: Character, classId: Dnd5eClassId): string | undefined {
  return classId === 'fighter'
    ? character.dnd5eClassChoices?.fighter?.subclass
    : character.dnd5eClassChoices?.classes?.[classId]?.subclass
}

export function dnd5ePluginClassResourceDefinitions(character: Character): readonly ClassResourceDefinition[] {
  const classLevels = normalizeDnd5eClassLevels(character)
  return registeredDnd5ePluginResources()
    .filter((resource) => (classLevels[resource.classId] ?? 0) > 0)
    .map((resource) => ({
      key: resource.id,
      label: resource.label,
      shortLabel: resource.shortLabel,
      resetOn: resource.resetOn,
      isAvailable: (candidate: Character) =>
        dnd5eCharacterClassLevel(candidate, resource.classId) >= (resource.minimumLevel ?? 1) &&
        (!resource.subclassId || selectedDnd5eSubclassId(candidate, resource.classId) === resource.subclassId),
      max: (candidate: Character) => {
        if (resource.declarativeMaximum) {
          return declarativeResourceMaximumForCharacter(resource.declarativeMaximum, candidate)
        }
        if (!Array.isArray(resource.maximum)) return resource.maximum
        const classLevel = dnd5eCharacterClassLevel(candidate, resource.classId)
        return resource.maximum[Math.min(resource.maximum.length, Math.max(1, classLevel)) - 1] ?? 0
      },
    }))
}

export function dnd5ePluginFeatResourceDefinitions(character: Character): readonly ClassResourceDefinition[] {
  return [...pluginFeats.values()]
    .filter((feat) => character.dnd5eFeatIds?.includes(feat.id) === true)
    .flatMap((feat) => (feat.resources ?? []).map((resource) => ({
      key: resource.id,
      label: resource.label,
      shortLabel: resource.shortLabel,
      resetOn: resource.resetOn,
      stacking: resource.stacking,
      isAvailable: (candidate: Character) =>
        candidate.dnd5eFeatIds?.includes(feat.id) === true &&
        dnd5ePluginFeatAvailableForCharacter(feat, candidate),
      max: () => resource.maximum,
    })))
}

export function registeredDnd5ePluginRaces(): readonly RegisteredDnd5ePluginRace[] {
  return [...pluginRaces.values()]
    .map((race) => ({
      ...race,
      abilityBonuses: { ...race.abilityBonuses },
      flexibleAbilityBonus: race.flexibleAbilityBonus ? {
        ...race.flexibleAbilityBonus,
        ...(race.flexibleAbilityBonus.exclude ? { exclude: [...race.flexibleAbilityBonus.exclude] } : {}),
      } : undefined,
      skillProficiencies: race.skillProficiencies ? [...race.skillProficiencies] : undefined,
      languages: race.languages ? [...race.languages] : undefined,
      traits: race.traits?.map((trait) => ({ ...trait })),
      staticModifiers: cloneRegisteredStaticModifiers(race.staticModifiers),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function dnd5ePluginRaceDefinition(idOrName: string): RegisteredDnd5ePluginRace | undefined {
  const race = pluginRaces.get(idOrName) ?? [...pluginRaces.values()].find((candidate) => candidate.name === idOrName)
  return race ? {
    ...race,
    abilityBonuses: { ...race.abilityBonuses },
    flexibleAbilityBonus: race.flexibleAbilityBonus ? {
      ...race.flexibleAbilityBonus,
      ...(race.flexibleAbilityBonus.exclude ? { exclude: [...race.flexibleAbilityBonus.exclude] } : {}),
    } : undefined,
    skillProficiencies: race.skillProficiencies ? [...race.skillProficiencies] : undefined,
    languages: race.languages ? [...race.languages] : undefined,
    traits: race.traits?.map((trait) => ({ ...trait })),
    staticModifiers: cloneRegisteredStaticModifiers(race.staticModifiers),
  } : undefined
}

function cloneRegisteredFeat(feat: RegisteredDnd5ePluginFeat): RegisteredDnd5ePluginFeat {
  return {
    ...feat,
    prerequisite: feat.prerequisite ? {
      ...feat.prerequisite,
      abilityScores: feat.prerequisite.abilityScores ? { ...feat.prerequisite.abilityScores } : undefined,
      anyAbilityScores: feat.prerequisite.anyAbilityScores ? { ...feat.prerequisite.anyAbilityScores } : undefined,
      raceIds: feat.prerequisite.raceIds ? [...feat.prerequisite.raceIds] : undefined,
      armorProficiencies: feat.prerequisite.armorProficiencies
        ? [...feat.prerequisite.armorProficiencies]
        : undefined,
    } : undefined,
    action: clonePluginFeatureAction(feat.action),
    staticModifiers: cloneRegisteredStaticModifiers(feat.staticModifiers),
    passiveEffects: feat.passiveEffects?.map((effect) => structuredClone(effect)),
    resources: feat.resources?.map((resource) => ({ ...resource })),
    advancements: feat.advancements?.map((advancement) => structuredClone(advancement)),
  }
}

export function registeredDnd5ePluginFeats(): readonly RegisteredDnd5ePluginFeat[] {
  return [...pluginFeats.values()]
    .map(cloneRegisteredFeat)
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function dnd5ePluginFeatDefinition(featId: string): RegisteredDnd5ePluginFeat | undefined {
  const feat = pluginFeats.get(featId)
  return feat ? cloneRegisteredFeat(feat) : undefined
}

export function dnd5ePluginFeatAvailableForCharacter(
  feat: RegisteredDnd5ePluginFeat,
  character: Character,
): boolean {
  const feature = pluginFeatures.get(feat.featureId)
  return !!feature && dnd5ePluginFeatureAvailableForCharacter(feature, character)
}

export function dnd5ePluginFeatPrerequisiteFailure(
  feat: RegisteredDnd5ePluginFeat,
  character: Character,
): string | undefined {
  const prerequisite = feat.prerequisite
  if ((prerequisite?.minimumLevel ?? 1) > character.level) return `需要角色等级 ${prerequisite?.minimumLevel}`
  for (const [ability, score] of Object.entries(prerequisite?.abilityScores ?? {})) {
    if (character.abilities[ability as AbilityKey] < (score ?? 0)) return `需要 ${ability.toUpperCase()} ${score}`
  }
  const anyAbilityScores = Object.entries(prerequisite?.anyAbilityScores ?? {})
  if (anyAbilityScores.length > 0 && !anyAbilityScores.some(([ability, score]) =>
    character.abilities[ability as AbilityKey] >= (score ?? 0))) {
    return `需要满足其一：${anyAbilityScores.map(([ability, score]) => `${ability.toUpperCase()} ${score}`).join('／')}`
  }
  if (prerequisite?.raceIds?.length) {
    const identities = new Set([character.dnd5eRaceId, character.race].filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    ))
    if (!prerequisite.raceIds.some((raceId) => identities.has(raceId))) {
      return `需要种族：${prerequisite.raceIds.join('／')}`
    }
  }
  if (prerequisite?.armorProficiencies?.length) {
    const armorProficiencies = new Set(dnd5eBaseArmorProficiencies(character))
    for (const proficiency of pluginRaces.get(character.dnd5eRaceId ?? character.race)?.armorProficiencies ?? []) {
      armorProficiencies.add(proficiency)
    }
    for (const proficiency of dnd5eCharacterBuildProficienciesV1(character, 'armor')) {
      if (['light', 'medium', 'heavy', 'shield'].includes(proficiency)) {
        armorProficiencies.add(proficiency as 'light' | 'medium' | 'heavy' | 'shield')
      }
    }
    const missing = prerequisite.armorProficiencies.filter((proficiency) => !armorProficiencies.has(proficiency))
    if (missing.length) return `需要护甲熟练：${missing.join('／')}`
  }
  if (prerequisite?.spellcasting != null) {
    const base = dnd5eBaseSpellcastingCapabilityV1(character)
    const raceCanCast = (pluginRaces.get(character.dnd5eRaceId ?? character.race)?.innateSpells?.length ?? 0) > 0
    if ((base.capable || raceCanCast) !== prerequisite.spellcasting) {
      return prerequisite.spellcasting ? '需要至少一个可用的施法来源' : '不能具备施法能力'
    }
  }
  return undefined
}

function cloneRegisteredBackground(background: RegisteredDnd5ePluginBackground): RegisteredDnd5ePluginBackground {
  return {
    ...background,
    skillProficiencies: [...background.skillProficiencies],
    toolProficiencies: background.toolProficiencies ? [...background.toolProficiencies] : undefined,
    toolProficiencyChoices: background.toolProficiencyChoices?.map((choice) => ({
      ...choice,
      options: [...choice.options],
    })),
    feature: background.feature ? { ...background.feature } : undefined,
    variants: background.variants?.map((variant) => ({
      ...variant,
      feature: variant.feature ? { ...variant.feature } : undefined,
    })),
    startingEquipment: background.startingEquipment
      ? structuredClone(background.startingEquipment)
      : undefined,
  }
}

export function registeredDnd5ePluginBackgrounds(): readonly RegisteredDnd5ePluginBackground[] {
  return [...pluginBackgrounds.values()]
    .map(cloneRegisteredBackground)
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function dnd5ePluginBackgroundDefinition(idOrName: string): RegisteredDnd5ePluginBackground | undefined {
  const background = pluginBackgrounds.get(idOrName) ??
    [...pluginBackgrounds.values()].find((candidate) => candidate.name === idOrName)
  return background ? cloneRegisteredBackground(background) : undefined
}

export function registeredDnd5ePluginAbilityGenerationMethods(): readonly RegisteredDnd5ePluginAbilityGeneration[] {
  return [...pluginAbilityGenerationMethods.values()]
    .map((method) => method.kind === 'standard-array'
      ? { ...method, scores: [...method.scores] }
      : method.kind === 'point-buy'
        ? { ...method, costs: { ...method.costs } }
        : { ...method })
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function registeredDnd5ePluginSpells(): readonly RegisteredDnd5ePluginSpell[] {
  return [...pluginSpells.values()]
    .map((spell) => ({
      ...spell,
      classes: [...spell.classes],
      components: { ...spell.components },
      castingTime: { ...spell.castingTime },
      range: { ...spell.range },
      targeting: spell.targeting ? { ...spell.targeting } : undefined,
      duration: { ...spell.duration },
      tags: spell.tags ? [...spell.tags] : undefined,
      mechanics: spell.mechanics ? structuredClone(spell.mechanics) : undefined,
      source: { ...spell.source },
      automation: { ...spell.automation },
    }))
    .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name, 'zh-CN'))
}

export function dnd5ePluginSpellDefinition(id: string): RegisteredDnd5ePluginSpell | undefined {
  return registeredDnd5ePluginSpells().find((spell) => spell.id === id)
}

function cloneRegisteredPluginItem(item: RegisteredDnd5ePluginItem): RegisteredDnd5ePluginItem {
  return {
    ...item,
    cost: item.cost ? { ...item.cost } : undefined,
    equipment: item.equipment ? structuredClone(item.equipment) : undefined,
    magicItem: item.magicItem ? { ...item.magicItem } : undefined,
    use: item.use ? structuredClone(item.use) : undefined,
    source: { ...item.source },
  }
}

export function registeredDnd5ePluginItems(): readonly RegisteredDnd5ePluginItem[] {
  return [...pluginItems.values()]
    .map(cloneRegisteredPluginItem)
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function dnd5ePluginItemDefinition(id: string): RegisteredDnd5ePluginItem | undefined {
  const item = pluginItems.get(id)
  return item ? cloneRegisteredPluginItem(item) : undefined
}

export function registeredDnd5ePluginMonsters(): readonly RegisteredDnd5ePluginMonster[] {
  return [...pluginMonsters.values()]
    .map((monster) => structuredClone(monster))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

export function dnd5ePluginAbilityGenerationMethod(
  id: string,
): RegisteredDnd5ePluginAbilityGeneration | undefined {
  const method = pluginAbilityGenerationMethods.get(id)
  if (!method) return undefined
  if (method.kind === 'standard-array') return { ...method, scores: [...method.scores] }
  if (method.kind === 'point-buy') return { ...method, costs: { ...method.costs } }
  return { ...method }
}

export function dnd5ePluginFeatureDefinition(featureId: string): RegisteredDnd5ePluginFeature | undefined {
  const feature = pluginFeatures.get(featureId)
  return feature ? {
    ...feature,
    action: clonePluginFeatureAction(feature.action),
    declarativeAbility: feature.declarativeAbility ? structuredClone(feature.declarativeAbility) : undefined,
    automationReasons: feature.automationReasons ? [...feature.automationReasons] : undefined,
    staticModifiers: cloneRegisteredStaticModifiers(feature.staticModifiers),
    passiveEffects: feature.passiveEffects?.map((effect) => structuredClone(effect)),
  } : undefined
}

export function dnd5ePluginFeatureAvailableForCharacter(
  feature: RegisteredDnd5ePluginFeature,
  character: Character,
): boolean {
  const grantedByBuildChoice = dnd5eCharacterBuildFeatureIdsV1(character).includes(feature.id)
  if (grantedByBuildChoice) return true
  if (feature.sourceFeatId) {
    const feat = pluginFeats.get(feature.sourceFeatId)
    if (!feat) return false
    if (dnd5ePluginFeatPrerequisiteFailure(feat, character)) return false
  }
  if (feature.sourceClassId) {
    const classLevel = dnd5eCharacterClassLevel(character, feature.sourceClassId)
    if (classLevel < (feature.minimumLevel ?? 1)) return false
    if (
      feature.sourceSubclassId &&
      selectedDnd5eSubclassId(character, feature.sourceClassId) !== feature.sourceSubclassId
    ) return false
    for (const requirement of feature.declarativeAbility?.predicates?.subclassChoices ?? []) {
      if (!feature.sourceSubclassId) return false
      const selectionKey = `${feature.sourceSubclassId}/${requirement.groupId}`
      const selected = feature.sourceClassId === 'fighter'
        ? character.dnd5eClassChoices?.fighter?.extensionChoices?.[selectionKey]
        : character.dnd5eClassChoices?.classes?.[feature.sourceClassId]?.selections?.[selectionKey]
      if (!selected?.includes(requirement.optionId)) return false
    }
  }
  return (!feature.sourceClassId && character.level < (feature.minimumLevel ?? 1))
    ? false
    : (feature.isAvailable?.(character) ?? true)
}

export function dnd5eCharacterHasPluginFeature(character: Character, featureId: string): boolean {
  const feature = pluginFeatures.get(featureId)
  if (!feature || !dnd5ePluginFeatureAvailableForCharacter(feature, character)) return false
  if (feature.grantedBySubclass === true) return true
  if (feature.grantedByFeat === true) {
    return !!feature.sourceFeatId && character.dnd5eFeatIds?.includes(feature.sourceFeatId) === true
  }
  const race = dnd5ePluginRaceDefinition(character.dnd5eRaceId ?? character.race)
  if (race?.grantedFeatureIds?.includes(featureId)) return true
  if (declarativeClassGrantedFeatureIdsV1(character).includes(featureId)) return true
  if (dnd5eCharacterBuildFeatureIdsV1(character).includes(featureId)) return true
  return character.dnd5ePluginFeatureIds?.includes(featureId) === true
}

/** Closed boolean capability projection shared by equipment and spell-component authorities. */
export function dnd5ePluginBooleanStaticModifierForCharacter(
  character: Character,
  key: 'allowNonLightTwoWeaponFighting' | 'ignoreOccupiedHandsForSomaticComponents',
): boolean {
  return [...pluginFeatures.values()].some((feature) =>
    feature.automation !== 'manual' && feature.staticModifiers?.[key] === true &&
    dnd5eCharacterHasPluginFeature(character, feature.id)
  )
}
