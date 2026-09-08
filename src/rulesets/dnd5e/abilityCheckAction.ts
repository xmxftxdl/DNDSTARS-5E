import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { SKILLS } from '../../lib/dnd'
import type { Dnd5eAbilityCheckPayload, Dnd5eTurnEconomyCounts, SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  dnd5eCombatantClassLevel,
  dnd5eCombatantHasSubclass,
  dnd5eAbilityCheckRollMode,
  resolveDnd5eHeadlessAction,
  type Dnd5eActionResult,
  type Dnd5eCombatEvent,
  type Dnd5eCuttingWordsUse,
  type Dnd5eHeadlessCombatState,
  type Dnd5eOptionalBonusDieUse,
  type Dnd5ePostD20AdjustmentUse,
} from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, dnd5eRequestedInitiativeActorIndex, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import { resolveDnd5eRollMode } from './rollMode'
import { dnd5eRageFeatureForCombatant } from './rageFeature'

export type Dnd5eAbilityCheckRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'combatant-missing'
  | 'action-unavailable'

export interface PreparedDnd5eAbilityCheck {
  action: SharedPlayerActionState
  payload: Dnd5eAbilityCheckPayload
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actor: Character
  actorToken: Token
  rollMode: 'normal' | 'advantage' | 'disadvantage'
}

export function prepareDnd5eAbilityCheck(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  turnEconomy?: Dnd5eTurnEconomyCounts
}): { ok: true; prepared: PreparedDnd5eAbilityCheck } | { ok: false; reason: Dnd5eAbilityCheckRejectReason } {
  const { action } = input
  const payload = action.dnd5eAbilityCheck
  if (action.type !== 'dnd5e-ability-check' || !payload) return { ok: false, reason: 'invalid-action' }
  const skill = payload.skill ? SKILLS.find((candidate) => candidate.key === payload.skill) : undefined
  if (
    !Number.isInteger(payload.dc) || payload.dc < 0 || payload.dc > 100 ||
    (payload.skill && (!skill || skill.ability !== payload.ability)) ||
    (payload.perceivedTargetId != null && payload.skill !== 'perception') ||
    (payload.context != null &&
      !(
        payload.context === 'push-pull-lift-break' &&
        payload.ability === 'str' &&
        payload.skill == null
      ) &&
      !(
        payload.context === 'interact-with-dragons' &&
        payload.ability === 'cha'
      ))
  ) return { ok: false, reason: 'invalid-action' }
  const actor = input.characters.find((character) => character.id === action.characterId)
  const actorToken = input.map.tokens.find((token) => token.id === action.actorTokenId && token.characterId === action.characterId)
  if (!actor || !actorToken || actor.currentHp <= 0) return { ok: false, reason: 'invalid-actor' }
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: action.combatId ?? `map-${input.map.id}`,
    round: action.round,
    turnSlotId: input.initiativeOrder[action.initiativeIndex]?.slotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorIndex = dnd5eRequestedInitiativeActorIndex(
    snapshot.state,
    actorToken.id,
    input.action.initiativeIndex,
  )
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  if (actorIndex < 0 || !actorCombatant) return { ok: false, reason: 'combatant-missing' }
  if (payload.perceivedTargetId != null && (
    payload.perceivedTargetId === actorToken.id ||
    snapshot.state.combatants[payload.perceivedTargetId] == null
  )) return { ok: false, reason: 'invalid-action' }
  if (
    payload.context === 'interact-with-dragons' &&
    (
      dnd5eCombatantClassLevel(actorCombatant, 'sorcerer') < 1 ||
      !dnd5eCombatantHasSubclass(actorCombatant, 'sorcerer', 'draconic')
    )
  ) return { ok: false, reason: 'invalid-action' }
  if (payload.spendAction && input.turnEconomy && input.turnEconomy.action.current < 1) {
    return { ok: false, reason: 'action-unavailable' }
  }
  if (input.turnEconomy) {
    actorCombatant.turn = {
      ...actorCombatant.turn,
      actionAvailable: input.turnEconomy.action.current > 0,
      bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
      reactionAvailable: input.turnEconomy.reaction.current > 0,
      movementRemaining: input.turnEconomy.movement.current,
    }
  }
  return {
    ok: true,
    prepared: {
      action,
      payload,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      actor,
      actorToken,
      rollMode: resolveDnd5eRollMode({
        requestedMode: dnd5eAbilityCheckRollMode(actorCombatant, {
          ability: payload.ability,
          skill: payload.skill,
          perceivedTargetId: payload.perceivedTargetId,
          requestedMode: payload.mode ?? 'normal',
        }),
        advantage: [
          {
            active: payload.context === 'push-pull-lift-break' &&
              !!dnd5eRageFeatureForCombatant(
                actorCombatant,
                'object-strength-and-carrying',
              ),
            reason: 'rage-feature-carrying',
          },
        ],
      }).mode,
    },
  }
}

function headlessAbilityCheckAction(
  prepared: PreparedDnd5eAbilityCheck,
  input: {
    d20: number
    d20Second?: number
    halflingLuckyD20?: number
    halflingLuckyD20Second?: number
    bardicInspirationRoll?: number
    peerlessSkillRoll?: number
    darkOnesOwnLuckRoll?: number
    cuttingWords?: Dnd5eCuttingWordsUse
    optionalBonusDice?: readonly Dnd5eOptionalBonusDieUse[]
    postD20Adjustment?: Dnd5ePostD20AdjustmentUse
    strokeOfLuck?: boolean
  },
) {
  return {
    type: 'ability-check' as const,
    actorId: prepared.actorToken.id,
    ability: prepared.payload.ability,
    skill: prepared.payload.skill,
    perceivedTargetId: prepared.payload.perceivedTargetId,
    context: prepared.payload.context,
    mode: prepared.payload.mode,
    dc: prepared.payload.dc,
    spendAction: prepared.payload.spendAction,
    ...input,
  }
}

export function previewPreparedDnd5eAbilityCheck(
  prepared: PreparedDnd5eAbilityCheck,
  d20: number,
  d20Second?: number,
  postD20Adjustment?: Dnd5ePostD20AdjustmentUse,
): Extract<Dnd5eCombatEvent, { type: 'ability-check-resolved' }> | undefined {
  const result = resolveDnd5eHeadlessAction(prepared.state, headlessAbilityCheckAction(prepared, {
    d20,
    d20Second,
    postD20Adjustment,
  }))
  return result.events.find((event): event is Extract<Dnd5eCombatEvent, { type: 'ability-check-resolved' }> =>
    event.type === 'ability-check-resolved')
}

export function resolvePreparedDnd5eAbilityCheck(input: {
  prepared: PreparedDnd5eAbilityCheck
  d20: number
  d20Second?: number
  halflingLuckyD20?: number
  halflingLuckyD20Second?: number
  bardicInspirationRoll?: number
  peerlessSkillRoll?: number
  darkOnesOwnLuckRoll?: number
  cuttingWords?: Dnd5eCuttingWordsUse
  optionalBonusDice?: readonly Dnd5eOptionalBonusDieUse[]
  postD20Adjustment?: Dnd5ePostD20AdjustmentUse
  strokeOfLuck?: boolean
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const result = resolveDnd5eHeadlessAction(input.prepared.state, headlessAbilityCheckAction(input.prepared, input))
  if (!result.ok) return { result }
  return {
    result,
    application: planDnd5eMapResultApplication({
      state: result.state,
      map: input.prepared.map,
      characters: input.prepared.characters,
      characterIdByCombatantId: input.prepared.characterIdByCombatantId,
      events: [...result.events],
    }),
  }
}
