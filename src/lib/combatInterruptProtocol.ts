import type { Token } from '../store/maps'
import type { Character } from '../types/character'
import type { EnemyTurnResult } from './enemyAi'
import type { CombatInterruptKind, SharedCombatInterrupt } from './combatInterruptQueue'

export type GaleComboDecision = 'accepted' | 'declined' | 'timeout'

export type DodgeInterruptPayload = Record<string, unknown> & {
  result: EnemyTurnResult
  targetName: string
}
export type DodgeInterruptResponse = Record<string, unknown> & {
  wantsDodge: boolean
  dodgeD20?: number
}

export type StableMindInterruptPayload = Record<string, unknown> & {
  targetName: string
  fullDamage: number
  damageAfterSave: number
  saveD20: number
  saveMod: number
  saveTotal: number
  dc: number
}
export type StableMindInterruptResponse = Record<string, unknown> & { useStableMind: boolean }

export type GaleComboInterruptPayload = Record<string, unknown> & {
  casterName: string
  triggerLabel: string
}
export type GaleComboInterruptResponse = Record<string, unknown> & { useGaleCombo: boolean }

export type AgileLeapInterruptPayload = Record<string, unknown> & {
  targetName: string
  feet: number
  uses: number
  maxUses: number
}
export type AgileLeapInterruptResponse = Record<string, unknown> & { useAgileLeap: boolean }

export type OpportunityAttackInterruptPayload = Record<string, unknown> & {
  attackerName: string
  targetName: string
  attackerTokenId: string
  targetTokenId: string
}
export type OpportunityAttackInterruptResponse = Record<string, unknown> & { useOpportunityAttack: boolean }

export interface CombatInterruptPayloadMap {
  dodge: DodgeInterruptPayload
  'stable-mind': StableMindInterruptPayload
  'gale-combo': GaleComboInterruptPayload
  'agile-leap': AgileLeapInterruptPayload
  'opportunity-attack': OpportunityAttackInterruptPayload
}

export interface CombatInterruptResponseMap {
  dodge: DodgeInterruptResponse
  'stable-mind': StableMindInterruptResponse
  'gale-combo': GaleComboInterruptResponse
  'agile-leap': AgileLeapInterruptResponse
  'opportunity-attack': OpportunityAttackInterruptResponse
}

export type CombatInterruptByKind<K extends CombatInterruptKind> =
  SharedCombatInterrupt<CombatInterruptPayloadMap[K], CombatInterruptResponseMap[K]> & { kind: K }

export type TypedCombatInterrupt = {
  [K in CombatInterruptKind]: CombatInterruptByKind<K>
}[CombatInterruptKind]

export interface CombatInterruptAnswerContext {
  characters: Character[]
  visibleCharacters: Character[]
  playerCharId?: string
  assignedCharacterId?: string | null
  tokens?: Token[]
}

export interface CombatInterruptAnswerCandidate {
  character?: Character
  canAnswer: boolean
}

export function defaultCombatInterruptResponse<K extends CombatInterruptKind>(
  kind: K,
): CombatInterruptResponseMap[K] {
  switch (kind) {
    case 'dodge':
      return { wantsDodge: false } as CombatInterruptResponseMap[K]
    case 'stable-mind':
      return { useStableMind: false } as CombatInterruptResponseMap[K]
    case 'gale-combo':
      return { useGaleCombo: false } as CombatInterruptResponseMap[K]
    case 'agile-leap':
      return { useAgileLeap: false } as CombatInterruptResponseMap[K]
    case 'opportunity-attack':
      return { useOpportunityAttack: false } as CombatInterruptResponseMap[K]
  }
}

export function isCombatInterruptKind<K extends CombatInterruptKind>(
  interrupt: SharedCombatInterrupt,
  kind: K,
): interrupt is CombatInterruptByKind<K> {
  return interrupt.kind === kind
}

export function resolveCombatInterruptCharacter(
  interrupt: Pick<SharedCombatInterrupt, 'kind' | 'actorCharId' | 'targetCharId'>,
  characters: Character[],
): Character | undefined {
  const characterId =
    interrupt.kind === 'gale-combo' || interrupt.kind === 'opportunity-attack'
      ? interrupt.actorCharId
      : interrupt.targetCharId
  return characterId ? characters.find((character) => character.id === characterId) : undefined
}

export function resolveCombatInterruptAnswerCandidate(
  interrupt: SharedCombatInterrupt,
  context: CombatInterruptAnswerContext,
): CombatInterruptAnswerCandidate {
  const character = resolveCombatInterruptCharacter(interrupt, context.characters)
  if (!character || character.currentHp <= 0) return { character, canAnswer: false }

  const visibleIds = new Set(context.visibleCharacters.map((visible) => visible.id))
  const isPlayerCharacter = character.id === context.playerCharId
  const isAssignedCharacter = character.id === context.assignedCharacterId
  const isVisibleCharacter = visibleIds.has(character.id)
  const isPublicCharacter = !character.dmNotes

  if (interrupt.kind === 'dodge' || interrupt.kind === 'stable-mind') {
    return {
      character,
      canAnswer: isPlayerCharacter || isVisibleCharacter || isPublicCharacter,
    }
  }

  if (interrupt.kind === 'agile-leap') {
    return {
      character,
      canAnswer: isPlayerCharacter || isAssignedCharacter || isVisibleCharacter || isPublicCharacter,
    }
  }

  const linkedPlayerCharIds = new Set(
    (context.tokens ?? [])
      .filter((token) => token.type === 'player' && !!token.characterId)
      .map((token) => token.characterId!),
  )
  const visibleLinkedPlayerCharIds = [...linkedPlayerCharIds].filter((id) =>
    context.characters.some(
      (candidate) => candidate.id === id && candidate.visibleToPlayers !== false,
    ),
  )
  const isOnlyVisibleLinkedPlayer =
    !context.assignedCharacterId &&
    visibleLinkedPlayerCharIds.length === 1 &&
    visibleLinkedPlayerCharIds[0] === character.id

  return {
    character,
    canAnswer:
      isPlayerCharacter ||
      isAssignedCharacter ||
      isVisibleCharacter ||
      isOnlyVisibleLinkedPlayer ||
      isPublicCharacter,
  }
}
