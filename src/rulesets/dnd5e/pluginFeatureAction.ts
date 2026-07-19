import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import {
  DND_FEET_PER_CELL,
  pixelToCell,
  tokenFootprintDistanceCells,
  type GridCell,
} from '../../lib/gridCombat'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import { aoeOrientFromCell, canPlaceAoe, cellsForAoe, tokensInCells } from '../../lib/skillTargeting'
import type {
  Dnd5eTurnEconomyCounts,
  SharedPlayerActionState,
} from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  dnd5eCharacterHasPluginFeature,
  dnd5ePluginFeatureDefinition,
  dnd5ePluginHeadlessActionDefinition,
  missingDnd5eRulesPluginRequirements,
  type Dnd5ePluginAction,
  type RegisteredDnd5ePluginFeature,
} from './pluginApi'
import {
  resolveDnd5eHeadlessAction,
  resolveDnd5eSandboxedPluginCapabilities,
  type Dnd5eActionFailure,
  type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import { resolveDnd5eSandboxedPluginAction } from './pluginSandbox'
import {
  createDnd5eMapCombatSnapshot,
  planDnd5eMapResultApplication,
  type Dnd5eMapResultPlan,
} from './mapBridge'

export type Dnd5ePluginFeatureActionRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'plugin-missing'
  | 'plugin-not-enabled-for-room'
  | 'plugin-version-mismatch'
  | 'feature-not-selected'
  | 'feature-unavailable'
  | 'invalid-target'
  | 'target-out-of-range'
  | 'action-unavailable'
  | 'bonus-action-unavailable'
  | 'reaction-unavailable'
  | 'combatant-missing'

export interface PreparedDnd5ePluginFeatureAction {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actor: Character
  actorToken: Token
  targetToken: Token
  targetTokens: Token[]
  targetCell?: GridCell
  feature: RegisteredDnd5ePluginFeature
  distanceFeet: number
  headlessAction: Dnd5ePluginAction
}

function economyRejectReason(
  economy: NonNullable<RegisteredDnd5ePluginFeature['action']>['economy'],
  turnEconomy: Dnd5eTurnEconomyCounts | undefined,
): Dnd5ePluginFeatureActionRejectReason | undefined {
  if (!turnEconomy || economy === 'none') return undefined
  if (economy === 'action' && turnEconomy.action.current < 1) return 'action-unavailable'
  if (economy === 'bonusAction' && turnEconomy.bonusAction.current < 1) return 'bonus-action-unavailable'
  if (economy === 'reaction' && turnEconomy.reaction.current < 1) return 'reaction-unavailable'
  return undefined
}

export function prepareDnd5ePluginFeatureAction(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  turnEconomy?: Dnd5eTurnEconomyCounts
  roomRequiredPlugins?: readonly {
    id: string
    version: string
    integrity?: string
  }[]
}): { ok: true; prepared: PreparedDnd5ePluginFeatureAction } | {
  ok: false
  reason: Dnd5ePluginFeatureActionRejectReason
} {
  const { action } = input
  const payload = action.dnd5ePluginAction
  if (action.type !== 'dnd5e-plugin-action' || !payload?.featureId) {
    return { ok: false, reason: 'invalid-action' }
  }
  const feature = dnd5ePluginFeatureDefinition(payload.featureId)
  if (!feature) return { ok: false, reason: 'plugin-missing' }
  if (input.roomRequiredPlugins) {
    const roomRequirement = input.roomRequiredPlugins.find((plugin) => plugin.id === feature.ownerPluginId)
    if (!roomRequirement) return { ok: false, reason: 'plugin-not-enabled-for-room' }
    if (missingDnd5eRulesPluginRequirements([roomRequirement]).length > 0) {
      return { ok: false, reason: 'plugin-version-mismatch' }
    }
  }
  if (!feature.action || feature.automation === 'manual') {
    return { ok: false, reason: 'feature-unavailable' }
  }
  const actor = input.characters.find((character) => character.id === action.characterId)
  const actorToken = input.map.tokens.find((token) =>
    token.id === action.actorTokenId && token.characterId === action.characterId,
  )
  if (!actor || !actorToken || actor.currentHp <= 0) return { ok: false, reason: 'invalid-actor' }
  if (!actor.dnd5ePluginFeatureIds?.includes(feature.id)) {
    return { ok: false, reason: 'feature-not-selected' }
  }
  if (!dnd5eCharacterHasPluginFeature(actor, feature.id)) {
    return { ok: false, reason: 'feature-unavailable' }
  }
  const economyFailure = economyRejectReason(feature.action.economy, input.turnEconomy)
  if (economyFailure) return { ok: false, reason: economyFailure }

  let targetToken: Token | undefined
  let targetTokens: Token[]
  let targetCell: GridCell | undefined
  let distanceFeet = 0
  if (feature.action.targeting.kind === 'self') {
    if (action.targetTokenId && action.targetTokenId !== actorToken.id) {
      return { ok: false, reason: 'invalid-target' }
    }
    targetToken = actorToken
    targetTokens = [actorToken]
  } else if (feature.action.targeting.kind === 'single-creature') {
    targetToken = input.map.tokens.find((token) => token.id === action.targetTokenId)
    if (!targetToken || targetToken.type === 'obstacle') return { ok: false, reason: 'invalid-target' }
    if (targetToken.id === actorToken.id && feature.action.targeting.includeSelf !== true) {
      return { ok: false, reason: 'invalid-target' }
    }
    const opposed = areOpposedCombatTokens(actorToken, targetToken)
    if (feature.action.targeting.relation === 'ally' && opposed) {
      return { ok: false, reason: 'invalid-target' }
    }
    if (feature.action.targeting.relation === 'enemy' && !opposed) {
      return { ok: false, reason: 'invalid-target' }
    }
    distanceFeet = tokenFootprintDistanceCells(actorToken, targetToken, input.map) *
      Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
    if (
      feature.action.targeting.rangeFeet != null &&
      distanceFeet > feature.action.targeting.rangeFeet
    ) {
      return { ok: false, reason: 'target-out-of-range' }
    }
    targetTokens = [targetToken]
  } else {
    const targeting = feature.action.targeting
    const casterCell = pixelToCell(actorToken.x, actorToken.y, input.map)
    targetCell = action.targetCell ?? (targeting.template.shape === 'circle' && targeting.template.origin === 'self'
      ? casterCell
      : undefined)
    if (!targetCell || !canPlaceAoe(targeting.template, casterCell, targetCell)) {
      return { ok: false, reason: 'target-out-of-range' }
    }
    const targetOrientation = action.targetOrientation
    if (
      targetOrientation != null &&
      (!Number.isInteger(targetOrientation) || targetOrientation < 0 || targetOrientation > 3)
    ) return { ok: false, reason: 'invalid-target' }
    const orientFrom = aoeOrientFromCell(targeting.template, casterCell, targetCell, {
      rectRotation: targetOrientation,
    })
    const cells = cellsForAoe(targeting.template, orientFrom, targetCell)
    targetTokens = tokensInCells(input.map, input.map.tokens, cells)
      .filter((token) => {
        if (token.type === 'obstacle') return false
        if (token.id === actorToken.id && targeting.includeSelf !== true) return false
        const opposed = areOpposedCombatTokens(actorToken, token)
        if (targeting.relation === 'ally' && opposed) return false
        if (targeting.relation === 'enemy' && !opposed) return false
        return true
      })
      .slice(0, targeting.maximumTargets ?? 64)
    targetToken = targetTokens[0]
    if (!targetToken) return { ok: false, reason: 'invalid-target' }
  }

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
  const targetCombatants = targetTokens.map((token) => snapshot.state.combatants[token.id])
  if (actorIndex < 0 || !actorCombatant || targetCombatants.some((target) => !target)) {
    return { ok: false, reason: 'combatant-missing' }
  }
  if (targetCombatants.some((target) => target && target.currentHp <= 0)) return { ok: false, reason: 'invalid-target' }
  if (input.turnEconomy) {
    actorCombatant.turn = {
      ...actorCombatant.turn,
      actionAvailable: input.turnEconomy.action.current > 0,
      bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
      reactionAvailable: input.turnEconomy.reaction.current > 0,
    }
  }
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
      targetToken,
      targetTokens,
      targetCell,
      feature,
      distanceFeet,
      headlessAction: {
        type: 'plugin',
        pluginId: feature.ownerPluginId,
        actionId: feature.action.id,
        featureId: feature.id,
        actorId: actorToken.id,
        targetId: targetToken.id,
        targetIds: targetTokens.map((token) => token.id),
        targetCell,
        targetOrientation: action.targetOrientation,
        distanceFeet,
        payload: payload.payload,
      },
    },
  }
}

