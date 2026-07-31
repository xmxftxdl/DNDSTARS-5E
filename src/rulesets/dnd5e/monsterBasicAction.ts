import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { D20RollMode } from '../contracts'
import {
  dnd5eAbilityCheckRollMode,
  dnd5eBestActiveEffectEscapeOption,
  dnd5eBestGrappleDefense,
  resolveDnd5eHeadlessAction,
  type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import {
  createDnd5eMapCombatSnapshot,
  planDnd5eMapResultApplication,
  type Dnd5eMapResultPlan,
} from './mapBridge'
import { getDnd5eSrdMonster } from './monsters'

export type Dnd5eMonsterBasicActionRejectReason =
  | 'invalid-actor'
  | 'combatant-missing'
  | 'invalid-effect'
  | 'invalid-grapple'

export interface PreparedDnd5eMonsterEscapeActiveEffect {
  map: BattleMap
  characters: readonly Character[]
  state: Dnd5eHeadlessCombatState
  characterIdByCombatantId: Readonly<Record<string, string>>
  actor: Token
  effectId: string
  dc: number
  ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
  skill?: 'athletics' | 'acrobatics'
  rollMode: D20RollMode
}

export interface PreparedDnd5eMonsterEscapeGrapple {
  map: BattleMap
  characters: readonly Character[]
  state: Dnd5eHeadlessCombatState
  characterIdByCombatantId: Readonly<Record<string, string>>
  actor: Token
  grappler: Token
  actorSkill: 'athletics' | 'acrobatics'
  actorRollMode: D20RollMode
  grapplerRollMode: D20RollMode
}

export function prepareDnd5eMonsterEscapeActiveEffect(input: {
  combatId: string
  round?: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  actorTokenId: string
  effectId: string
  turnEconomy?: Dnd5eTurnEconomyCounts
}):
  | { ok: true; prepared: PreparedDnd5eMonsterEscapeActiveEffect }
  | { ok: false; reason: Dnd5eMonsterBasicActionRejectReason } {
  const actor = input.map.tokens.find((token) =>
    token.id === input.actorTokenId &&
    token.type === 'enemy' &&
    !!token.poolId &&
    !!getDnd5eSrdMonster(token.poolId),
  )
  if (!actor) return { ok: false, reason: 'invalid-actor' }
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    round: input.round,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorIndex = snapshot.state.initiativeOrder.indexOf(actor.id)
  const combatant = snapshot.state.combatants[actor.id]
  if (actorIndex < 0 || !combatant) return { ok: false, reason: 'combatant-missing' }
  if (input.turnEconomy) {
    combatant.turn = {
      actionAvailable: input.turnEconomy.action.current > 0,
      bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
      reactionAvailable: input.turnEconomy.reaction.current > 0,
      objectInteractionAvailable: (input.turnEconomy.objectInteraction?.current ?? 1) > 0,
      movementRemaining: input.turnEconomy.movement.current,
    }
  }
  const effect = combatant.classState.activeEffects?.find((candidate) =>
    candidate.id === input.effectId &&
    candidate.escapeCheck?.economy === 'action')
  if (!effect?.escapeCheck) return { ok: false, reason: 'invalid-effect' }
  const option = dnd5eBestActiveEffectEscapeOption(combatant, effect.escapeCheck)
  return {
    ok: true,
    prepared: {
      map: input.map,
      characters: input.characters,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      actor,
      effectId: effect.id,
      dc: effect.escapeCheck.dc,
      ability: option.ability,
      skill: option.skill,
      rollMode: option.mode,
    },
  }
}

export function resolvePreparedDnd5eMonsterEscapeActiveEffect(input: {
  prepared: PreparedDnd5eMonsterEscapeActiveEffect
  d20: number
  d20Second?: number
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const result = resolveDnd5eHeadlessAction(input.prepared.state, {
    type: 'escape-active-effect',
    actorId: input.prepared.actor.id,
    effectId: input.prepared.effectId,
    d20: input.d20,
    d20Second: input.d20Second,
  })
  return {
    result,
    application: result.ok
      ? planDnd5eMapResultApplication({
          state: result.state,
          map: input.prepared.map,
          characters: input.prepared.characters,
          characterIdByCombatantId: input.prepared.characterIdByCombatantId,
        })
      : undefined,
  }
}

export function resolveDnd5eMonsterEscapeActiveEffect(input: {
  combatId: string
  round?: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  actorTokenId: string
  effectId: string
  d20: number
  d20Second?: number
  turnEconomy?: Dnd5eTurnEconomyCounts
}):
  | {
      ok: true
      prepared: PreparedDnd5eMonsterEscapeActiveEffect
      result: Dnd5eActionResult
      application?: Dnd5eMapResultPlan
    }
  | { ok: false; reason: Dnd5eMonsterBasicActionRejectReason } {
  const prepared = prepareDnd5eMonsterEscapeActiveEffect(input)
  if (!prepared.ok) return prepared
  return {
    ok: true,
    prepared: prepared.prepared,
    ...resolvePreparedDnd5eMonsterEscapeActiveEffect({
      prepared: prepared.prepared,
      d20: input.d20,
      d20Second: input.d20Second,
    }),
  }
}

export function prepareDnd5eMonsterEscapeGrapple(input: {
  combatId: string
  round?: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  actorTokenId: string
  grapplerId: string
  turnEconomy?: Dnd5eTurnEconomyCounts
}):
  | { ok: true; prepared: PreparedDnd5eMonsterEscapeGrapple }
  | { ok: false; reason: Dnd5eMonsterBasicActionRejectReason } {
  const actor = input.map.tokens.find((token) =>
    token.id === input.actorTokenId &&
    token.type === 'enemy' &&
    !!token.poolId &&
    !!getDnd5eSrdMonster(token.poolId),
  )
  if (!actor) return { ok: false, reason: 'invalid-actor' }
  const grappler = input.map.tokens.find((token) =>
    token.id === input.grapplerId &&
    token.id !== actor.id &&
    token.type !== 'obstacle')
  if (!grappler) return { ok: false, reason: 'invalid-grapple' }
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    round: input.round,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorIndex = snapshot.state.initiativeOrder.indexOf(actor.id)
  const combatant = snapshot.state.combatants[actor.id]
  const grapplerCombatant = snapshot.state.combatants[grappler.id]
  if (actorIndex < 0 || !combatant || !grapplerCombatant) {
    return { ok: false, reason: 'combatant-missing' }
  }
  const grapple = combatant.classState.activeEffects?.find((effect) =>
    effect.standardCondition === 'grappled' &&
    effect.source.actorId === grappler.id &&
    effect.escapeCheck == null)
  if (!grapple) return { ok: false, reason: 'invalid-grapple' }
  if (input.turnEconomy) {
    combatant.turn = {
      actionAvailable: input.turnEconomy.action.current > 0,
      bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
      reactionAvailable: input.turnEconomy.reaction.current > 0,
      objectInteractionAvailable: (input.turnEconomy.objectInteraction?.current ?? 1) > 0,
      movementRemaining: input.turnEconomy.movement.current,
    }
  }
  const actorDefense = dnd5eBestGrappleDefense(combatant)
  return {
    ok: true,
    prepared: {
      map: input.map,
      characters: input.characters,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      actor,
      grappler,
      actorSkill: actorDefense.skill,
      actorRollMode: dnd5eAbilityCheckRollMode(combatant, {
        ability: actorDefense.skill === 'acrobatics' ? 'dex' : 'str',
        skill: actorDefense.skill,
      }),
      grapplerRollMode: dnd5eAbilityCheckRollMode(grapplerCombatant, {
        ability: 'str',
        skill: 'athletics',
      }),
    },
  }
}

export function resolvePreparedDnd5eMonsterEscapeGrapple(input: {
  prepared: PreparedDnd5eMonsterEscapeGrapple
  actorD20: number
  actorD20Second?: number
  actorHalflingLuckyD20?: number
  actorHalflingLuckyD20Second?: number
  grapplerD20: number
  grapplerD20Second?: number
  grapplerHalflingLuckyD20?: number
  grapplerHalflingLuckyD20Second?: number
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const result = resolveDnd5eHeadlessAction(input.prepared.state, {
    type: 'escape-grapple',
    actorId: input.prepared.actor.id,
    grapplerId: input.prepared.grappler.id,
    actorD20: input.actorD20,
    actorD20Second: input.actorD20Second,
    actorHalflingLuckyD20: input.actorHalflingLuckyD20,
    actorHalflingLuckyD20Second: input.actorHalflingLuckyD20Second,
    targetD20: input.grapplerD20,
    targetD20Second: input.grapplerD20Second,
    targetHalflingLuckyD20: input.grapplerHalflingLuckyD20,
    targetHalflingLuckyD20Second: input.grapplerHalflingLuckyD20Second,
  })
  return {
    result,
    application: result.ok
      ? planDnd5eMapResultApplication({
          state: result.state,
          map: input.prepared.map,
          characters: input.prepared.characters,
          characterIdByCombatantId: input.prepared.characterIdByCombatantId,
        })
      : undefined,
  }
}

export function resolveDnd5eMonsterEscapeGrapple(input: {
  combatId: string
  round?: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  actorTokenId: string
  grapplerId: string
  actorD20: number
  actorD20Second?: number
  actorHalflingLuckyD20?: number
  actorHalflingLuckyD20Second?: number
  grapplerD20: number
  grapplerD20Second?: number
  grapplerHalflingLuckyD20?: number
  grapplerHalflingLuckyD20Second?: number
  turnEconomy?: Dnd5eTurnEconomyCounts
}):
  | {
      ok: true
      prepared: PreparedDnd5eMonsterEscapeGrapple
      result: Dnd5eActionResult
      application?: Dnd5eMapResultPlan
    }
  | { ok: false; reason: Dnd5eMonsterBasicActionRejectReason } {
  const prepared = prepareDnd5eMonsterEscapeGrapple(input)
  if (!prepared.ok) return prepared
  return {
    ok: true,
    prepared: prepared.prepared,
    ...resolvePreparedDnd5eMonsterEscapeGrapple({
      prepared: prepared.prepared,
      actorD20: input.actorD20,
      actorD20Second: input.actorD20Second,
      actorHalflingLuckyD20: input.actorHalflingLuckyD20,
      actorHalflingLuckyD20Second: input.actorHalflingLuckyD20Second,
      grapplerD20: input.grapplerD20,
      grapplerD20Second: input.grapplerD20Second,
      grapplerHalflingLuckyD20: input.grapplerHalflingLuckyD20,
      grapplerHalflingLuckyD20Second: input.grapplerHalflingLuckyD20Second,
    }),
  }
}

export function resolveDnd5eMonsterReleaseGrapple(input: {
  combatId: string
  round?: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  actorTokenId: string
  targetTokenId: string
  effectId?: string
}):
  | { ok: true; actor: Token; result: Dnd5eActionResult; application?: Dnd5eMapResultPlan }
  | { ok: false; reason: Dnd5eMonsterBasicActionRejectReason } {
  const actor = input.map.tokens.find((token) =>
    token.id === input.actorTokenId &&
    token.type === 'enemy' &&
    !!token.poolId &&
    !!getDnd5eSrdMonster(token.poolId),
  )
  if (!actor) return { ok: false, reason: 'invalid-actor' }
  const target = input.map.tokens.find((token) =>
    token.id === input.targetTokenId &&
    token.id !== actor.id &&
    token.type !== 'obstacle')
  if (!target) return { ok: false, reason: 'invalid-grapple' }
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    round: input.round,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const combatant = snapshot.state.combatants[actor.id]
  if (!combatant || !snapshot.state.combatants[target.id]) {
    return { ok: false, reason: 'combatant-missing' }
  }
  const result = resolveDnd5eHeadlessAction(snapshot.state, {
    type: 'release-grapple',
    actorId: actor.id,
    targetId: target.id,
    effectId: input.effectId,
  })
  return {
    ok: true,
    actor,
    result,
    application: result.ok
      ? planDnd5eMapResultApplication({
          state: result.state,
          map: input.map,
          characters: input.characters,
          characterIdByCombatantId: snapshot.characterIdByCombatantId,
        })
      : undefined,
  }
}

export function resolveDnd5eMonsterDodge(input: {
  combatId: string
  round?: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  actorTokenId: string
  turnEconomy?: Dnd5eTurnEconomyCounts
}):
  | { ok: true; actor: Token; result: Dnd5eActionResult; application?: Dnd5eMapResultPlan }
  | { ok: false; reason: 'invalid-actor' | 'combatant-missing' } {
  const actor = input.map.tokens.find((token) =>
    token.id === input.actorTokenId &&
    token.type === 'enemy' &&
    !!token.poolId &&
    !!getDnd5eSrdMonster(token.poolId),
  )
  if (!actor) return { ok: false, reason: 'invalid-actor' }
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    round: input.round,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorIndex = snapshot.state.initiativeOrder.indexOf(actor.id)
  const combatant = snapshot.state.combatants[actor.id]
  if (actorIndex < 0 || !combatant) return { ok: false, reason: 'combatant-missing' }
  if (input.turnEconomy) {
    combatant.turn = {
      actionAvailable: input.turnEconomy.action.current > 0,
      bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
      reactionAvailable: input.turnEconomy.reaction.current > 0,
      objectInteractionAvailable: (input.turnEconomy.objectInteraction?.current ?? 1) > 0,
      movementRemaining: input.turnEconomy.movement.current,
    }
  }
  const result = resolveDnd5eHeadlessAction(
    { ...snapshot.state, initiativeIndex: actorIndex },
    { type: 'dodge', actorId: actor.id },
  )
  return {
    ok: true,
    actor,
    result,
    application: result.ok
      ? planDnd5eMapResultApplication({
          state: result.state,
          map: input.map,
          characters: input.characters,
          characterIdByCombatantId: snapshot.characterIdByCombatantId,
        })
      : undefined,
  }
}
