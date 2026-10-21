import { wallArmorClass, wallDamageAfterDefenses } from './wallObjectRules'
import { dnd5eEntityDestructionTerrain } from './entityDestructionTerrain'
import type { Character } from '../../types/character'
import type { BattleMap, Token } from '../../store/maps'
import { dnd5eConditionsFromActiveEffects } from './activeEffects'
import { ejectDnd5ePasswallOccupants } from './pluginAreas'
import { stoneWallCells } from './stoneWall'
import { reconcileDnd5eEndedAreaCaptives } from './persistentAreaEnd'
import type { Dnd5eCombatEvent } from './headlessCombatEngine'
import {restoreMaterialVolumeTransformation} from './materialVolumeTransformation'
import type {MapGeometryState} from '../../lib/mapGeometry'

export interface DmPersistentAreaRemoval {
  /** Must be committed together with map when a reversible terrain area ends. */
  geometry?: MapGeometryState
  map: BattleMap
  character?: Character
  sourceToken?: Token
  label: string
  concentrationEnded: boolean
  /** Complete affected roster, including captive targets rather than only the caster. */
  characters?: readonly Character[]
  events?: readonly Dnd5eCombatEvent[]
}

export interface DmPersistentAreaEntityAttackResolution extends DmPersistentAreaRemoval {
  outcome: 'miss' | 'hit' | 'destroyed'
  attackTotal: number
  armorClass: number | null
  damage: number
  hitPointsBefore: number | null
  hitPointsAfter: number | null
}

