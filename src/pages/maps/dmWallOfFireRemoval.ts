import type { Character } from '../../types/character'
import type { BattleMap, Token } from '../../store/maps'
import { dnd5eConditionsFromActiveEffects } from '../../rulesets/dnd5e/activeEffects'
import { ejectDnd5ePasswallOccupants } from '../../rulesets/dnd5e/pluginAreas'

export interface DmPersistentAreaRemoval {
  map: BattleMap
  character?: Character
  sourceToken?: Token
  label: string
  concentrationEnded: boolean
}

export interface DmPersistentAreaEntityAttackResolution extends DmPersistentAreaRemoval {
  outcome: 'miss' | 'hit' | 'destroyed'
  attackTotal: number
  armorClass: number
  damage: number
  hitPointsBefore: number
  hitPointsAfter: number
}

function withoutMatchingConcentration<T extends { concentrating?: boolean; conditions?: Character['conditions']; dnd5eCombatState?: Character['dnd5eCombatState'] }>(
  source: T,
  concentrationId: string | undefined,
  sourceTokenId: string,
): T {
  if (!concentrationId || source.dnd5eCombatState?.concentrationSpellId !== concentrationId) return source
  const state = { ...source.dnd5eCombatState }
  const allActiveEffects = state.activeEffects ?? []
  const removedDefinitionIds = new Set<string>()
  let activeEffects = allActiveEffects.filter((effect) => {
    const removesConcentration =
    !(effect.duration.type === 'concentration' &&
      effect.duration.sourceActorId === sourceTokenId &&
      (!effect.duration.concentrationId || effect.duration.concentrationId === concentrationId))
    if (!removesConcentration) removedDefinitionIds.add(effect.definitionId)
    return removesConcentration
  })
  const matchesDefinition = (definitionId: string, requiredId: string) =>
    definitionId === requiredId ||
    definitionId.endsWith(`:${requiredId}`) ||
    definitionId.includes(`:${requiredId}:`)
  // Some concentration spells apply round-based child effects which are
  // explicitly linked to the concentration controller (for example,
  // Mislead's initial invisibility). Removing only the controller leaves an
  // orphan that can be refreshed and then immediately broken by the next
  // cast. Cascade through sourceRequiresEffect links owned by this caster.
  let removedLinkedEffect = true
  while (removedLinkedEffect) {
    removedLinkedEffect = false
    activeEffects = activeEffects.filter((effect) => {
      const requiredId = effect.removal?.sourceLink?.sourceRequiresEffect
      const dependsOnRemovedEffect = effect.source.actorId === sourceTokenId &&
        !!requiredId && [...removedDefinitionIds].some((definitionId) =>
          matchesDefinition(definitionId, requiredId))
      if (!dependsOnRemovedEffect) return true
      removedDefinitionIds.add(effect.definitionId)
      removedLinkedEffect = true
      return false
    })
  }
  delete state.concentrationSpellId
  delete state.concentrationSpellLevel
  delete state.concentrationTargetIds
  delete state.concentrationRoundsRemaining
  state.activeEffects = activeEffects.length ? activeEffects : undefined
  return {
    ...source,
    concentrating: false,
    conditions: dnd5eConditionsFromActiveEffects(activeEffects),
    dnd5eCombatState: state,
  }
}

