import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { dnd5eRemoteSensorCanHearToken } from './remoteSensorHearing'
import { recognizeAreasByVisualSearch, canSeeRecognizableArea } from './areaVisualRecognition'
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
import { DND5E_TOOL_CHOICES } from './buildChoiceCatalogs'
import {dnd5eRollDiceRecipes} from './rollDiceModifiers'
import {dnd5eRollDiceOccurrenceId} from './rollDiceTransaction'

export function preparedDnd5eAbilityCheckEffectDice(prepared: PreparedDnd5eAbilityCheck) {
  const actor=prepared.state.combatants[prepared.actorToken.id]
  return dnd5eRollDiceRecipes({actorId:actor.id,effects:actor.classState.activeEffects,kind:'ability-check',
    eventId:dnd5eRollDiceOccurrenceId(prepared.action.id,actor.id,'ability-check',0)})
}

export type Dnd5eAbilityCheckRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'combatant-missing'
  | 'action-unavailable'
  | 'cannot-hear'

export interface PreparedDnd5eAbilityCheck {
  /** Host-only attachment from the persisted paid pre-roll choice. Never read from the player payload. */
  disadvantageNegation?: { rollId: string; transactionId: string }
  worldMinute?: number
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
  roomMaps?: readonly BattleMap[]
  worldMinute?: number
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  turnEconomy?: Dnd5eTurnEconomyCounts
}): { ok: true; prepared: PreparedDnd5eAbilityCheck } | { ok: false; reason: Dnd5eAbilityCheckRejectReason } {
  const { action } = input
  const incomingPayload = action.dnd5eAbilityCheck
  if (action.type !== 'dnd5e-ability-check' || !incomingPayload) return { ok: false, reason: 'invalid-action' }
  let payload: Dnd5eAbilityCheckPayload = incomingPayload
  if (payload.investigatedAreaId != null) {
    const illusion = input.map.dnd5ePluginAreas?.find(area => area.id === payload!.investigatedAreaId)
    if (!illusion?.illusionRecognition || payload.ability !== 'int' || payload.skill !== 'investigation' ||
      payload.spendAction !== true || payload.totalOnly || payload.context != null || payload.perceivedTargetId != null ||
      (input.worldMinute != null && illusion.expiresAtWorldMinute != null && input.worldMinute >= illusion.expiresAtWorldMinute) ||
      action.round > illusion.expiresAfterRound) return { ok: false, reason: 'invalid-action' }
    payload = { ...payload, dc: illusion.illusionRecognition.dc }
  }

  const skill = payload.skill ? SKILLS.find((candidate) => candidate.key === payload.skill) : undefined
  if (
    (payload.toolId != null && (payload.skill != null || payload.context != null || !DND5E_TOOL_CHOICES.some(tool => tool.id === payload.toolId))) ||
    !Number.isInteger(payload.dc) || payload.dc < 0 || payload.dc > 100 ||
    (payload.totalOnly && (payload.dc !== 0 || payload.spendAction === true)) ||
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
      ) && !(
        payload.context === 'climbing' && payload.ability === 'str' && payload.skill === 'athletics'
      ) && !((payload.context === 'sight' || payload.context === 'hearing' || payload.context === 'smell') && payload.ability === 'wis' && payload.skill === 'perception'))
  ) return { ok: false, reason: 'invalid-action' }
  const actor = input.characters.find((character) => character.id === action.characterId)
  const actorToken = input.map.tokens.find((token) => token.id === action.actorTokenId && token.characterId === action.characterId)
  if (!actor || !actorToken || actor.currentHp <= 0) return { ok: false, reason: 'invalid-actor' }
  if (payload.remoteHearing != null) {
    const hearing = payload.remoteHearing
    if (!hearing || typeof hearing !== 'object' || Array.isArray(hearing) ||
      Object.keys(hearing).some(key => key !== 'sensorId' && key !== 'soundSourceTokenId') ||
      typeof hearing.sensorId !== 'string' || !hearing.sensorId.trim() || hearing.sensorId.length > 500 ||
      typeof hearing.soundSourceTokenId !== 'string' || !hearing.soundSourceTokenId.trim() || hearing.soundSourceTokenId.length > 500 ||
      payload.ability !== 'wis' || payload.skill !== 'perception' || payload.context != null ||
      payload.perceivedTargetId != null || payload.investigatedAreaId != null || !input.roomMaps || input.worldMinute == null) return { ok: false, reason: 'invalid-action' }
    const sensors = input.roomMaps.flatMap(map => map.tokens.filter(token => token.id === hearing.sensorId))
    if (sensors.length !== 1 || sensors[0].dnd5eSpellEffect?.sourceCharacterId !== actor.id ||
      sensors[0].dnd5eSpellEffect?.sourceTokenId !== actorToken.id) return { ok: false, reason: 'invalid-actor' }
    if (!dnd5eRemoteSensorCanHearToken({ maps: input.roomMaps, characters: input.characters,
      ...hearing, worldMinute: input.worldMinute })) return { ok: false, reason: 'cannot-hear' }
    payload = { ...payload, context: 'hearing' }
  }
  if (payload.investigatedAreaId) {
    const illusion = input.map.dnd5ePluginAreas!.find(area => area.id === payload!.investigatedAreaId)!
    if (!canSeeRecognizableArea(input.map, illusion, actorToken, input.characters, input.worldMinute)) return { ok: false, reason: 'invalid-action' }
  }

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
  if (payload.detectedCreatureId != null && (payload.detectedCreatureId === actorToken.id ||
    !snapshot.state.combatants[payload.detectedCreatureId] || payload.toolId != null || payload.investigatedAreaId != null)) return { ok: false, reason: 'invalid-action' }
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
      worldMinute: input.worldMinute,
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
          detectedCreatureId: payload.detectedCreatureId,
          state: snapshot.state,
          context: payload.context,
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
    effectRollDice?: Readonly<Record<string,readonly number[]>>
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
    toolId: prepared.payload.toolId,
    perceivedTargetId: prepared.payload.perceivedTargetId,
    detectedCreatureId: prepared.payload.detectedCreatureId,
    context: prepared.payload.context,
    mode: prepared.payload.mode,
    disadvantageNegation: prepared.disadvantageNegation,
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
  effectRollDice?: Readonly<Record<string,readonly number[]>>,
): Extract<Dnd5eCombatEvent, { type: 'ability-check-resolved' }> | undefined {
  const result = resolveDnd5eHeadlessAction(prepared.state, headlessAbilityCheckAction(prepared, {
    d20,
    d20Second,
    postD20Adjustment,
    effectRollDice,
  }),{transactionId:prepared.action.id})
  return result.events.find((event): event is Extract<Dnd5eCombatEvent, { type: 'ability-check-resolved' }> =>
    event.type === 'ability-check-resolved')
}

