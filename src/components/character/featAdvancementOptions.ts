import { ABILITIES, type AbilityKey } from '../../lib/dnd'
import {
  DND5E_SRD_FEATS,
  dnd5ePluginFeatAvailableForCharacter,
  dnd5ePluginFeatPrerequisiteFailure,
  dnd5eSrdFeatAvailableForCharacter,
  registeredDnd5ePluginFeats,
  type Dnd5eSrdFeatDefinition,
  type Dnd5eAdvancementDefinitionV1,
  type RegisteredDnd5ePluginFeat,
} from '../../rulesets/dnd5e'
import type { Character } from '../../types/character'

export interface Dnd5eAdvancementFeatOption {
  id: string
  name: string
  summary: string
  description: string
  automation: 'full' | 'partial' | 'manual'
  sourceLabel: string
  eligible: boolean
  disabledReason?: string
  advancements?: readonly Dnd5eAdvancementDefinitionV1[]
}

type FeatPrerequisite = {
  minimumLevel?: number
  abilityScores?: Partial<Record<AbilityKey, number>>
  raceIds?: readonly string[]
}

function prerequisiteFailure(
  prerequisite: FeatPrerequisite | undefined,
  character: Character,
): string | undefined {
  if ((prerequisite?.minimumLevel ?? 1) > character.level) {
    return `需要角色等级 ${prerequisite?.minimumLevel}`
  }
  for (const [ability, minimum] of Object.entries(prerequisite?.abilityScores ?? {})) {
    const abilityKey = ability as AbilityKey
    if (character.abilities[abilityKey] < (minimum ?? 0)) {
      return `需要${ABILITIES.find((entry) => entry.key === abilityKey)?.label ?? abilityKey} ${minimum}`
    }
  }
  if (prerequisite?.raceIds?.length) {
    const identities = new Set([character.dnd5eRaceId, character.race].filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    ))
    if (!prerequisite.raceIds.some((raceId) => identities.has(raceId))) {
      return `需要种族：${prerequisite.raceIds.join('／')}`
    }
  }
  return undefined
}

function srdFeatOption(
  feat: Dnd5eSrdFeatDefinition,
  character: Character,
  owned: ReadonlySet<string>,
): Dnd5eAdvancementFeatOption {
  const eligible = !owned.has(feat.id) && dnd5eSrdFeatAvailableForCharacter(feat, character)
  return {
    id: feat.id,
    name: feat.name,
    summary: feat.summary,
    description: feat.description,
    automation: feat.automation,
    sourceLabel: 'SRD 5.1',
    eligible,
    disabledReason: owned.has(feat.id)
      ? '已经拥有'
      : eligible
        ? undefined
        : prerequisiteFailure(feat.prerequisite, character) ?? '不满足前提',
  }
}

function pluginFeatOption(
  feat: RegisteredDnd5ePluginFeat,
  character: Character,
  owned: ReadonlySet<string>,
): Dnd5eAdvancementFeatOption {
  const eligible = !owned.has(feat.id) && dnd5ePluginFeatAvailableForCharacter(feat, character)
  return {
    id: feat.id,
    name: feat.name,
    summary: feat.summary,
    description: feat.description,
    automation: feat.automation,
    sourceLabel: `${feat.ownerPluginName} · ${feat.ownerPluginLicense}`,
    eligible,
    disabledReason: owned.has(feat.id)
      ? '已经拥有'
      : eligible
        ? undefined
        : dnd5ePluginFeatPrerequisiteFailure(feat, character) ?? '不满足规则包前提',
    advancements: feat.advancements?.map((advancement) => structuredClone(advancement)),
  }
}

export function dnd5eAdvancementFeatOptions(
  character: Character,
  pluginFeats: readonly RegisteredDnd5ePluginFeat[] = registeredDnd5ePluginFeats(),
): readonly Dnd5eAdvancementFeatOption[] {
  const owned = new Set(character.dnd5eFeatIds ?? [])
  const byId = new Map<string, Dnd5eAdvancementFeatOption>()
  for (const feat of DND5E_SRD_FEATS) byId.set(feat.id, srdFeatOption(feat, character, owned))
  for (const feat of pluginFeats) byId.set(feat.id, pluginFeatOption(feat, character, owned))
  return [...byId.values()].sort((left, right) => (
    Number(right.eligible) - Number(left.eligible) || left.name.localeCompare(right.name, 'zh-CN')
  ))
}
