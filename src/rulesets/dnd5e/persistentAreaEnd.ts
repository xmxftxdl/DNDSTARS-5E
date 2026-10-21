import type { BattleMap } from '../../store/maps'
import {releaseDnd5eEndedAreaObjects} from './persistentAreaObjectCapture'
import {applyDnd5eStandardConditionEffect} from './headlessCombatEngine'
import { reconcileDnd5eGroveGuardians } from './druidGroveRestoration'
import type { Character } from '../../types/character'
import { dnd5ePersistentAreaEffectMatchesOrigin } from './persistentAreaConditionEffects'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { removeDnd5eCombatantActiveEffectsByIds, resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange, type Dnd5eCombatEvent } from './headlessCombatEngine'
import { dnd5eActiveSubmerged, removeDnd5eActiveEffectsByIds, projectDnd5eActiveEffectState, type Dnd5eActiveEffectInstance } from './activeEffects'
import { advanceDnd5eCampaignTimedActiveEffects } from './campaignTimeRules'
import {setDnd5eSourcedExhaustion} from './headlessCombatEngine'
import {normalizeDnd5eSourcedExhaustion,dnd5eSourcedExhaustionLevel,type Dnd5eExhaustionAreaLifetime} from './sourcedExhaustion'

/** Release restraints bound to removed areas; legacy capacity effects retain their scoped tag path. */
export function reconcileDnd5eEndedAreaCaptives(input: {
  before: BattleMap; after: BattleMap; characters: readonly Character[]; round: number
}): { map: BattleMap; characters: readonly Character[]; events: Dnd5eCombatEvent[] } {
  const ended = input.before.dnd5ePluginAreas?.filter(area => !input.after.dnd5ePluginAreas?.some(live =>
    live.id === area.id && live.sourceTokenId === area.sourceTokenId &&
    (live.boundEffectGeneration ?? 0) === (area.boundEffectGeneration ?? 0))) ?? []
  const restoredMap = releaseDnd5eEndedAreaObjects(reconcileDnd5eGroveGuardians(input.after))
  if (!ended.length) return { map: restoredMap, characters: input.characters, events: [] }
  const matches = (effect: NonNullable<NonNullable<Character['dnd5eCombatState']>['activeEffects']>[number]) =>
    (effect.standardCondition === 'restrained' || effect.definitionId === 'persistent-area:visibility') && ended.some(area => effect.source.actorId === area.sourceTokenId &&
      dnd5ePersistentAreaEffectMatchesOrigin(effect, area.id) &&
      (effect.areaLifetime
        ? effect.areaLifetime.mapId === input.before.id && effect.areaLifetime.areaId === area.id &&
          effect.areaLifetime.sourceActorId === area.sourceTokenId &&
          (effect.areaLifetime.generation ?? 0) === (area.boundEffectGeneration ?? 0)
        : area.triggers?.some(trigger => trigger.capacity)))
  return reconcileCaptivesOnMap({ map: restoredMap, characters: input.characters, round: input.round, matches,
    proneOnRemoval: effect => matches(effect) && ended.some(area=>area.id===effect.areaLifetime?.areaId &&
      area.sourceTokenId===effect.areaLifetime.sourceActorId && area.triggers?.some(trigger=>trigger.condition?.proneOnAreaEnd)),
    groundOnRemoval: effect => matches(effect) && ended.some(area => area.id === effect.areaLifetime?.areaId &&
      area.sourceTokenId === effect.areaLifetime.sourceActorId &&
      (area.boundEffectGeneration ?? 0) === (effect.areaLifetime.generation ?? 0) &&
      area.triggers?.some(trigger => trigger.condition?.groundOnAreaEnd)),
    matchesExhaustion: link => link.mapId === input.before.id && ended.some(area => area.id === link.areaId && area.sourceTokenId === link.sourceActorId) })
}

