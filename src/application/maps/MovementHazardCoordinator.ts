import type { Character } from '../../types/character'
import type { Dnd5eHeadlessCombatState } from '../../rulesets/dnd5e/headlessCombatEngine'
import {
  createDnd5eMapCombatSnapshot,
  type Dnd5eMapResultPlan,
} from '../../rulesets/dnd5e/mapBridge'
import { settleDnd5eMovementTracesSequentially } from '../combat/dnd5eCombatRules'
import { truncateTokenMovementPath } from '../../lib/tokenMovementAnimation'

type BattleMap = Parameters<typeof createDnd5eMapCombatSnapshot>[0]['map']
type Token = BattleMap['tokens'][number]
type InitiativeEntry = Parameters<typeof createDnd5eMapCombatSnapshot>[0]['initiativeOrder'][number]

function projectInitiativeEntriesForHeadlessState(
  current: readonly InitiativeEntry[],
  state: Pick<
    Dnd5eHeadlessCombatState,
    'initiativeOrder' | 'initiativeSlotIds' | 'oneShotInitiativeSlotIds'
  >,
): InitiativeEntry[] {
  const slotIds = state.initiativeSlotIds
  if (!slotIds || slotIds.length !== state.initiativeOrder.length) return [...current]
  const bySlotId = new Map(current.map((entry) => [entry.slotId ?? entry.tokenId, entry]))
  const templateByTokenId = new Map<string, InitiativeEntry>()
  for (const entry of current) {
    if (!templateByTokenId.has(entry.tokenId) || !entry.turnKind) {
      templateByTokenId.set(entry.tokenId, entry)
    }
  }
  return slotIds.flatMap((slotId, index) => {
    const tokenId = state.initiativeOrder[index]
    const existing = bySlotId.get(slotId)
    if (existing) return [{ ...existing, slotId }]
    const template = templateByTokenId.get(tokenId)
    if (!template) return []
    return [{
      ...template,
      slotId,
      firstRoundOnly: undefined,
      turnKind: state.oneShotInitiativeSlotIds?.includes(slotId)
        ? 'activity-extra-turn'
        : undefined,
    }]
  })
}

export interface Dnd5eMovementHazardTrace {
  tokenId: string
  to: { x: number; y: number }
  path: readonly { x: number; y: number }[]
  pathElevationsFeet?: readonly number[]
}

export interface Dnd5eMovementHazardStepResult {
  state: Dnd5eHeadlessCombatState
  map: BattleMap
  application: Dnd5eMapResultPlan
  finalPosition: { x: number; y: number }
  logs: string[]
}

export interface Dnd5eMovementHazardResult {
  state: Dnd5eHeadlessCombatState
  map: BattleMap
  application: Dnd5eMapResultPlan
  finalPositionByCombatantId: Readonly<Record<string, { x: number; y: number }>>
  completedPathsByCombatantId: Readonly<Record<string, readonly { x: number; y: number }[]>>
  logs: string[]
}

interface MovementSettlementContext {
  state: Dnd5eHeadlessCombatState
  map: BattleMap
  characters: Character[]
  characterIdByCombatantId: Readonly<Record<string, string>>
  logs: string[]
}

