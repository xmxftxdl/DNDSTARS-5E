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
import { planDnd5eSummonedCreature } from './summonedCreatures'

export type Dnd5ePluginFeatureActionRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'plugin-missing'
  | 'room-rules-unavailable'
  | 'plugin-not-enabled-for-room'
  | 'plugin-version-mismatch'
  | 'feature-not-selected'
  | 'feature-unavailable'
  | 'invalid-target'
  | 'target-out-of-range'
  | 'summon-position-blocked'
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
  targetCells: GridCell[]
  targetCell?: GridCell
  feature: RegisteredDnd5ePluginFeature
  distanceFeet: number
  headlessAction: Dnd5ePluginAction
}

export type Dnd5ePluginApplicationRebaseResult =
  | { ok: true; application: Dnd5eMapResultPlan }
  | { ok: false; reason: 'plugin-commit-conflict' }

function sameSnapshot(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/**
 * Interrupt/骰子等待期间地图仍可被其他事务推进。插件结果提交前只把本事务
 * 声明修改的实体覆盖到最新快照；同一实体被并发修改时 fail closed。
 */
export function rebaseDnd5ePluginFeatureApplication(input: {
  baseMap: BattleMap
  baseCharacters: readonly Character[]
  application: Dnd5eMapResultPlan
  latestMap: BattleMap
  latestCharacters: readonly Character[]
}): Dnd5ePluginApplicationRebaseResult {
  if (
    input.baseMap.id !== input.application.map.id ||
    input.latestMap.id !== input.application.map.id
  ) return { ok: false, reason: 'plugin-commit-conflict' }

  const changedTokenIds = [...new Set(input.application.changedTokenIds)]
  const changedCharacterIds = [...new Set(input.application.changedCharacterIds)]
  const baseTokens = new Map(input.baseMap.tokens.map((token) => [token.id, token]))
  const resultTokens = new Map(input.application.map.tokens.map((token) => [token.id, token]))
  const latestTokens = new Map(input.latestMap.tokens.map((token) => [token.id, token]))
  if (
    baseTokens.size !== input.baseMap.tokens.length ||
    resultTokens.size !== input.application.map.tokens.length ||
    latestTokens.size !== input.latestMap.tokens.length
  ) return { ok: false, reason: 'plugin-commit-conflict' }

  for (const tokenId of changedTokenIds) {
    const result = resultTokens.get(tokenId)
    const base = baseTokens.get(tokenId)
    const latest = latestTokens.get(tokenId)
    if (!result || (base && !latest) || (!base && latest)) {
      return { ok: false, reason: 'plugin-commit-conflict' }
    }
    if (base && latest && !sameSnapshot(base, latest)) {
      return { ok: false, reason: 'plugin-commit-conflict' }
    }
    latestTokens.set(tokenId, result)
  }

  const baseCharacters = new Map(input.baseCharacters.map((character) => [character.id, character]))
  const resultCharacters = new Map(input.application.characters.map((character) => [character.id, character]))
  const latestCharacters = new Map(input.latestCharacters.map((character) => [character.id, character]))
  for (const characterId of changedCharacterIds) {
    const base = baseCharacters.get(characterId)
    const result = resultCharacters.get(characterId)
    const latest = latestCharacters.get(characterId)
    if (!base || !result || !latest || !sameSnapshot(base, latest)) {
      return { ok: false, reason: 'plugin-commit-conflict' }
    }
    latestCharacters.set(characterId, result)
  }

  const baseAreas = new Map((input.baseMap.dnd5ePluginAreas ?? []).map((area) => [area.id, area]))
  const resultAreas = new Map((input.application.map.dnd5ePluginAreas ?? []).map((area) => [area.id, area]))
  const latestAreas = new Map((input.latestMap.dnd5ePluginAreas ?? []).map((area) => [area.id, area]))
  const areaIds = new Set([...baseAreas.keys(), ...resultAreas.keys()])
  for (const areaId of areaIds) {
    const base = baseAreas.get(areaId)
    const result = resultAreas.get(areaId)
    if (sameSnapshot(base, result)) continue
    const latest = latestAreas.get(areaId)
    if ((base && !sameSnapshot(base, latest)) || (!base && latest)) {
      return { ok: false, reason: 'plugin-commit-conflict' }
    }
    if (result) latestAreas.set(areaId, result)
    else latestAreas.delete(areaId)
  }

  return {
    ok: true,
    application: {
      map: {
        ...input.latestMap,
        tokens: [...latestTokens.values()],
        dnd5ePluginAreas: [...latestAreas.values()],
      },
      characters: [...latestCharacters.values()],
      changedTokenIds,
      changedCharacterIds,
    },
  }
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
  }[] | null
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
  if (input.roomRequiredPlugins === null) return { ok: false, reason: 'room-rules-unavailable' }
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
  if (feature.action.trigger && feature.action.trigger.kind !== 'active-use') {
    return { ok: false, reason: 'feature-unavailable' }
  }
  const actor = input.characters.find((character) => character.id === action.characterId)
  const actorToken = input.map.tokens.find((token) =>
    token.id === action.actorTokenId && token.characterId === action.characterId,
  )
  if (!actor || !actorToken || actor.currentHp <= 0) return { ok: false, reason: 'invalid-actor' }
  if (!dnd5eCharacterHasPluginFeature(actor, feature.id)) {
    return { ok: false, reason: feature.grantedBySubclass ? 'feature-unavailable' : 'feature-not-selected' }
  }
  const economyFailure = economyRejectReason(feature.action.economy, input.turnEconomy)
  if (economyFailure) return { ok: false, reason: economyFailure }

  let targetToken: Token | undefined
  let targetTokens: Token[]
  let targetCell: GridCell | undefined
  let targetCells: GridCell[] = []
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
    targetCells = cells
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
    const permitsEmptyArea = (!!feature.action.persistentArea || !!feature.action.summon) &&
      feature.action.interrupt?.audience !== 'target'
    if (!targetToken && !permitsEmptyArea) return { ok: false, reason: 'invalid-target' }
    // 持续区域可以放在当前没有生物的格子上。Prepared 的展示目标使用施法者，
    // 但传给 Headless 的 targetIds 仍为空，避免把施法者伪装成区域目标。
    targetToken ??= actorToken
    if (feature.action.summon && targetCell) {
      const summonPlacement = planDnd5eSummonedCreature({
        map: input.map,
        actorToken,
        sourceCharacterId: actor.id,
        featureId: feature.id,
        pluginId: feature.ownerPluginId,
        actionId: action.id,
        round: action.round,
        targetCell,
        initiativeD20: 1,
        summon: feature.action.summon,
      })
      if (!summonPlacement.ok) return {
        ok: false,
        reason: summonPlacement.reason === 'summon-position-blocked' ? 'summon-position-blocked' : 'invalid-target',
      }
    }
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
      targetCells,
      targetCell,
      feature,
      distanceFeet,
      headlessAction: {
        type: 'plugin',
        pluginId: feature.ownerPluginId,
        actionId: feature.action.id,
        transactionId: action.id,
        featureId: feature.id,
        actorId: actorToken.id,
        targetId: targetTokens[0]?.id,
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
  /** Host-validated replacement for any untrusted player-supplied action payload. */
  authoritativePayload?: Dnd5ePluginAction['payload']
  interruptChoiceId?: string
  summonInitiativeD20?: number
}): Promise<{
  result: Dnd5eActionResult
  application?: Dnd5eMapResultPlan
  summonedInitiativeEntries?: InitiativeEntry[]
}> {
  const summon = input.prepared.feature.action?.summon
  const summonPlan = summon && input.prepared.targetCell
    ? planDnd5eSummonedCreature({
        map: input.prepared.map,
        actorToken: input.prepared.actorToken,
        sourceCharacterId: input.prepared.actor.id,
        featureId: input.prepared.feature.id,
        pluginId: input.prepared.feature.ownerPluginId,
        actionId: input.prepared.action.id,
        round: input.prepared.action.round,
        targetCell: input.prepared.targetCell,
        initiativeD20: input.summonInitiativeD20 ?? 0,
        summon,
      })
    : undefined
  if (summon && (!summonPlan || !summonPlan.ok)) {
    return {
      result: {
        ok: false,
        state: input.prepared.state,
        events: [],
        reason: 'invalid-plugin-action',
      },
    }
  }
  const definition = dnd5ePluginHeadlessActionDefinition(
    input.prepared.headlessAction.pluginId,
    input.prepared.headlessAction.actionId,
  )
  const headlessAction: Dnd5ePluginAction = {
    ...input.prepared.headlessAction,
    payload: input.authoritativePayload ?? input.prepared.headlessAction.payload,
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
  const application = planDnd5eMapResultApplication({
    state: result.state,
    map: input.prepared.map,
    characters: input.prepared.characters,
    characterIdByCombatantId: input.prepared.characterIdByCombatantId,
  })
  const persistentArea = input.prepared.feature.action?.persistentArea
  if (persistentArea && input.prepared.targetCells.length > 0) {
    const id = `plugin-area:${input.prepared.action.id}`
    const targeting = input.prepared.feature.action!.targeting
    const triggers = persistentArea.triggers?.map((trigger) => ({
      ...trigger,
      savingThrow: trigger.savingThrow
        ? {
            ...trigger.savingThrow,
            dc: trigger.savingThrow.dc === 'source-save-dc'
              ? Math.max(1, Math.min(40, input.prepared.actor.saveDC))
              : trigger.savingThrow.dc,
          }
        : undefined,
      damage: trigger.damage ? { ...trigger.damage } : undefined,
      condition: trigger.condition
        ? { ...trigger.condition, duration: { ...trigger.condition.duration } }
        : undefined,
    }))
    application.map = {
      ...application.map,
      dnd5ePluginAreas: [
        ...(application.map.dnd5ePluginAreas ?? []).filter((area) => area.id !== id),
        {
          id,
          pluginId: input.prepared.feature.ownerPluginId,
          featureId: input.prepared.feature.id,
          label: persistentArea.label,
          color: persistentArea.color ?? '#8b5cf6',
          sourceCharacterId: input.prepared.actor.id,
          sourceTokenId: input.prepared.actorToken.id,
          cells: input.prepared.targetCells.map((cell) => ({ ...cell })),
          createdRound: input.prepared.action.round,
          expiresAfterRound: input.prepared.action.round + persistentArea.durationRounds - 1,
          concentrationId: persistentArea.concentration ? `plugin-area:${input.prepared.action.id}` : undefined,
          relation: targeting.kind === 'area' ? targeting.relation ?? 'any' : 'any',
          includeSelf: targeting.kind === 'area' && targeting.includeSelf === true,
          visual: persistentArea.visual ? { ...persistentArea.visual } : undefined,
          triggers: triggers && triggers.length > 0 ? triggers : undefined,
        },
      ],
    }
  }
  if (summonPlan?.ok) {
    application.map = {
      ...application.map,
      tokens: [
        ...application.map.tokens.filter((token) => token.id !== summonPlan.plan.token.id),
        summonPlan.plan.token,
      ],
    }
    application.changedTokenIds = [
      ...new Set([...application.changedTokenIds, summonPlan.plan.token.id]),
    ]
  }
  return {
    result,
    application,
    summonedInitiativeEntries: summonPlan?.ok ? [summonPlan.plan.initiativeEntry] : undefined,
  }
}