const PLUGIN_FAILURE_REASONS = new Set<Dnd5eActionFailure>([
  'combat-ended',
  'stale-turn',
  'invalid-actor',
  'invalid-target',
  'action-unavailable',
  'reaction-unavailable',
  'bonus-action-unavailable',
  'class-resource-unavailable',
  'invalid-class-feature',
  'feature-already-used',
  'invalid-plugin-action',
  'invalid-monster-action',
  'insufficient-movement',
  'invalid-dice',
])

function pluginFailure(reason: string): Dnd5eActionFailure {
  return PLUGIN_FAILURE_REASONS.has(reason as Dnd5eActionFailure)
    ? reason as Dnd5eActionFailure
    : 'invalid-plugin-action'
}

export async function resolvePreparedDnd5ePluginFeatureAction(input: {
  prepared: PreparedDnd5ePluginFeatureAction
  rolls?: Dnd5ePluginAction['rolls']
  interruptChoiceId?: string
}): Promise<{ result: Dnd5eActionResult; application?: Dnd5eMapResultPlan }> {
  const definition = dnd5ePluginHeadlessActionDefinition(
    input.prepared.headlessAction.pluginId,
    input.prepared.headlessAction.actionId,
  )
  const headlessAction: Dnd5ePluginAction = {
    ...input.prepared.headlessAction,
    rolls: input.rolls,
    interruptChoiceId: input.interruptChoiceId,
  }
  let result: Dnd5eActionResult
  if (definition?.execution === 'worker') {
    const actor = input.prepared.state.combatants[headlessAction.actorId]
    const target = headlessAction.targetId
      ? input.prepared.state.combatants[headlessAction.targetId]
      : undefined
    const targets = (headlessAction.targetIds ?? (target ? [target.id] : []))
      .flatMap((targetId) => input.prepared.state.combatants[targetId] ? [input.prepared.state.combatants[targetId]] : [])
    if (!actor) {
      result = { ok: false, state: input.prepared.state, events: [], reason: 'invalid-actor' }
    } else {
      try {
        const sandbox = await resolveDnd5eSandboxedPluginAction({
          action: headlessAction,
          actor,
          target,
          targets,
        })
        result = sandbox.ok
          ? resolveDnd5eSandboxedPluginCapabilities(
              input.prepared.state,
              headlessAction,
              sandbox.operations,
            )
          : {
              ok: false,
              state: input.prepared.state,
              events: [],
              reason: pluginFailure(sandbox.reason),
            }
      } catch {
        result = { ok: false, state: input.prepared.state, events: [], reason: 'invalid-plugin-action' }
      }
    }
  } else {
    result = resolveDnd5eHeadlessAction(input.prepared.state, headlessAction)
  }
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
