import { dnd5eGrantedActivityTargetsAllowed, effectiveDnd5eActiveEffects, type Dnd5eActiveEffectInstance } from '../activeEffects'
import { normalizeDnd5eEffectGrantCharges } from '../effectGrantCharges'
import type { Character } from '../../../types/character'
import type { Dnd5eCombatant } from '../headlessCombatEngine'
import type { Dnd5eActivityDefinitionV1, Dnd5eActivityTriggerContextV1 } from './dnd5eActivityContracts'
import { dnd5eCharacterBuildSpellGrantsV1 } from '../buildChoices'
import { dnd5eCharacterHasPluginFeature, registeredDnd5ePluginFeatures } from '../plugins/pluginContentCatalog'

/** Resolve the source tuple through registered metadata, not punctuation replacement. */
export function dnd5eRegisteredSubclassActivityFeature(packageId: string, sourceId: string) {
  const matches = registeredDnd5ePluginFeatures().filter(feature => {
    if (feature.ownerPluginId !== packageId || !feature.sourceSubclassId || !feature.declarativeAbility) return false
    const prefix = `${packageId}:`
    if (!feature.sourceSubclassId.startsWith(prefix)) return false
    return `${feature.sourceSubclassId.slice(prefix.length)}:${feature.declarativeAbility.id}` === sourceId
  })
  return matches.length === 1 ? matches[0] : undefined
}

export function dnd5eActivityUsesExecutionGrant(activity: Dnd5eActivityDefinitionV1): boolean {
  return activity.invocation?.kind === 'triggered' && activity.invocation.effectGrantScope === 'trigger-execution'
}

export function dnd5eActivityGrantChargeAvailable(effect: Dnd5eActiveEffectInstance, activity: Dnd5eActivityDefinitionV1): boolean {
  const cost = activity.effectGrantChargeCost
  return cost == null || Number.isSafeInteger(cost) && cost >= 1 && cost <= 1000 &&
    (normalizeDnd5eEffectGrantCharges(effect.grantedActivityCharges)?.current ?? 0) >= cost
}

/** Host event provenance is mandatory; absent provenance never authorizes a grant. */
export function dnd5eActivityExecutionGrant(input: {
  packageId: string; activity: Dnd5eActivityDefinitionV1; combatant: Dnd5eCombatant
  targetIds?: readonly string[]; triggerContext?: Dnd5eActivityTriggerContextV1
}) {
  const executionId = input.triggerContext?.source.executionId
  if (!executionId) return undefined
  return input.combatant.classState.activeEffects?.find(effect =>
    effect.source.executionId === executionId &&
    (effect.source.pluginId ?? (effect.source.kind === 'spell' ? 'srd-5.1' : undefined)) === input.packageId &&
    effect.grantedActivities?.includes(input.activity.id) &&
    dnd5eActivityGrantChargeAvailable(effect, input.activity) &&
    dnd5eGrantedActivityTargetsAllowed(effect, input.targetIds))
}

function identityCandidates(packageId: string, id: string): ReadonlySet<string> {
  return new Set([id, `${packageId}:${id}`])
}

function includesIdentity(values: readonly string[] | undefined, candidates: ReadonlySet<string>): boolean {
  return values?.some((value) => candidates.has(value)) === true
}

/**
 * Fail-closed entitlement check for the generic Activity runtime. Legacy
 * source metadata is used only as an ownership binding; execution still uses
 * the Activity recipe and never dispatches back into a legacy resolver.
 */
