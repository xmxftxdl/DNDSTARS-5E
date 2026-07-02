import type { BattleMap, Token } from '../store/maps'
import type { Character } from '../types/character'
import { snapTokenToGridCenter } from './gridCombat'
import type {
  HeadlessCommitTokenMoveAction,
  HeadlessCombatFailureReason,
  HeadlessCombatResult,
  HeadlessPlayerMoveAction,
} from './headlessDmCombatEngine'
import type { SharedPlayerActionState } from './sharedCombatTypes'

export type PlayerMovePrepareResult =
  | {
      ok: true
      actor: Character
      token: Token
      moveAction: HeadlessPlayerMoveAction
    }
  | { ok: false; reason: 'invalid-move' }

export function preparePlayerMoveAction(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: Character[]
}): PlayerMovePrepareResult {
  const actor = input.characters.find((character) => character.id === input.action.characterId)
  const token = input.map.tokens.find((item) => item.id === input.action.actorTokenId)
  if (
    input.action.type !== 'move-token' ||
    !actor ||
    !token ||
    token.type !== 'player' ||
    token.characterId !== actor.id ||
    !input.action.targetPosition
  ) {
    return { ok: false, reason: 'invalid-move' }
  }

  return {
    ok: true,
    actor,
    token,
    moveAction: {
      type: 'move-token',
      actorTokenId: input.action.actorTokenId,
      characterId: input.action.characterId,
      targetPosition: input.action.targetPosition,
    },
  }
}

export type PlayerMovePreviewResult =
  | {
      ok: true
      targetPosition: { x: number; y: number }
      movedFeet: number
      opportunityAttackerTokenIds: string[]
    }
  | { ok: false; reason: HeadlessCombatFailureReason }

export function summarizeHeadlessPlayerMovePreview(input: {
  result: HeadlessCombatResult
  token: Token
  requestedPosition: { x: number; y: number }
  map: BattleMap
}): PlayerMovePreviewResult {
  if (!input.result.ok) return { ok: false, reason: input.result.reason }

  const moved = input.result.events.find(
    (
      event,
    ): event is Extract<HeadlessCombatResult['events'][number], { type: 'token-moved' }> =>
      event.type === 'token-moved' && event.tokenId === input.token.id,
  )
  const targetPosition =
    moved?.to ??
    input.result.state.map.tokens.find((item) => item.id === input.token.id) ??
    snapTokenToGridCenter(input.requestedPosition.x, input.requestedPosition.y, input.token, input.map)
  const opportunityAttackerTokenIds = input.result.events
    .filter(
      (
        event,
      ): event is Extract<HeadlessCombatResult['events'][number], { type: 'opportunity-triggered' }> =>
        event.type === 'opportunity-triggered' && event.movingTokenId === input.token.id,
    )
    .map((event) => event.attackerTokenId)

  return {
    ok: true,
    targetPosition,
    movedFeet: moved?.feet ?? 0,
    opportunityAttackerTokenIds,
  }
}

export function playerMoveRejectReason(reason: HeadlessCombatFailureReason): string {
  return reason === 'movement-locked' ? 'no-move' : reason
}

export type PlayerMovePreviewPlan =
  | {
      status: 'rejected'
      reason: string
    }
  | {
      status: 'accepted'
      acceptedPosition: { x: number; y: number }
    }
  | {
      status: 'opportunity'
      targetPosition: { x: number; y: number }
      movedFeet: number
      opportunityAttackerTokenIds: string[]
      deferredMoveAction: HeadlessPlayerMoveAction
    }

export function planPlayerMoveAfterPreview(input: {
  preview: PlayerMovePreviewResult
  moveAction: HeadlessPlayerMoveAction
}): PlayerMovePreviewPlan {
  if (!input.preview.ok) {
    return {
      status: 'rejected',
      reason: playerMoveRejectReason(input.preview.reason),
    }
  }
  if (input.preview.opportunityAttackerTokenIds.length === 0) {
    return {
      status: 'accepted',
      acceptedPosition: input.preview.targetPosition,
    }
  }
  return {
    status: 'opportunity',
    targetPosition: input.preview.targetPosition,
    movedFeet: input.preview.movedFeet,
    opportunityAttackerTokenIds: input.preview.opportunityAttackerTokenIds,
    deferredMoveAction: buildDeferredPlayerMoveAction(input.moveAction),
  }
}

export function buildDeferredPlayerMoveAction(moveAction: HeadlessPlayerMoveAction): HeadlessPlayerMoveAction {
  return {
    ...moveAction,
    deferTokenMove: true,
  }
}

export function buildCommitPlayerMoveAction(input: {
  moveAction: HeadlessPlayerMoveAction
  targetPosition: { x: number; y: number }
  feet: number
}): HeadlessCommitTokenMoveAction {
  return {
    type: 'commit-token-move',
    actorTokenId: input.moveAction.actorTokenId,
    characterId: input.moveAction.characterId,
    targetPosition: input.targetPosition,
    feet: input.feet,
  }
}

export type PlayerMoveCommitAfterOpportunityResult =
  | {
      ok: true
      commitAction: HeadlessCommitTokenMoveAction
    }
  | {
      ok: false
      reason: 'mover-defeated'
      acceptedPosition: { x: number; y: number }
    }

export function buildPlayerMoveCommitAfterOpportunity(input: {
  moveAction: HeadlessPlayerMoveAction
  targetPosition: { x: number; y: number }
  feet: number
  token: Token
  characters: Character[]
}): PlayerMoveCommitAfterOpportunityResult {
  const mover = input.characters.find((character) => character.id === input.moveAction.characterId)
  if (!mover || mover.currentHp <= 0) {
    return {
      ok: false,
      reason: 'mover-defeated',
      acceptedPosition: { x: input.token.x, y: input.token.y },
    }
  }

  return {
    ok: true,
    commitAction: buildCommitPlayerMoveAction({
      moveAction: input.moveAction,
      targetPosition: input.targetPosition,
      feet: input.feet,
    }),
  }
}
