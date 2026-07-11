import type { BattleMap, Token } from '../store/maps'
import type { Character } from '../types/character'
import type {
  HeadlessCalmSpiritAction,
  HeadlessBulletMatchSwapAction,
  HeadlessCombatResult,
  HeadlessDmCombatState,
  HeadlessDisengageAction,
  HeadlessEndTurnAction,
  HeadlessPlayerMoveAction,
  HeadlessQiReduceCooldownAction,
  HeadlessUseSkillAction,
} from './headlessDmCombatEngine'
import { resolveHeadlessDmAuthorityAction } from './headlessDmAuthority'
import type { SharedPlayerActionState } from './sharedCombatTypes'

type SimpleHeadlessAction =
  | HeadlessCalmSpiritAction
  | HeadlessBulletMatchSwapAction
  | HeadlessDisengageAction
  | HeadlessEndTurnAction
  | HeadlessPlayerMoveAction
  | HeadlessQiReduceCooldownAction
  | HeadlessUseSkillAction

const SIMPLE_ACTION_TYPES = new Set<SharedPlayerActionState['type']>([
  'agile-leap-move',
  'calm-spirit',
  'calm-spirit-move',
  'disengage',
  'end-turn',
  'qi-reduce-cooldown',
  'skill-free-move',
  'use-skill',
  'bullet-match-swap',
])

export type SimpleHeadlessPlayerActionResult =
  | {
      ok: true
      headlessAction: SimpleHeadlessAction
      settlement: 'standard' | 'move' | 'end-turn'
      token?: Token
    }
  | { ok: false; reason: string }

export function isSimpleHeadlessPlayerActionType(type: SharedPlayerActionState['type']): boolean {
  return SIMPLE_ACTION_TYPES.has(type)
}

export function buildSimpleHeadlessPlayerAction(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: Character[]
}): SimpleHeadlessPlayerActionResult {
  const { action } = input
  switch (action.type) {
    case 'calm-spirit':
      return buildCalmSpiritAction(action)
    case 'use-skill':
      return buildUseSkillAction(action)
    case 'disengage':
      return okStandard({
        type: 'disengage',
        actorTokenId: action.actorTokenId,
        characterId: action.characterId,
      })
    case 'end-turn':
      return {
        ok: true,
        settlement: 'end-turn',
        headlessAction: {
          type: 'end-turn',
          actorTokenId: action.actorTokenId,
          characterId: action.characterId,
        },
      }
    case 'agile-leap-move':
      return buildMoveAction(input, 'agile-leap', 'invalid-agile-leap')
    case 'skill-free-move':
      return buildMoveAction(input, 'skill-free-move', 'invalid-skill-free-move')
    case 'calm-spirit-move':
      return buildMoveAction(input, 'calm-spirit-move', 'invalid-calm-spirit-move')
    case 'qi-reduce-cooldown':
      return buildQiReduceCooldownAction(input)
    case 'bullet-match-swap':
      return buildBulletMatchSwapAction(action)
    default:
      return { ok: false, reason: 'unsupported-action' }
  }
}

function buildBulletMatchSwapAction(action: SharedPlayerActionState): SimpleHeadlessPlayerActionResult {
  const swap = action.bulletSwap
  if (!swap) return { ok: false, reason: 'invalid-bullet-swap' }
  return okStandard({
    type: 'bullet-match-swap',
    actorTokenId: action.actorTokenId,
    characterId: action.characterId,
    from: swap.from,
    to: swap.to,
    seed: swap.seed,
  })
}

export type SimpleHeadlessPlayerAuthorityResult =
  | { status: 'rejected'; reason: string }
  | {
      status: 'resolved'
      prepared: Extract<SimpleHeadlessPlayerActionResult, { ok: true }>
      result: HeadlessCombatResult
    }

export function resolveSimpleHeadlessPlayerAuthority(input: {
  action: SharedPlayerActionState
  state: HeadlessDmCombatState
}): SimpleHeadlessPlayerAuthorityResult {
  const prepared = buildSimpleHeadlessPlayerAction({
    action: input.action,
    map: input.state.map,
    characters: input.state.characters,
  })
  if (!prepared.ok) return { status: 'rejected', reason: prepared.reason }
  return {
    status: 'resolved',
    prepared,
    result: resolveHeadlessDmAuthorityAction(input.state, prepared.headlessAction),
  }
}

function buildCalmSpiritAction(action: SharedPlayerActionState): SimpleHeadlessPlayerActionResult {
  if (!action.calmSpiritEffect) return { ok: false, reason: 'unsupported-action' }
  return okStandard({
    type: 'calm-spirit',
    actorTokenId: action.actorTokenId,
    characterId: action.characterId,
    effect: action.calmSpiritEffect,
    skillId: action.skillId,
  })
}

function buildUseSkillAction(action: SharedPlayerActionState): SimpleHeadlessPlayerActionResult {
  if (!action.skillId) return { ok: false, reason: 'invalid-skill' }
  return okStandard({
    type: 'use-skill',
    actorTokenId: action.actorTokenId,
    characterId: action.characterId,
    skillId: action.skillId,
  })
}

function buildMoveAction(
  input: {
    action: SharedPlayerActionState
    map: BattleMap
    characters: Character[]
  },
  mode: NonNullable<HeadlessPlayerMoveAction['mode']>,
  reason: string,
): SimpleHeadlessPlayerActionResult {
  const actor = input.characters.find((character) => character.id === input.action.characterId)
  const token = input.map.tokens.find((item) => item.id === input.action.actorTokenId)
  if (!actor || !token || !input.action.targetPosition) return { ok: false, reason }
  return {
    ok: true,
    settlement: 'move',
    token,
    headlessAction: {
      type: 'move-token',
      actorTokenId: input.action.actorTokenId,
      characterId: input.action.characterId,
      targetPosition: input.action.targetPosition,
      mode,
    },
  }
}

function buildQiReduceCooldownAction(input: {
  action: SharedPlayerActionState
  characters: Character[]
}): SimpleHeadlessPlayerActionResult {
  const actor = input.characters.find((character) => character.id === input.action.characterId)
  const skill = actor?.combatSkills.find((item) => item.id === input.action.skillId)
  if (!actor || !skill) return { ok: false, reason: 'invalid-qi-reduce' }
  return okStandard({
    type: 'qi-reduce-cooldown',
    actorTokenId: input.action.actorTokenId,
    characterId: input.action.characterId,
    skillId: skill.id,
  })
}

function okStandard(headlessAction: SimpleHeadlessAction): SimpleHeadlessPlayerActionResult {
  return {
    ok: true,
    settlement: 'standard',
    headlessAction,
  }
}