/** DM-only caller supplies the latest authoritative snapshot; stale area IDs are rejected. */
export function removePersistentAreaByDm(input: {
  map: BattleMap
  characters: readonly Character[]
  areaId: string
}): DmPersistentAreaRemoval | undefined {
  const area = input.map.dnd5ePluginAreas?.find((candidate) => candidate.id === input.areaId)
  if (!area) return undefined
  const sourceCharacter = input.characters.find((candidate) => candidate.id === area.sourceCharacterId)
  const sourceToken = input.map.tokens.find((candidate) => candidate.id === area.sourceTokenId)
  const effectToken = area.anchorMode === 'effect-token' && area.anchorTokenId
    ? input.map.tokens.find((candidate) =>
        candidate.id === area.anchorTokenId && !!candidate.dnd5eSpellEffect,
      )
    : undefined
  const removedAreas = (input.map.dnd5ePluginAreas ?? [])
    .filter((candidate) => candidate.id === area.id || (!!effectToken &&
      candidate.anchorMode === 'effect-token' && candidate.anchorTokenId === effectToken.id))
  const removedAreaIds = new Set(removedAreas.map((candidate) => candidate.id))
  // Old shared maps may predate concentrationId. Only fall back to the core
  // spell id when it is also the caster's current concentration identity.
  const recordedConcentrationId = area.concentrationId ?? area.coreSpellId
  const character = sourceCharacter
    ? withoutMatchingConcentration(sourceCharacter, recordedConcentrationId, area.sourceTokenId)
    : undefined
  const nextSourceToken = sourceToken
    ? withoutMatchingConcentration(sourceToken, recordedConcentrationId, area.sourceTokenId)
    : undefined
  const concentrationEnded = character !== sourceCharacter || nextSourceToken !== sourceToken
  return {
    map: ejectDnd5ePasswallOccupants({
      ...input.map,
      dnd5ePluginAreas: (input.map.dnd5ePluginAreas ?? []).filter((candidate) =>
        !removedAreaIds.has(candidate.id)),
      tokens: input.map.tokens
        .filter((candidate) => candidate.id !== effectToken?.id)
        .map((candidate) => candidate.id === nextSourceToken?.id ? nextSourceToken : candidate),
    }, removedAreas),
    character,
    sourceToken: nextSourceToken,
    label: area.label,
    concentrationEnded,
  }
}

/**
 * Resolves a DM-entered attack total against a spell-created entity and owns
 * its HP lifecycle. Reaching 0 HP removes the entity, its area, and only the
 * concentration identity attached to that exact area.
 */
export function resolvePersistentAreaEntityAttackByDm(input: {
  map: BattleMap
  characters: readonly Character[]
  areaId: string
  attackTotal: number
  damage: number
}): DmPersistentAreaEntityAttackResolution | undefined {
  const area = input.map.dnd5ePluginAreas?.find((candidate) => candidate.id === input.areaId)
  const profile = area?.entityProfile
  if (!area || !profile || !Number.isInteger(input.attackTotal) || !Number.isInteger(input.damage) || input.damage < 1) {
    return undefined
  }
  const hitPointsBefore = area.entityCurrentHitPoints ?? profile.hitPoints
  const base = {
    map: input.map,
    label: area.label,
    concentrationEnded: false,
    outcome: 'miss' as const,
    attackTotal: input.attackTotal,
    armorClass: profile.armorClass,
    damage: 0,
    hitPointsBefore,
    hitPointsAfter: hitPointsBefore,
  }
  if (input.attackTotal < profile.armorClass) return base

  const damage = Math.max(1, input.damage)
  const hitPointsAfter = Math.max(0, hitPointsBefore - damage)
  if (hitPointsAfter === 0) {
    const removed = removePersistentAreaByDm(input)
    return removed ? {
      ...removed,
      outcome: 'destroyed',
      attackTotal: input.attackTotal,
      armorClass: profile.armorClass,
      damage,
      hitPointsBefore,
      hitPointsAfter,
    } : undefined
  }
  return {
    ...base,
    map: {
      ...input.map,
      dnd5ePluginAreas: input.map.dnd5ePluginAreas?.map((candidate) =>
        candidate.id === area.id
          ? { ...candidate, entityCurrentHitPoints: hitPointsAfter }
          : candidate),
    },
    outcome: 'hit',
    damage,
    hitPointsAfter,
  }
}

/** Kept for callers/tests that still use the former spell-specific API. */
export function removeWallOfFireByDm(input: {
  map: BattleMap
  characters: readonly Character[]
  areaId: string
}): DmPersistentAreaRemoval | undefined {
  const area = input.map.dnd5ePluginAreas?.find((candidate) =>
    candidate.id === input.areaId && candidate.coreSpellId === 'wall-of-fire',
  )
  return area ? removePersistentAreaByDm(input) : undefined
}

export function toggleDmPluginAreaVisibility(map: BattleMap, areaId: string): BattleMap | undefined {
  const area = map.dnd5ePluginAreas?.find((candidate) => candidate.id === areaId)
  return area ? { ...map, dnd5ePluginAreas: map.dnd5ePluginAreas?.map((candidate) =>
    candidate.id === areaId ? { ...candidate, hiddenFromPlayers: !candidate.hiddenFromPlayers } : candidate) } : undefined
}