function reconcileCaptivesOnMap(input: {
  map: BattleMap; characters: readonly Character[]; round: number; matches: (effect: Dnd5eActiveEffectInstance) => boolean
  matchesExhaustion?: (origin: Dnd5eExhaustionAreaLifetime) => boolean
  proneOnRemoval?: (effect: Dnd5eActiveEffectInstance) => boolean
  groundOnRemoval?: (effect: Dnd5eActiveEffectInstance) => boolean
}): { map: BattleMap; characters: readonly Character[]; events: Dnd5eCombatEvent[] } {
  const { matches } = input
  const targets = input.map.tokens.filter(token => {
    const character = token.characterId && !token.dnd5eSimulacrum
      ? input.characters.find(character => character.id === token.characterId) : undefined
    const state = character?.dnd5eCombatState ?? token.dnd5eCombatState
    return state?.activeEffects?.some(matches) || state?.sourcedExhaustion?.sources.some(source => source.areaLifetime && input.matchesExhaustion?.(source.areaLifetime))
  })
  if (!targets.length) return { map: input.map, characters: input.characters, events: [] }
  const snapshot = createDnd5eMapCombatSnapshot({ map: input.map, characters: input.characters,
    round: input.round, combatId: `area-end:${input.map.id}`,
    initiativeOrder: input.map.tokens.filter(token => ['player', 'npc', 'enemy'].includes(token.type))
      .map(token => ({ tokenId: token.id, label: token.label, color: token.color, emoji: token.emoji, roll: 0 })) })
  const supportedState = structuredClone(snapshot.state)
  const events: Dnd5eCombatEvent[] = []
  const changed = new Set<string>()
  for (const token of targets) {
    const target = snapshot.state.combatants[token.id]
    if (!target) continue
    const ids = target.classState.activeEffects?.filter(matches).map(effect => effect.id) ?? []
    const shouldFallProne=target.classState.activeEffects?.some(effect=>input.proneOnRemoval?.(effect))
    const shouldLand = target.classState.activeEffects?.some(effect => input.groundOnRemoval?.(effect))
    if (removeDnd5eCombatantActiveEffectsByIds(snapshot.state, target.id, ids, 'expired', events).length) changed.add(target.id)
    if (!dnd5eActiveSubmerged(target.classState.activeEffects)) target.classState.submergedBreathing = undefined
    if (shouldLand) {
      target.elevationFeet = target.groundElevationFeet ?? 0
      target.airborne = false
      changed.add(target.id)
    }
    if(shouldFallProne){
      applyDnd5eStandardConditionEffect(target,target,{id:`area-release-prone:${target.id}`,rulesId:'persistent-area-release',
        condition:'prone',duration:{type:'permanent'}},events)
      changed.add(target.id)
    }
    const ledger = normalizeDnd5eSourcedExhaustion(target.classState.sourcedExhaustion)
    if (ledger) {
      const sources = ledger.sources.filter(source => !source.areaLifetime || !input.matchesExhaustion?.(source.areaLifetime))
      if (sources.length !== ledger.sources.length) {
        const before = target.exhaustionLevel
        setDnd5eSourcedExhaustion(target, {...ledger,sources})
        events.push({type:'exhaustion-adjusted',actorId:target.id,before,after:target.exhaustionLevel,amount:target.exhaustionLevel-before})
        changed.add(target.id)
      }
    }
  }
  if (!changed.size) return { map: input.map, characters: input.characters, events }
  // Short drops with no required dice must also settle on unopened maps. Higher
  // falls still need the authority's existing dice/reaction settlement flow.
  const landing = resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(supportedState, snapshot.state, {})
  if (landing.ok) events.push(...landing.events)
  const applied = planDnd5eMapResultApplication({ map: input.map, characters: input.characters,
    state: landing.ok ? landing.state : snapshot.state, characterIdByCombatantId: snapshot.characterIdByCombatantId, events })
  const characterIds = new Set([...changed].map(id => snapshot.characterIdByCombatantId[id]).filter(Boolean))
  return { map: { ...input.map, tokens: input.map.tokens.map(token => changed.has(token.id)
    ? applied.map.tokens.find(candidate => candidate.id === token.id) ?? token : token) },
    characters: input.characters.map(character => characterIds.has(character.id)
      ? applied.characters.find(candidate => candidate.id === character.id) ?? character : character), events }
}