export function resolvePreparedDnd5eAbilityCheck(input: {
  effectRollDice?: Readonly<Record<string,readonly number[]>>
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
  const result = resolveDnd5eHeadlessAction(input.prepared.state, headlessAbilityCheckAction(input.prepared, input),{transactionId:input.prepared.action.id})
  if (!result.ok) return { result }
  const application = planDnd5eMapResultApplication({
    state: result.state,
    map: input.prepared.map,
    characters: input.prepared.characters,
    characterIdByCombatantId: input.prepared.characterIdByCombatantId,
    events: [...result.events],
  })
  const payload = input.prepared.payload
  const check = result.events.find(event => event.type === 'ability-check-resolved')
  if (payload.investigatedAreaId && check?.type === 'ability-check-resolved') {
    application.map = { ...application.map, dnd5ePluginAreas: application.map.dnd5ePluginAreas?.map(area => {
      const recognition = area.illusionRecognition
      return area.id === payload.investigatedAreaId && recognition && check.total >= recognition.dc
        ? { ...area, illusionRecognition: { ...recognition, knownTokenIds: [...new Set([...recognition.knownTokenIds, input.prepared.actorToken.id])] } } : area
    }) }
  }
  if (((payload.skill === 'perception' && payload.context === 'sight' && !payload.perceivedTargetId) ||
    (payload.skill === 'investigation' && !payload.investigatedAreaId && !payload.totalOnly &&
      (payload.spendAction || !input.prepared.action.combatId))) &&
    !payload.detectedCreatureId && check?.type === 'ability-check-resolved') {
    application.map = recognizeAreasByVisualSearch({ map: application.map, actorTokenId: input.prepared.actorToken.id,
      skill: payload.skill === 'investigation' ? 'investigation' : 'perception',
      characters: application.characters, total: check.total, worldMinute: input.prepared.worldMinute, round: input.prepared.action.round })
  }
  return {
    result,
    application,
  }
}
