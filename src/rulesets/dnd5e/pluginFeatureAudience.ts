import type { Dnd5eMonsterAction, Dnd5eMonsterTrait } from './monsters'

export type Dnd5ePluginFeatureAudience =
  | 'character'
  | 'monster-trait'
  | 'monster-action'

export interface Dnd5ePluginFeatureAudienceMatch {
  audience: Dnd5ePluginFeatureAudience
  monsterNames: readonly string[]
}

interface PluginFeatureAudienceSource {
  id?: string
  name: string
  ownerPluginId: string
  sourceLabel?: string
  summary?: string
  description?: string
  sourceClassId?: string
  sourceSubclassId?: string
  sourceFeatId?: string
  grantedBySubclass?: boolean
  grantedByFeat?: boolean
}

interface MonsterFeatureAudienceSource {
  id?: string
  slug?: string
  name: string
  ownerPluginId?: string
  traits: readonly Pick<Dnd5eMonsterTrait, 'name' | 'description'>[]
  actions: readonly Pick<Dnd5eMonsterAction, 'name' | 'description'>[]
  bonusActions?: readonly Pick<Dnd5eMonsterAction, 'name' | 'description'>[]
  reactions?: readonly Pick<Dnd5eMonsterAction, 'name' | 'description'>[]
  legendaryActions?: readonly Pick<Dnd5eMonsterAction, 'name' | 'description'>[]
  lairActions?: readonly Pick<Dnd5eMonsterAction, 'name' | 'description'>[]
  headlessMechanics?: readonly { name: string }[]
  spellcasting?: unknown
}

function normalizedRuleName(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s·•:：,，.。()（）[\]【】「」『』“”"'‘’_\-—]/g, '')
}

function sameRuleName(left: string, right: string): boolean {
  const normalizedLeft = normalizedRuleName(left)
  const normalizedRight = normalizedRuleName(right)
  if (!normalizedLeft || !normalizedRight) return false
  if (normalizedLeft === normalizedRight) return true

  // Imported stat blocks commonly append an English name to the Chinese label,
  // for example “法杖敲击 Staff Strike”. Keep the fallback conservative so
  // short, generic labels such as “攻击” are not classified by accident.
  const shorter = normalizedLeft.length <= normalizedRight.length ? normalizedLeft : normalizedRight
  const longer = shorter === normalizedLeft ? normalizedRight : normalizedLeft
  return shorter.length >= 4 && longer.startsWith(shorter)
}

function normalizedRuleDescription(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

function sameRuleDescription(feature: PluginFeatureAudienceSource, ruleDescription: string): boolean {
  const featureDescription = normalizedRuleDescription(feature.description ?? feature.summary ?? '')
  const monsterDescription = normalizedRuleDescription(ruleDescription)
  if (featureDescription.length < 8 || monsterDescription.length < 8) return false
  return featureDescription === monsterDescription ||
    featureDescription.includes(monsterDescription) ||
    monsterDescription.includes(featureDescription)
}

function isRoomPasteFeature(feature: PluginFeatureAudienceSource): boolean {
  return feature.ownerPluginId.startsWith('local.room.paste-')
}

function legacyMonsterIdPrefixMatches(
  feature: PluginFeatureAudienceSource,
  monster: MonsterFeatureAudienceSource,
): boolean {
  if (!isRoomPasteFeature(feature) || !feature.id) return false
  const localFeatureId = feature.id.slice(feature.id.lastIndexOf(':') + 1).toLocaleLowerCase('en-US')
  const monsterSlug = (monster.slug ?? monster.id?.slice(monster.id.lastIndexOf(':') + 1) ?? '')
    .toLocaleLowerCase('en-US')
  const featurePrefix = localFeatureId.split('-')[0] ?? ''
  const monsterPrefix = monsterSlug.split('-')[0] ?? ''
  return featurePrefix.length >= 4 && featurePrefix === monsterPrefix
}

function matchingMonsterNames(
  feature: PluginFeatureAudienceSource,
  monsters: readonly MonsterFeatureAudienceSource[],
  selectRules: (monster: MonsterFeatureAudienceSource) => readonly Pick<Dnd5eMonsterAction | Dnd5eMonsterTrait, 'name' | 'description'>[],
): string[] {
  return [...new Set(monsters.flatMap((monster) => {
    if (monster.ownerPluginId && monster.ownerPluginId !== feature.ownerPluginId) return []
    return selectRules(monster).some((rule) =>
      sameRuleName(feature.name, rule.name) &&
      (
        monster.ownerPluginId != null ||
        isRoomPasteFeature(feature) ||
        sameRuleDescription(feature, rule.description)
      ))
      ? [monster.name]
      : []
  }))]
}

/**
 * Separates character-selectable plugin features from legacy monster traits
 * and actions that were once imported as top-level features.
 */
export function classifyDnd5ePluginFeatureAudience(
  feature: PluginFeatureAudienceSource,
  monsters: readonly MonsterFeatureAudienceSource[],
): Dnd5ePluginFeatureAudienceMatch {
  if (
    feature.sourceClassId || feature.sourceSubclassId || feature.sourceFeatId ||
    feature.grantedBySubclass || feature.grantedByFeat
  ) {
    return { audience: 'character', monsterNames: [] }
  }

  const actionMonsterNames = matchingMonsterNames(feature, monsters, (monster) => [
    ...monster.actions,
    ...(monster.bonusActions ?? []),
    ...(monster.reactions ?? []),
    ...(monster.legendaryActions ?? []),
    ...(monster.lairActions ?? []),
  ])
  if (actionMonsterNames.length > 0) {
    return { audience: 'monster-action', monsterNames: actionMonsterNames }
  }

  const traitMonsterNames = matchingMonsterNames(feature, monsters, (monster) => [
    ...monster.traits,
    ...(monster.headlessMechanics ?? []).map((mechanic) => ({
      name: mechanic.name,
      description: '',
    })),
  ])
  if (traitMonsterNames.length > 0) {
    return { audience: 'monster-trait', monsterNames: traitMonsterNames }
  }

  const spellcastingMonsterNames = [...new Set(monsters.flatMap((monster) =>
    monster.spellcasting &&
    legacyMonsterIdPrefixMatches(feature, monster) &&
    (
      normalizedRuleName(feature.name) === '施法' ||
      feature.id?.toLocaleLowerCase('en-US').endsWith('-spellcasting')
    )
      ? [monster.name]
      : []))]
  if (spellcastingMonsterNames.length > 0) {
    return { audience: 'monster-trait', monsterNames: spellcastingMonsterNames }
  }

  const sourceLabel = normalizedRuleName(feature.sourceLabel ?? '')
  if (sourceLabel.includes('怪物') || sourceLabel.includes('monster')) {
    return { audience: 'monster-trait', monsterNames: [] }
  }

  return { audience: 'character', monsterNames: [] }
}
