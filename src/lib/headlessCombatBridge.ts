import type { InitiativeEntry } from '../components/map/InitiativeTracker'
import type { BattleMap, Token } from '../store/maps'
import type { Character } from '../types/character'
import type {
  HeadlessCombatEvent,
  HeadlessCombatResult,
  HeadlessDmCombatState,
  HeadlessEnemyApState,
} from './headlessDmCombatEngine'

export interface HeadlessCombatSnapshotInput {
  map: BattleMap
  characters: Character[]
  active: boolean
  round: number
  initiativeIndex: number
  initiativeOrder: InitiativeEntry[]
  enemyApByToken: Record<string, HeadlessEnemyApState>
  disengagedCharacterIds?: Iterable<string>
}

export interface HeadlessCombatResultApplyInput {
  result: HeadlessCombatResult
  currentActive: boolean
  currentRound: number
  currentInitiativeIndex: number
  currentInitiativeOrder: InitiativeEntry[]
  currentCharacters: Character[]
  currentMap?: BattleMap | null
  currentEnemyApByToken: Record<string, HeadlessEnemyApState>
  currentDisengagedCharacterIds?: Iterable<string>
}

export interface HeadlessCombatResultApplyPlan {
  ok: boolean
  active?: boolean
  round?: number
  initiativeIndex?: number
  initiativeOrder?: InitiativeEntry[]
  enemyApByToken?: Record<string, HeadlessEnemyApState>
  disengagedCharacterIds?: string[]
  charactersToUpdate: Character[]
  tokensToUpdate: Token[]
  deathEvents: Array<{ targetTokenId: string; characterId?: string }>
  shouldPublishCombatState: boolean
}

export function createHeadlessCombatSnapshot(input: HeadlessCombatSnapshotInput): HeadlessDmCombatState {
  return {
    map: input.map,
    characters: input.characters,
    active: input.active,
    round: input.round,
    initiativeIndex: input.initiativeIndex,
    initiativeOrder: input.initiativeOrder,
    enemyApByToken: input.enemyApByToken,
    disengagedCharacterIds: [...(input.disengagedCharacterIds ?? [])],
  }
}

export function planHeadlessCombatResultApplication(
  input: HeadlessCombatResultApplyInput,
): HeadlessCombatResultApplyPlan {
  const empty: HeadlessCombatResultApplyPlan = {
    ok: false,
    charactersToUpdate: [],
    tokensToUpdate: [],
    deathEvents: [],
    shouldPublishCombatState: false,
  }
  if (!input.result.ok) return empty

  const state = input.result.state
  let shouldPublishCombatState = false
  const plan: HeadlessCombatResultApplyPlan = {
    ok: true,
    charactersToUpdate: changedCharacters(input.currentCharacters, state.characters),
    tokensToUpdate: changedTokens(input.currentMap?.tokens ?? [], state.map.tokens),
    deathEvents: input.result.events
      .filter(isDeathDamageEvent)
      .map((event) => ({ targetTokenId: event.targetTokenId, characterId: event.characterId })),
    shouldPublishCombatState,
  }

  if (input.currentActive !== state.active) {
    plan.active = state.active
    shouldPublishCombatState = true
  }
  if (input.currentRound !== state.round) {
    plan.round = state.round
    shouldPublishCombatState = true
  }
  if (input.currentInitiativeIndex !== state.initiativeIndex) {
    plan.initiativeIndex = state.initiativeIndex
    shouldPublishCombatState = true
  }
  if (!sameJson(input.currentInitiativeOrder, state.initiativeOrder)) {
    plan.initiativeOrder = state.initiativeOrder
    shouldPublishCombatState = true
  }
  if (!sameJson(input.currentEnemyApByToken, state.enemyApByToken)) {
    plan.enemyApByToken = state.enemyApByToken
    shouldPublishCombatState = true
  }

  const currentDisengaged = [...(input.currentDisengagedCharacterIds ?? [])].sort()
  const nextDisengaged = [...(state.disengagedCharacterIds ?? [])].sort()
  if (!sameJson(currentDisengaged, nextDisengaged)) {
    plan.disengagedCharacterIds = nextDisengaged
  }

  plan.shouldPublishCombatState = shouldPublishCombatState
  return plan
}

function changedCharacters(current: Character[], next: Character[]): Character[] {
  const currentById = new Map(current.map((character) => [character.id, character]))
  return next.filter((character) => !sameJson(currentById.get(character.id), character))
}

function changedTokens(current: Token[], next: Token[]): Token[] {
  const currentById = new Map(current.map((token) => [token.id, token]))
  return next.filter((token) => !sameJson(currentById.get(token.id), token))
}

function isDeathDamageEvent(
  event: HeadlessCombatEvent,
): event is Extract<HeadlessCombatEvent, { type: 'damage-applied' }> {
  return event.type === 'damage-applied' && event.hpAfter <= 0
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
