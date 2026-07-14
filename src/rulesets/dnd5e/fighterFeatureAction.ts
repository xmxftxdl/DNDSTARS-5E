import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  FIGHTER_RESOURCE_KEYS,
  fighterResourceState,
} from './fighter'
import { resolveDnd5eHeadlessAction, type Dnd5eActionResult, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'

export type Dnd5eFighterFeatureId = 'second-wind' | 'action-surge'

export type Dnd5eFighterFeatureRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'not-fighter'
  | 'feature-locked'
  | 'feature-unavailable'
  | 'feature-already-used'
  | 'combatant-missing'

export interface PreparedDnd5eFighterFeature {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actor: Character
  actorToken: Token
  feature: Dnd5eFighterFeatureId
  actionSurgeAlreadyUsed: boolean
}

export function prepareDnd5eFighterFeature(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  actionSurgeAlreadyUsed: boolean
}): { ok: true; prepared: PreparedDnd5eFighterFeature } | { ok: false; reason: Dnd5eFighterFeatureRejectReason } {
  const { action } = input
  const feature = action.dnd5eFighterFeature
  if (action.type !== 'dnd5e-fighter-feature' || (feature !== 'second-wind' && feature !== 'action-surge')) {
    return { ok: false, reason: 'invalid-action' }
  }
  const actor = input.characters.find((character) => character.id === action.characterId)
  const actorToken = input.map.tokens.find((token) => token.id === action.actorTokenId && token.characterId === action.characterId)
  if (!actor || !actorToken || actor.currentHp <= 0) return { ok: false, reason: 'invalid-actor' }
  if (actor.charClass !== '战士') return { ok: false, reason: 'not-fighter' }
  if (feature === 'action-surge' && actor.level < 2) return { ok: false, reason: 'feature-locked' }
  const resourceKey = feature === 'second-wind' ? FIGHTER_RESOURCE_KEYS.secondWind : FIGHTER_RESOURCE_KEYS.actionSurge
  if (fighterResourceState(actor, resourceKey).current < 1) return { ok: false, reason: 'feature-unavailable' }
  if (feature === 'action-surge' && input.actionSurgeAlreadyUsed) return { ok: false, reason: 'feature-already-used' }
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: action.combatId ?? `map-${input.map.id}`,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorIndex = snapshot.state.initiativeOrder.indexOf(actorToken.id)
  if (actorIndex < 0 || !snapshot.state.combatants[actorToken.id]) return { ok: false, reason: 'combatant-missing' }
  return {
    ok: true,
    prepared: {
      action,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      actor,
      actorToken,
      feature,
      actionSurgeAlreadyUsed: input.actionSurgeAlreadyUsed,
    },
  }
}

export function resolvePreparedDnd5eFighterFeature(input: {
  prepared: PreparedDnd5eFighterFeature
  d10?: number
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const { prepared } = input
  const action = prepared.feature === 'second-wind'
    ? {
        type: 'fighter-second-wind' as const,
        actorId: prepared.actorToken.id,
        resourceKey: FIGHTER_RESOURCE_KEYS.secondWind,
        d10: input.d10 ?? 0,
      }
    : {
        type: 'fighter-action-surge' as const,
        actorId: prepared.actorToken.id,
        resourceKey: FIGHTER_RESOURCE_KEYS.actionSurge,
        alreadyUsedThisTurn: prepared.actionSurgeAlreadyUsed,
      }
  const result = resolveDnd5eHeadlessAction(prepared.state, action)
  if (!result.ok) return { result }
  return {
    result,
    application: planDnd5eMapResultApplication({
      state: result.state,
      map: prepared.map,
      characters: prepared.characters,
      characterIdByCombatantId: prepared.characterIdByCombatantId,
    }),
  }
}