/** Reconcile loaded room maps and mapless sheets without inventing a position or a deleted source map. */
export function reconcileDnd5eAreaCaptivesAcrossMaps(input: {
  maps: readonly BattleMap[]; characters: readonly Character[]; round: number; deletedMapIds?: readonly string[]
}): { maps: readonly BattleMap[]; characters: readonly Character[]; events: Dnd5eCombatEvent[] } {
  const matchesExhaustion = (link: Dnd5eExhaustionAreaLifetime): boolean => {
    const sources = input.maps.filter(map => map.id === link.mapId)
    if (sources.length === 0) return input.deletedMapIds?.includes(link.mapId) === true
    return sources.length === 1 && !sources[0].dnd5ePluginAreas?.some(area => area.id === link.areaId && area.sourceTokenId === link.sourceActorId)
  }
  const matches = (effect: Dnd5eActiveEffectInstance): boolean => {
    const link = effect.areaLifetime
    if (!link || (effect.standardCondition !== 'restrained' && effect.definitionId !== 'persistent-area:visibility') || effect.source.actorId !== link.sourceActorId ||
      !dnd5ePersistentAreaEffectMatchesOrigin(effect, link.areaId)) return false
    const sources = input.maps.filter(map => map.id === link.mapId)
    if (sources.length === 0) return input.deletedMapIds?.includes(link.mapId) === true
    if (sources.length !== 1) return false
    return !sources[0].dnd5ePluginAreas?.some(area => area.id === link.areaId && area.sourceTokenId === link.sourceActorId &&
      (area.boundEffectGeneration ?? 0) === (link.generation ?? 0))
  }
  let characters = input.characters
  const events: Dnd5eCombatEvent[] = []
  const maps = input.maps.map(map => {
    const result = reconcileCaptivesOnMap({ map: releaseDnd5eEndedAreaObjects(reconcileDnd5eGroveGuardians(map)), characters, round: input.round, matches, matchesExhaustion })
    characters = result.characters
    events.push(...result.events)
    return result.map
  })
  const mapped = new Set(maps.flatMap(map => map.tokens.flatMap(token => token.characterId && !token.dnd5eSimulacrum ? [token.characterId] : [])))
  characters = characters.map(character => {
    if (mapped.has(character.id)) return character
    const ledger = normalizeDnd5eSourcedExhaustion(character.dnd5eCombatState?.sourcedExhaustion)
    if (ledger) {
      const sources = ledger.sources.filter(source => !source.areaLifetime || !matchesExhaustion(source.areaLifetime))
      if (sources.length !== ledger.sources.length) {
        const sourcedExhaustion = {...ledger,sources}
        const exhaustionLevel = dnd5eSourcedExhaustionLevel(sourcedExhaustion)
        const before = dnd5eSourcedExhaustionLevel(ledger)
        events.push({type:'exhaustion-adjusted',actorId:character.id,before,after:exhaustionLevel,amount:exhaustionLevel-before})
        character = {...character,exhaustionLevel,dnd5eCombatState:{...character.dnd5eCombatState,sourcedExhaustion}}
      }
    }
    const effects = character.dnd5eCombatState?.activeEffects ?? []
    // Position-dependent custom aftermath cannot be evaluated on a sheet without a Token.
    const ids = effects.filter(effect => matches(effect) && !effect.afterEffectEnds).map(effect => effect.id)
    if (!ids.length) return character
    const removed = removeDnd5eActiveEffectsByIds({ effects, ids, allowProtectedLifecycle: true })
    for (const effect of removed.removed) events.push({ type: 'active-effect-removed', targetId: character.id,
      effectId: effect.id, definitionId: effect.definitionId, reason: 'expired' })
    const projection = projectDnd5eActiveEffectState(removed.effects)
    return advanceDnd5eCampaignTimedActiveEffects({ ...character, conditions: projection.conditions,
      dnd5eCombatState: { ...character.dnd5eCombatState, activeEffects: projection.activeEffects,
        submergedBreathing: dnd5eActiveSubmerged(projection.activeEffects) ? character.dnd5eCombatState?.submergedBreathing : undefined } }, 0)
  })
  return { maps: maps.some((map, i) => map !== input.maps[i]) ? maps : input.maps,
    characters: characters.some((character, i) => character !== input.characters[i]) ? characters : input.characters, events }
}
