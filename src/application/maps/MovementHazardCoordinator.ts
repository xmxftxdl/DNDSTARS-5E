import type { Character } from '../../types/character'
import type { Dnd5eHeadlessCombatState } from '../../rulesets/dnd5e/headlessCombatEngine'
import {
  createDnd5eMapCombatSnapshot,
  type Dnd5eMapResultPlan,
} from '../../rulesets/dnd5e/mapBridge'
import { settleDnd5eMovementTracesSequentially } from '../combat/dnd5eCombatRules'

type BattleMap = Parameters<typeof createDnd5eMapCombatSnapshot>[0]['map']
type Token = BattleMap['tokens'][number]

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
}): Promise<Dnd5eMovementHazardResult> {
  const sourceTokens = new Map(input.map.tokens.map((token) => [token.id, token]))
  const sequential = await settleDnd5eMovementTracesSequentially<MovementSettlementContext>({
    initialContext: {
      state: input.state,
      map: input.map,
      characters: [...input.characters],
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
      const settled = await input.settleStep({
        state: movementState,
        map: context.map,
        characters: context.characters,
        characterIdByCombatantId: context.characterIdByCombatantId,
        token,
        movement,
        carefulMovement: movement.tokenId === input.carefulMovementActorId,
      })
      const map = settled.application.map
      const characters = settled.application.characters
      const refreshed = createDnd5eMapCombatSnapshot({
        combatId: input.state.combatId,
        round: input.state.round,
        turnSlotId: input.state.turnSlotId,
        map,
        characters,
        initiativeOrder: input.initiativeOrder,
      })
      const activeActorId = input.state.initiativeOrder[input.state.initiativeIndex]
      const refreshedInitiativeIndex = refreshed.state.initiativeOrder.indexOf(activeActorId)
      return {
        context: {
          state: {
            ...refreshed.state,
            initiativeIndex: refreshedInitiativeIndex >= 0
              ? refreshedInitiativeIndex
              : refreshed.state.initiativeIndex,
          },
          map,
          characters,
          characterIdByCombatantId: refreshed.characterIdByCombatantId,
          logs: [...context.logs, ...settled.logs],
        },
        finalPosition: settled.finalPosition,
      }
    },
  })
  const { state, map, characters, logs } = sequential.context
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
    finalPositionByCombatantId: sequential.finalPositionByCombatantId,
    logs,
    application: { map, characters, changedCharacterIds, changedTokenIds },
  }
}