export async function coordinateDnd5eMovementHazards(input: {
  initialApplication?: Dnd5eMovementHazardStepResult['application']
  worldMinute?: number
  state: Dnd5eHeadlessCombatState
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Readonly<Record<string, string>>
  movements: readonly Dnd5eMovementHazardTrace[]
  carefulMovementActorId?: string
  initiativeOrder: Parameters<typeof createDnd5eMapCombatSnapshot>[0]['initiativeOrder']
  settleStep(step: {
    state: Dnd5eHeadlessCombatState
    map: BattleMap
    characters: readonly Character[]
    characterIdByCombatantId: Readonly<Record<string, string>>
    token: Token
    movement: Dnd5eMovementHazardTrace
    carefulMovement: boolean
  }): Promise<Dnd5eMovementHazardStepResult>
  /** Finalize the actual endpoint only after along-path hazards have stopped or completed movement. */
  settleEndpoint?(settled: Dnd5eMovementHazardStepResult, movement: Dnd5eMovementHazardTrace): Promise<Dnd5eMovementHazardStepResult>
}): Promise<Dnd5eMovementHazardResult> {
  const sourceTokens = new Map(input.map.tokens.map((token) => [token.id, token]))
  const completedPathsByCombatantId: Record<string, Array<{ x: number; y: number }>> = {}
  const sequential = await settleDnd5eMovementTracesSequentially<MovementSettlementContext>({
    initialContext: {
      state: input.state,
      map: input.initialApplication?.map ?? input.map,
      characters: [...(input.initialApplication?.characters ?? input.characters)],
      characterIdByCombatantId: input.characterIdByCombatantId,
      logs: [],
    },
    movements: input.movements.filter((movement) => sourceTokens.has(movement.tokenId)),
    settle: async ({ context, movement }) => {
      const token = sourceTokens.get(movement.tokenId)!
      const movedCombatant = context.state.combatants[movement.tokenId]
      const movementState = movedCombatant &&
        (movedCombatant.position.x !== movement.to.x || movedCombatant.position.y !== movement.to.y)
        ? {
            ...context.state,
            combatants: {
              ...context.state.combatants,
              [movement.tokenId]: {
                ...movedCombatant,
                position: { ...movement.to },
              },
            },
          }
        : context.state
      let settled = await input.settleStep({
        state: movementState,
        map: context.map,
        characters: context.characters,
        characterIdByCombatantId: context.characterIdByCombatantId,
        token,
        movement,
        carefulMovement: movement.tokenId === input.carefulMovementActorId,
      })
      const path = truncateTokenMovementPath(movement.path, settled.finalPosition)
      const map = settled.application.map
      const characters = settled.application.characters
      const projectedInitiativeOrder = projectInitiativeEntriesForHeadlessState(
        input.initiativeOrder,
        settled.state,
      )
      const refreshed = createDnd5eMapCombatSnapshot({
        worldMinute: input.worldMinute ?? settled.state.companionScene?.worldMinute ?? input.state.companionScene?.worldMinute,
        combatId: settled.state.combatId,
        round: settled.state.round,
        turnSlotId: settled.state.turnSlotId,
        map,
        characters,
        initiativeOrder: projectedInitiativeOrder,
        additionalCreatureTokenIds: Object.keys(settled.state.combatants),
      })
      // The committed movement projection may intentionally be below terrain.
      // Snapshot construction clamps ordinary token heights to ground; retain
      // the validated moved token height until the endpoint ejection settles.
      const movedToken = map.tokens.find(entry => entry.id === movement.tokenId)
      const refreshedMover = refreshed.state.combatants[movement.tokenId]
      if (refreshedMover && movedToken?.elevationFeet != null && Number.isFinite(movedToken.elevationFeet)) {
        refreshedMover.elevationFeet = movedToken.elevationFeet
        refreshedMover.airborne = movedToken.elevationFeet > (refreshedMover.groundElevationFeet ?? 0) + 1e-4
      }
      const activeSlotId = settled.state.initiativeSlotIds?.[settled.state.initiativeIndex]
      const activeActorId = settled.state.initiativeOrder[settled.state.initiativeIndex]
      const refreshedInitiativeIndex = activeSlotId
        ? refreshed.state.initiativeSlotIds?.indexOf(activeSlotId) ?? -1
        : refreshed.state.initiativeOrder.indexOf(activeActorId)
      // Persistent area settlement can update its application while retaining
      // the earlier Headless snapshot. Rebuild before endpoint effects so they
      // observe actual stopping positions, damage, conditions and concentration.
      settled = { ...settled, state: { ...refreshed.state,
        active: settled.state.active,
        initiativeIndex: refreshedInitiativeIndex >= 0 ? refreshedInitiativeIndex : refreshed.state.initiativeIndex },
        map }
      const last = path.at(-1)
      if (!last || Math.hypot(last.x - settled.finalPosition.x, last.y - settled.finalPosition.y) > 0.01) {
        path.push({ ...settled.finalPosition })
      }
      completedPathsByCombatantId[movement.tokenId] = path
      return {
        context: {
          state: settled.state,
          map: settled.application.map,
          characters: settled.application.characters,
          characterIdByCombatantId: refreshed.characterIdByCombatantId,
          logs: [...context.logs, ...settled.logs],
        },
        finalPosition: settled.finalPosition,
      }
    },
  })
  let { state, map, characters, logs } = sequential.context
  const finalPositionByCombatantId = { ...sequential.finalPositionByCombatantId }
  // Finish all coupled voluntary traces before endpoint displacement. Otherwise
  // the next carried trace can overwrite a group ejection from the previous one.
  if (input.settleEndpoint) for (const movement of input.movements) {
    if (!state.combatants[movement.tokenId] || !map.tokens.some(token => token.id === movement.tokenId)) continue
    const settled = await input.settleEndpoint({ state, map, logs,
      application: { map, characters, changedCharacterIds: [], changedTokenIds: [] },
      finalPosition: state.combatants[movement.tokenId].position }, movement)
    state = settled.state
    map = settled.application.map
    characters = settled.application.characters
    logs = settled.logs
    for (const trace of input.movements) {
      const position = state.combatants[trace.tokenId]?.position
      if (!position) continue
      finalPositionByCombatantId[trace.tokenId] = { ...position }
      const path = completedPathsByCombatantId[trace.tokenId] ?? []
      const last = path.at(-1)
      if (!last || Math.hypot(last.x - position.x, last.y - position.y) > 0.01) path.push({ ...position })
      completedPathsByCombatantId[trace.tokenId] = path
    }
  }
  const changedCharacterIds = characters.flatMap((character) => {
    const before = input.characters.find((candidate) => candidate.id === character.id)
    return JSON.stringify(before) === JSON.stringify(character) ? [] : [character.id]
  })
  const changedTokenIds = map.tokens.flatMap((token) => {
    const before = input.map.tokens.find((candidate) => candidate.id === token.id)
    return JSON.stringify(before) === JSON.stringify(token) ? [] : [token.id]
  })
  return {
    state,
    map,
    finalPositionByCombatantId,
    completedPathsByCombatantId,
    logs,
    application: { map, characters, changedCharacterIds, changedTokenIds },
  }
}
