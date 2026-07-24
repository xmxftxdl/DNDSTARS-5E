import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { SKILLS } from '../../lib/dnd'
import type { Dnd5eAbilityCheckPayload, Dnd5eTurnEconomyCounts, SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  dnd5eCombatantClassLevel,
  resolveDnd5eHeadlessAction,
  type Dnd5eActionResult,
  type Dnd5eCombatEvent,
  type Dnd5eCuttingWordsUse,
  type Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import { dnd5eConditionAbilityCheckDisadvantage } from './conditions'
import { resolveDnd5eRollMode } from './rollMode'

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
    (payload.skill && (!skill || skill.ability !== payload.ability))
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
  const actorIndex = snapshot.state.initiativeOrder.indexOf(actorToken.id)
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  if (actorIndex < 0 || !actorCombatant) return { ok: false, reason: 'combatant-missing' }
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
        requestedMode: payload.mode ?? 'normal',
        advantage: [
          {
            active: dnd5eCombatantClassLevel(actorCombatant, 'barbarian') >= 1 &&
              actorCombatant.classState.raging === true && payload.ability === 'str',
            reason: 'rage-strength-check',
          },
          {
            active: actorCombatant.classState.helpedAbilityCheckSourceId != null,
            reason: 'help',
          },
        ],
        disadvantage: [
          { active: actorCombatant.exhaustionLevel >= 1, reason: 'exhaustion' },
          { active: dnd5eConditionAbilityCheckDisadvantage(actorCombatant), reason: 'condition' },
          {
            active: actorCombatant.wearingUnproficientArmor &&
              (payload.ability === 'str' || payload.ability === 'dex'),
            reason: 'unproficient-armor',
          },
          {
            active: actorCombatant.armorStealthDisadvantage && payload.skill === 'stealth',
            reason: 'armor-stealth-disadvantage',
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
    bardicInspirationRoll?: number
    peerlessSkillRoll?: number
    darkOnesOwnLuckRoll?: number
    cuttingWords?: Dnd5eCuttingWordsUse
    strokeOfLuck?: boolean
  },
) {
  return {
    type: 'ability-check' as const,
    actorId: prepared.actorToken.id,
    ability: prepared.payload.ability,
    skill: prepared.payload.skill,
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
): Extract<Dnd5eCombatEvent, { type: 'ability-check-resolved' }> | undefined {
  const result = resolveDnd5eHeadlessAction(prepared.state, headlessAbilityCheckAction(prepared, { d20, d20Second }))
  return result.events.find((event): event is Extract<Dnd5eCombatEvent, { type: 'ability-check-resolved' }> =>
    event.type === 'ability-check-resolved')
}

export function resolvePreparedDnd5eAbilityCheck(input: {
  prepared: PreparedDnd5eAbilityCheck
  d20: number
  d20Second?: number
  bardicInspirationRoll?: number
  peerlessSkillRoll?: number
  darkOnesOwnLuckRoll?: number
  cuttingWords?: Dnd5eCuttingWordsUse
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
    }),
  }
}