export function dnd5eCombatantEntitledToActivityV1(input: {
  packageId: string
  activity: Dnd5eActivityDefinitionV1
  combatant: Dnd5eCombatant
  character?: Character
  targetIds?: readonly string[]
  triggerContext?: Dnd5eActivityTriggerContextV1
  grantEffectId?: string
}): boolean {
  const source = input.activity.legacySource
  if (!source) return false
  if (input.grantEffectId !== undefined) {
    const grant = effectiveDnd5eActiveEffects(input.combatant.classState.activeEffects).find(effect => effect.id === input.grantEffectId)
    return !!grant &&
      (grant.source.pluginId ?? (grant.source.kind === 'spell' ? 'srd-5.1' : undefined)) === input.packageId &&
      !!grant.grantedActivities?.includes(input.activity.id) &&
      dnd5eActivityGrantChargeAvailable(grant, input.activity) &&
      dnd5eGrantedActivityTargetsAllowed(grant, input.targetIds) &&
      (!dnd5eActivityUsesExecutionGrant(input.activity) ||
        (!!input.triggerContext?.source.executionId && grant.source.executionId === input.triggerContext.source.executionId))
  }
  if (dnd5eActivityUsesExecutionGrant(input.activity)) return !!dnd5eActivityExecutionGrant(input)
  if ((input.combatant.classState.activeEffects ?? []).some(effect =>
    dnd5eActivityGrantChargeAvailable(effect, input.activity) &&
    dnd5eGrantedActivityTargetsAllowed(effect, input.targetIds) &&
    (effect.source.pluginId ?? (effect.source.kind === 'spell' ? 'srd-5.1' : undefined)) === input.packageId &&
    effect.grantedActivities?.includes(input.activity.id))) return true
  if (input.activity.requiresEffectGrant) return false
  const candidates = identityCandidates(input.packageId, source.id)
  const featureIds = input.combatant.pluginFeatureIds
  if (source.kind === 'subclass-ability') {
    const feature = dnd5eRegisteredSubclassActivityFeature(input.packageId, source.id)
    const classId = feature?.sourceClassId
    if (!feature || !classId || !featureIds.includes(feature.id)) return false
    const actor = input.combatant
    const classLevel = actor.classLevels?.[classId] ?? (actor.classId === classId ? actor.level : 0)
    const subclassId = actor.subclassIds?.[classId] ?? (actor.classId === classId ? actor.subclassId : undefined)
    if (!Number.isInteger(classLevel) || classLevel < (feature.minimumLevel ?? 1) || subclassId !== feature.sourceSubclassId) return false
    for (const requirement of feature.declarativeAbility?.predicates?.subclassChoices ?? []) {
      const key = `${feature.sourceSubclassId}/${requirement.groupId}`
      const choices = actor.classSelectionsByClass?.[classId]?.[key] ?? (actor.classId === classId ? actor.classSelections[key] : undefined)
      if (!choices?.includes(requirement.optionId)) return false
    }
    return !input.character || dnd5eCharacterHasPluginFeature(input.character, feature.id)
  }
  if (
    source.kind === 'feature' || source.kind === 'feat' || source.kind === 'class' ||
    source.kind === 'subclass'
  ) {
    if (includesIdentity(featureIds, candidates)) return true
    if (source.kind === 'feat' && includesIdentity(input.character?.dnd5eFeatIds, candidates)) return true
    if (source.kind === 'class') {
      return Object.entries(input.combatant.classLevels ?? {}).some(([id, level]) =>
        candidates.has(id) && (level ?? 0) > 0)
    }
    if (source.kind === 'subclass') {
      return Object.values(input.combatant.subclassIds ?? {}).some((id) => !!id && candidates.has(id))
    }
    return false
  }
  if (source.kind === 'spell') {
    const selectedSpells = [
      ...Object.values(input.combatant.classSelections).flat(),
      ...Object.values(input.combatant.classSelectionsByClass ?? {}).flatMap((selections) =>
        Object.values(selections ?? {}).flat()),
    ]
    if (includesIdentity(selectedSpells, candidates)) return true
    return dnd5eCharacterBuildSpellGrantsV1(input.character ?? {}).some((grant) =>
      candidates.has(grant.spellId))
  }
  if (source.kind === 'item') {
    return input.character?.dnd5eInventory?.entries.some((entry) => candidates.has(entry.templateId)) === true
  }
  if (source.kind === 'race') {
    return !!input.character && candidates.has(input.character.dnd5eRaceId ?? input.character.race)
  }
  if (source.kind === 'background') {
    return !!input.character && candidates.has(input.character.dnd5eBackgroundId ?? input.character.background)
  }
  if (source.kind === 'monster' || source.kind === 'monster-action') {
    const monsterId = source.kind === 'monster-action' ? source.id.split(':').slice(0, -1).join(':') : source.id
    return !!input.combatant.statBlockId && identityCandidates(input.packageId, monsterId).has(input.combatant.statBlockId)
  }
  // Top-level legacy custom actions are callable only through their owning
  // feature adapter; they are not ambient abilities for every combatant.
  return false
}
