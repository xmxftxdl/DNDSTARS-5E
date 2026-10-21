import { dnd5eHasVoluntaryCompanionOrder } from './voluntaryCompanionOrder'
import { mapGeometryRuntimeForMap } from '../../lib/mapGeometry'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { getDnd5eSrdMonster } from './monsters'
import { dnd5eCreatureSubtypeMatches } from './persistentAreaCreatureFilter'
import { dnd5ePersistentWardProtectedFrom, dnd5eTokenIntersectsPersistentAreaAt } from './persistentAreaGeometry'
import { dnd5eMapTokenDistanceFeet } from './verticalCombatGeometry'
import { createDnd5eMapCombatSnapshot } from './mapBridge'
import { dnd5eCombatantCanSee } from './headlessCombatEngine'
import { dnd5eCompanionGuardAreaFitsMap, dnd5eTokenIntersectsGuardArea } from './companionGuardArea'

/** A constraint on automatic turns, not an authorization to settle an attack. */
export function dnd5eSummonAutomaticTargets(
  map: BattleMap,
  actor: Token,
  characters: readonly Character[],
): { mode: 'nearest' | 'retaliate' | 'dodge' | 'attack' | 'grove'; targets: Token[] } | undefined {
  const grove = actor.dnd5eGroveGuardian
  if (grove) {
    const boundary = map.dnd5ePluginAreas?.find(area => area.id === grove.boundaryAreaId &&
      area.sourceTokenId === grove.sourceTokenId && area.effectGroup?.castId === grove.castId &&
      area.effectGroup.effectId === 'guardians')
    if (!boundary) return { mode: 'grove', targets: [] }
    const order = actor.dnd5eCombatState?.companionCommand
    const validOrder = order?.sourceOwnerId === grove.sourceTokenId && order.sourceFeatureId === boundary.featureId
    if (validOrder && order.command === 'dodge') return { mode: 'dodge', targets: [] }
    const commandedTarget = validOrder && (order.command === 'attack' ||
      order.command === 'ready' && order.ready?.actionKind === 'attack') ? order.attackTargetId : undefined
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'grove-intruders', map, characters,
      initiativeOrder: map.tokens.filter(token => token.type !== 'obstacle').map(token =>
        ({ tokenId: token.id, label: token.label, emoji: token.emoji, color: token.color, roll: 0 })) })
    const geometry = mapGeometryRuntimeForMap(map.id)
    const distance = (target: Token) => dnd5eMapTokenDistanceFeet({ map, geometry, left: actor, right: target })
    return { mode: 'grove', targets: map.tokens.filter(target => target.id !== actor.id &&
      target.type !== 'obstacle' && !boundary.excludedTargetIds?.includes(target.id) &&
      (commandedTarget ? target.id === commandedTarget : !boundary.groveInitialOccupantIds?.includes(target.id)) &&
      !(target.dnd5eGroveGuardian?.castId === grove.castId && target.dnd5eGroveGuardian.sourceTokenId === grove.sourceTokenId) &&
      !!snapshot.state.combatants[target.id] && !snapshot.state.combatants[target.id].deathSaves.dead &&
      !dnd5ePersistentWardProtectedFrom(map, target).includes(actor.id) &&
      dnd5eTokenIntersectsPersistentAreaAt(target, map, boundary, target))
      .sort((a, b) => distance(a) - distance(b) || a.id.localeCompare(b.id)) }
  }
  const summon = actor.dnd5eSummon
  if (!summon) return undefined
  const uncontrolled = summon.controlEnded && summon.controlSave
  const order = actor.dnd5eCombatState?.companionCommand
  const protectingSource = summon.autonomousBehavior === 'protect-source' &&
    !(order?.sourceOwnerId === summon.sourceTokenId && order.sourceFeatureId === summon.featureId)
  const protectedSource = protectingSource ? map.tokens.find(token => token.id === summon.sourceTokenId) : undefined
  if (protectingSource && !protectedSource) return { mode: 'dodge', targets: [] }
  let mode: 'nearest' | 'retaliate' | 'attack'
  const autonomous = summon.autonomousBehavior === 'attack-nearest-visible'
  if (protectingSource) mode = 'attack'
  else if ((autonomous || summon.autonomousBehavior === 'attack-nearest-other-subtype' || uncontrolled) && !dnd5eHasVoluntaryCompanionOrder(actor)) mode = 'nearest'
  else if ((!summon.controlEnded || dnd5eHasVoluntaryCompanionOrder(actor)) && summon.commandPolicy) {
    const order = actor.dnd5eCombatState?.companionCommand
    if (order && order.sourceOwnerId === summon.sourceTokenId &&
      order.sourceFeatureId === summon.featureId) {
      if (order.command === 'dodge') return { mode: 'dodge', targets: [] }
      if (order.command !== 'attack') return undefined
      mode = 'attack'
    } else mode = 'retaliate'
  } else return undefined
  const geometry = mapGeometryRuntimeForMap(map.id)
  const guardArea = mode === 'attack' ? actor.dnd5eCombatState?.companionCommand?.guardArea : undefined
  if (guardArea && !dnd5eCompanionGuardAreaFitsMap(map, guardArea)) return { mode: 'dodge', targets: [] }
  const sightState = protectingSource || autonomous || mode === 'attack' && (actor.dnd5eCombatState?.companionCommand?.attackTargetId || guardArea) ? createDnd5eMapCombatSnapshot({combatId:'summon-visibility',
    map:{...map,tokens:map.tokens.map(token=>token.id===actor.id?actor:token)},characters,
    initiativeOrder:map.tokens.filter(token=>token.type!=='obstacle').map(token=>({tokenId:token.id,label:token.label,emoji:token.emoji,color:token.color,roll:0}))}).state : undefined
  const distance = (target: Token) => dnd5eMapTokenDistanceFeet({ map, geometry, left: actor, right: target })
  const targets = map.tokens.filter(target => {
    const character = characters.find(entry => entry.id === target.characterId)
    if (target.id === actor.id || target.type === 'obstacle' ||
      (sightState ? !sightState.combatants[target.id] || sightState.combatants[target.id].deathSaves.dead
        : (character?.currentHp ?? target.hp ?? target.maxHp ?? 1) <= 0) ||
      dnd5ePersistentWardProtectedFrom(map, target).includes(actor.id)) return false
    if (mode === 'retaliate') return actor.dnd5eCombatState?.summonAttackerIds?.includes(target.id) === true
    if (protectingSource) return target.id !== protectedSource!.id && areOpposedCombatTokens(protectedSource!, target) &&
      !!sightState && sightState.combatants[target.id].currentHp > 0 && dnd5eCombatantCanSee(sightState, actor.id, target.id)
    if (mode === 'attack') {
      if (guardArea) return (character?.currentHp ?? target.hp ?? target.maxHp ?? 1) > 0 &&
        areOpposedCombatTokens(actor, target) && dnd5eTokenIntersectsGuardArea(map, target, guardArea) &&
        !!sightState && dnd5eCombatantCanSee(sightState, actor.id, target.id)
      const chosen = actor.dnd5eCombatState?.companionCommand?.attackTargetId
      return chosen ? target.id === chosen : areOpposedCombatTokens(actor, target)
    }
    if (sightState) return dnd5eCombatantCanSee(sightState,actor.id,target.id)
    const monster = target.poolId ? getDnd5eSrdMonster(target.poolId) : undefined
    return !dnd5eCreatureSubtypeMatches(monster?.subtypes, summon.requiredCreatureSubtype ?? 'demon')
  }).sort((left, right) => distance(left) - distance(right) || left.id.localeCompare(right.id))
  const nearest = targets.length ? distance(targets[0]) : Infinity
  if ((guardArea || protectingSource) && !targets.length) return { mode: 'dodge', targets: [] }
  return { mode, targets: mode === 'nearest' ? targets.filter(target => distance(target) <= nearest) : targets }
}
