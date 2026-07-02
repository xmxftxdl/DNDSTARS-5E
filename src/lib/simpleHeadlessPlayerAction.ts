import type { BattleMap, Token } from '../store/maps'
import type { Character } from '../types/character'
import type {
  HeadlessCalmSpiritAction,
  HeadlessDisengageAction,
  HeadlessEndTurnAction,
  HeadlessPlayerMoveAction,
  HeadlessQiReduceCooldownAction,
  HeadlessUseSkillAction,
} from './headlessDmCombatEngine'
import type { SharedPlayerActionState } from './sharedCombatTypes'

type SimpleHeadlessAction =
  | HeadlessCalmSpiritAction
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
    default:
      return { ok: false, reason: 'unsupported-action' }
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
