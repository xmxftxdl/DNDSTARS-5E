import type { BattleMap, Token } from '../store/maps'
import type { Character } from '../types/character'
import { snapTokenToGridCenter } from './gridCombat'
import type {
  HeadlessCommitTokenMoveAction,
  HeadlessCombatFailureReason,
  HeadlessCombatResult,
  HeadlessDmCombatState,
  HeadlessPlayerMoveAction,
} from './headlessDmCombatEngine'
import { resolveHeadlessDmAuthorityAction } from './headlessDmAuthority'
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

export function playerMoveRejectReason(reason: string): string {
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

export type PlayerMoveOpportunityPlan = Extract<PlayerMovePreviewPlan, { status: 'opportunity' }>

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

export type PlayerMoveAuthorityPreviewResult =
  | { status: 'rejected'; reason: string }
  | {
      status: 'resolved'
      actor: Character
      token: Token
      moveAction: HeadlessPlayerMoveAction
      snapshot: HeadlessDmCombatState
      result: Extract<HeadlessCombatResult, { ok: true }>
      plan: Exclude<PlayerMovePreviewPlan, { status: 'rejected' }>
    }

export function resolvePlayerMoveAuthorityPreview(input: {
  action: SharedPlayerActionState
  state: HeadlessDmCombatState
}): PlayerMoveAuthorityPreviewResult {
  const prepared = preparePlayerMoveAction({
    action: input.action,
    map: input.state.map,
    characters: input.state.characters,
  })
  if (!prepared.ok) return { status: 'rejected', reason: prepared.reason }

  const result = resolveHeadlessDmAuthorityAction(input.state, prepared.moveAction)
  const preview = summarizeHeadlessPlayerMovePreview({
    result,
    token: prepared.token,
    requestedPosition: prepared.moveAction.targetPosition,
    map: input.state.map,
  })
  const plan = planPlayerMoveAfterPreview({ preview, moveAction: prepared.moveAction })
  if (!result.ok) return { status: 'rejected', reason: result.reason }
  if (plan.status === 'rejected') return { status: 'rejected', reason: plan.reason }
  return {
    status: 'resolved',
    actor: prepared.actor,
    token: prepared.token,
    moveAction: prepared.moveAction,
    snapshot: input.state,
    result,
    plan,
  }
}

export type PlayerMoveAfterOpportunityPlan =
  | {
      status: 'interrupted'
      acceptedReason: 'mover-defeated'
      acceptedPosition: { x: number; y: number }
      apLog: PlayerMoveApLog
    }
  | {
      status: 'commit'
      commitAction: HeadlessCommitTokenMoveAction
      acceptedPosition: { x: number; y: number }
      apLog: PlayerMoveApLog
    }

export interface PlayerMoveApLog {
  amount: number
  action: string
  detail: string
}

export function planPlayerMoveAfterOpportunity(input: {
  moveAction: HeadlessPlayerMoveAction
  movePlan: PlayerMoveOpportunityPlan
  token: Token
  characters: Character[]
}): PlayerMoveAfterOpportunityPlan {
  const commit = buildPlayerMoveCommitAfterOpportunity({
    moveAction: input.moveAction,
    targetPosition: input.movePlan.targetPosition,
    feet: input.movePlan.movedFeet,
    token: input.token,
    characters: input.characters,
  })

  if (!commit.ok) {
    return {
      status: 'interrupted',
      acceptedReason: commit.reason,
      acceptedPosition: commit.acceptedPosition,
      apLog: {
        amount: 1,
        action: '移动',
        detail: `${input.movePlan.movedFeet} 尺，移动被打断`,
      },
    }
  }

  return {
    status: 'commit',
    commitAction: commit.commitAction,
    acceptedPosition: input.movePlan.targetPosition,
    apLog: {
      amount: 1,
      action: '移动',
      detail: `${input.movePlan.movedFeet} 尺`,
    },
  }
}

export function buildDeferredPlayerMoveAction(moveAction: HeadlessPlayerMoveAction): HeadlessPlayerMoveAction {
  return {
    ...moveAction,
    deferTokenMove: true,
  }
}

export function resolveDeferredPlayerMoveAuthority(input: {
  state: HeadlessDmCombatState
  moveAction: HeadlessPlayerMoveAction
}): HeadlessCombatResult {
  return resolveHeadlessDmAuthorityAction(input.state, buildDeferredPlayerMoveAction(input.moveAction))
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

export function resolvePlayerMoveCommitAuthority(input: {
  state: HeadlessDmCombatState
  commitAction: HeadlessCommitTokenMoveAction
}): HeadlessCombatResult {
  return resolveHeadlessDmAuthorityAction(input.state, input.commitAction)
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