export interface DmPersistentAreaEntityImpactResolution extends DmPersistentAreaRemoval {
  /** Present only when the independent projection resolved a requested save. */
  savingThrow?: { ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'; dc: number; succeeded: true; automatic: true }
  /** Includes custom conditions: immunity is not limited to the SRD list. */
  immuneConditions?: readonly string[]
}

/** Direct impact damage has no attack roll, but shares destruction and immunity rules. */
export function resolvePersistentAreaEntityImpact(input: {
  map: BattleMap; characters: readonly Character[]; areaId: string; panelId?: string
  damage: number; damageType: string; round?: number
  savingThrow?: { ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'; dc: number }
  conditions?: readonly string[]
}): DmPersistentAreaEntityImpactResolution | undefined {
  if (!Number.isInteger(input.damage) || input.damage < 0) return undefined
  if (input.panelId != null && input.panelId !== 'entity' &&
    !input.map.dnd5ePluginAreas?.find(candidate => candidate.id === input.areaId)?.stoneWall) return undefined
  if (input.savingThrow && (!['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(input.savingThrow.ability) ||
    !Number.isFinite(input.savingThrow.dc) || input.savingThrow.dc < 0)) return undefined
  if (input.conditions?.some(condition => typeof condition !== 'string' || !condition.trim())) return undefined
  const area = input.map.dnd5ePluginAreas?.find(candidate => candidate.id === input.areaId)
  if (!area) return undefined
  if (area.projectionDefense === 'untouchable-illusion') return {
    map: input.map, label: area.label, concentrationEnded: false,
    ...(input.savingThrow ? { savingThrow: { ...input.savingThrow, succeeded: true as const, automatic: true as const } } : {}),
    ...(input.conditions ? { immuneConditions: [...new Set(input.conditions)] } : {}),
  }
  // This impact entry point cannot settle saves or conditions for physical
  // entities yet. Reject rather than silently discard part of an operation.
  if (input.savingThrow || input.conditions?.length) return undefined
  if (area.coreSpellId === 'wall-of-force') return { map: input.map, label: area.label, concentrationEnded: false }
  if (!area.stoneWall && !area.entityProfile) return undefined
  return resolvePersistentAreaEntityAttackByDm({ ...input,
    attackTotal: area.stoneWall ? wallArmorClass(area) : area.entityProfile!.armorClass,
    damage: area.stoneWall ? input.damage : wallDamageAfterDefenses(area, input.damage, input.damageType),
  })
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
  round?: number
  /** Supplying geometry explicitly opts into committing the returned geometry. */
  geometry?: MapGeometryState
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
    .filter((candidate) => candidate.id === area.id || (!!area.effectGroup &&
      candidate.effectGroup?.castId === area.effectGroup.castId &&
      candidate.effectGroup.effectId === area.effectGroup.effectId &&
      candidate.pluginId === area.pluginId && candidate.featureId === area.featureId &&
      candidate.sourceCharacterId === area.sourceCharacterId && candidate.sourceTokenId === area.sourceTokenId) || (!!effectToken &&
      candidate.anchorMode === 'effect-token' && candidate.anchorTokenId === effectToken.id))
  const removedAreaIds = new Set(removedAreas.map((candidate) => candidate.id))
  for(let changed=true;changed;){
    changed=false
    for(const candidate of input.map.dnd5ePluginAreas??[]){
      if(candidate.linkedParentAreaId&&removedAreaIds.has(candidate.linkedParentAreaId)&&!removedAreaIds.has(candidate.id)){
        removedAreaIds.add(candidate.id);removedAreas.push(candidate);changed=true
      }
    }
  }
  const removedEffectTokenIds = new Set(removedAreas.flatMap(candidate =>
    candidate.anchorMode === 'effect-token' && candidate.anchorTokenId &&
    input.map.tokens.some(token => token.id === candidate.anchorTokenId && token.dnd5eSpellEffect)
      ? [candidate.anchorTokenId] : []))
  let restoredGeometry:MapGeometryState|undefined
  for(const candidate of removedAreas){
    if(!candidate.materialTransformation)continue
    const current=restoredGeometry??input.geometry
    if(!current||current.mapId!==input.map.id)return undefined
    restoredGeometry=restoreMaterialVolumeTransformation(current,candidate.materialTransformation)
    if(!restoredGeometry)return undefined
  }
  // Old shared maps may predate concentrationId. Only fall back to the core
  // spell id when it is also the caster's current concentration identity.
  const recordedConcentrationId = area.permanent || area.linkedParentAreaId ? undefined : area.concentrationId ?? area.coreSpellId
  const character = sourceCharacter
    ? withoutMatchingConcentration(sourceCharacter, recordedConcentrationId, area.sourceTokenId)
    : undefined
  const nextSourceToken = sourceToken
    ? withoutMatchingConcentration(sourceToken, recordedConcentrationId, area.sourceTokenId)
    : undefined
  const concentrationEnded = character !== sourceCharacter || nextSourceToken !== sourceToken
  const removedMap = ejectDnd5ePasswallOccupants({
      ...input.map,
      dnd5ePluginAreas: (input.map.dnd5ePluginAreas ?? []).filter((candidate) =>
        !removedAreaIds.has(candidate.id)),
      tokens: input.map.tokens
        .filter((candidate) => !removedEffectTokenIds.has(candidate.id))
        .map((candidate) => candidate.id === nextSourceToken?.id ? nextSourceToken : candidate),
    }, removedAreas)
  const released = reconcileDnd5eEndedAreaCaptives({ before: input.map, after: removedMap,
    characters: character ? input.characters.map(candidate => candidate.id === character.id ? character : candidate) : input.characters,
    round: input.round ?? area.createdRound })
  return {
    map: released.map,
    ...(restoredGeometry ? {geometry:restoredGeometry} : {}),
    characters: released.characters,
    events: released.events,
    character: character ? released.characters.find(candidate => candidate.id === character.id) ?? character : undefined,
    sourceToken: nextSourceToken ? released.map.tokens.find(candidate => candidate.id === nextSourceToken.id) ?? nextSourceToken : undefined,
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
  round?: number
  panelId?: string
  attackTotal: number
  damage: number
  damageType?: string
}): DmPersistentAreaEntityAttackResolution | undefined {
  const area = input.map.dnd5ePluginAreas?.find((candidate) => candidate.id === input.areaId)
  if (area?.coreSpellId === 'wall-of-force') return undefined
  if (area?.projectionDefense === 'untouchable-illusion') {
    if (!Number.isInteger(input.attackTotal) || !Number.isInteger(input.damage) || input.damage < 0 ||
      (input.panelId != null && input.panelId !== 'entity')) return undefined
    return { map: input.map, label: area.label, concentrationEnded: false, outcome: 'miss',
      attackTotal: input.attackTotal, armorClass: null, damage: 0, hitPointsBefore: null, hitPointsAfter: null }
  }
  if (area?.stoneWall) {
    const panel = area.stoneWall.panels.find(candidate => candidate.id === input.panelId && candidate.hitPoints > 0)
    if (!panel || !Number.isInteger(input.attackTotal) || !Number.isInteger(input.damage) || input.damage < 0) return undefined
    const armorClass = wallArmorClass(area)
    const hit = input.attackTotal >= armorClass
    const damage = wallDamageAfterDefenses(area, input.damage, input.damageType ?? 'bludgeoning')
    const hitPointsAfter = hit ? Math.max(0, panel.hitPoints - damage) : panel.hitPoints
    const panels = area.stoneWall.panels.map(candidate => candidate.id === panel.id ? { ...candidate, hitPoints: hitPointsAfter } : candidate)
    if (area.coreSpellId === 'wall-of-ice') {
      const frigidCells = [...new Map(panels.filter(p => p.hitPoints === 0).flatMap(p => p.cells).map(c => [`${c.col},${c.row}`, c])).values()]
      const triggers = (area.triggers ?? []).filter(trigger => trigger.id !== 'wall-of-ice-frigid-air')
      if (frigidCells.length) triggers.push({ id: 'wall-of-ice-frigid-air', label: '冰墙术·寒冷气幕', timing: 'on-enter', oncePerTurn: true,
        cells: frigidCells, savingThrow: { ability: 'con', dc: area.stoneWall.saveDc, onSuccess: 'half' },
        damage: { count: 5 + Math.max(0, (area.slotLevel ?? 6) - 6), sides: 6, modifier: 0, type: 'cold' } })
      return { map: { ...input.map, dnd5ePluginAreas: input.map.dnd5ePluginAreas?.map(candidate => candidate.id === area.id
        ? { ...area, stoneWall: { ...area.stoneWall!, panels }, triggers } : candidate) },
        label: `${area.label} · 第 ${area.stoneWall.panels.indexOf(panel) + 1} 段`, concentrationEnded: false,
        outcome: !hit ? 'miss' : hitPointsAfter === 0 ? 'destroyed' : 'hit', attackTotal: input.attackTotal, armorClass,
        damage: hit ? damage : 0, hitPointsBefore: panel.hitPoints, hitPointsAfter }
    }
    const lastPanelRemoved = panels.every(p => p.hitPoints === 0) ? removePersistentAreaByDm(input) : undefined
    return {
      ...lastPanelRemoved,
      map: lastPanelRemoved?.map ?? { ...input.map, dnd5ePluginAreas: input.map.dnd5ePluginAreas?.flatMap(candidate => candidate.id !== area.id ? [candidate]
        : panels.some(p => p.hitPoints > 0) ? [{ ...candidate, cells: stoneWallCells(panels), stoneWall: { ...area.stoneWall!, panels } }] : []) },
      label: `${area.label} · 第 ${area.stoneWall.panels.indexOf(panel) + 1} 段`,
      concentrationEnded: lastPanelRemoved?.concentrationEnded ?? false, outcome: !hit ? 'miss' : hitPointsAfter === 0 ? 'destroyed' : 'hit',
      attackTotal: input.attackTotal, armorClass, damage: hit ? damage : 0,
      hitPointsBefore: panel.hitPoints, hitPointsAfter,
    }
  }
  const profile = area?.entityProfile
  if (!area || !profile || !Number.isInteger(input.attackTotal) || !Number.isInteger(input.damage) || input.damage < 0) {
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
  if (profile.attacksAutomaticallyMiss || input.attackTotal < profile.armorClass) return base

  const damage = Math.max(0, input.damage)
  const hitPointsAfter = Math.max(0, hitPointsBefore - damage)
  if (hitPointsAfter === 0) {
    const removed = removePersistentAreaByDm(input)
    const debris = dnd5eEntityDestructionTerrain(area, input.map)
    return removed ? {
      ...removed,
      map: debris ? { ...removed.map, dnd5ePluginAreas: [...(removed.map.dnd5ePluginAreas ?? []), debris] } : removed.map,
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
