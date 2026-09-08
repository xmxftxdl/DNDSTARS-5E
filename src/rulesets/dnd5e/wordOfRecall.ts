import type {
  Dnd5eWordOfRecallDeclarationV1,
  Dnd5eWordOfRecallResolutionV1,
  Dnd5eWordOfRecallTargetV1,
} from '../../lib/sharedCombatTypes'
import { resolveFreeDropCell } from '../../lib/gridCombat'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eRecallSanctuaryAuthorityRecordV1 } from './spellAuthorityState'

const boundedText = (value: unknown, maximum: number): string | undefined => {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized.length >= 1 && normalized.length <= maximum ? normalized : undefined
}

export function normalizeDnd5eWordOfRecallDeclarationV1(
  value: unknown,
): Dnd5eWordOfRecallDeclarationV1 | undefined {
  if (!value || typeof value !== 'object') return undefined
  const input = value as Record<string, unknown>
  if (input.schemaVersion !== 1) return undefined
  if (input.mode === 'designate-sanctuary') {
    const sanctuaryName = boundedText(input.sanctuaryName, 160)
    const deityConnection = boundedText(input.deityConnection, 500)
    return sanctuaryName && deityConnection
      ? { schemaVersion: 1, mode: 'designate-sanctuary', sanctuaryName, deityConnection }
      : undefined
  }
  if (input.mode !== 'recall' || !Array.isArray(input.targets) || input.targets.length > 5) {
    return undefined
  }
  const seen = new Set<string>()
  const targets: Dnd5eWordOfRecallTargetV1[] = []
  for (const rawTarget of input.targets) {
    if (!rawTarget || typeof rawTarget !== 'object') return undefined
    const target = rawTarget as Record<string, unknown>
    const tokenId = boundedText(target.tokenId, 160)
    const name = boundedText(target.name, 160)
    if (!tokenId || !name || seen.has(tokenId)) return undefined
    seen.add(tokenId)
    targets.push({ tokenId, name })
  }
  return { schemaVersion: 1, mode: 'recall', targets }
}

export function normalizeDnd5eWordOfRecallResolutionV1(
  value: unknown,
): Dnd5eWordOfRecallResolutionV1 | undefined {
  if (!value || typeof value !== 'object') return undefined
  const input = value as Record<string, unknown>
  if (
    input.schemaVersion !== 1 ||
    typeof input.sanctuaryConsecratedConfirmed !== 'boolean' ||
    typeof input.willingCreaturesConfirmed !== 'boolean'
  ) return undefined
  return {
    schemaVersion: 1,
    sanctuaryConsecratedConfirmed: input.sanctuaryConsecratedConfirmed,
    willingCreaturesConfirmed: input.willingCreaturesConfirmed,
  }
}

export function dnd5eWordOfRecallSanctuaryRecordId(actorId: string): string {
  return `recall-sanctuary:${actorId}`
}

export function dnd5eWordOfRecallSanctuary(
  character: Character | undefined,
): Dnd5eRecallSanctuaryAuthorityRecordV1 | undefined {
  if (!character) return undefined
  const record = character.dnd5eCombatState?.spellAuthorityRecords?.[
    dnd5eWordOfRecallSanctuaryRecordId(character.id)
  ]
  return record?.kind === 'recall-sanctuary' &&
    record.sourceActorId === character.id &&
    record.subjectActorId === character.id
    ? record
    : undefined
}

export function designateDnd5eWordOfRecallSanctuary(input: {
  character: Character
  declaration: Extract<Dnd5eWordOfRecallDeclarationV1, { mode: 'designate-sanctuary' }>
  map: BattleMap
  actorToken: Token
  sourceActionId: string
  slotLevel: number
  createdWorldMinute: number
}): Character {
  const recordId = dnd5eWordOfRecallSanctuaryRecordId(input.character.id)
  const record: Dnd5eRecallSanctuaryAuthorityRecordV1 = {
    schemaVersion: 1,
    id: recordId,
    kind: 'recall-sanctuary',
    sourceActorId: input.character.id,
    subjectActorId: input.character.id,
    sourceActivityId: input.sourceActionId,
    createdWorldMinute: input.createdWorldMinute,
    slotLevel: input.slotLevel,
    sanctuaryName: input.declaration.sanctuaryName,
    deityConnection: input.declaration.deityConnection,
    destinationMapId: input.map.id,
    destinationMapName: input.map.name,
    destinationX: input.actorToken.x,
    destinationY: input.actorToken.y,
    destinationElevationFeet: Number(input.actorToken.elevationFeet ?? 0),
  }
  return {
    ...input.character,
    dnd5eCombatState: {
      ...(input.character.dnd5eCombatState ?? {}),
      spellAuthorityRecords: {
        ...(input.character.dnd5eCombatState?.spellAuthorityRecords ?? {}),
        [recordId]: record,
      },
    },
  }
}

export type Dnd5eWordOfRecallTeleportResult =
  | {
      ok: true
      maps: BattleMap[]
      destinationMapId: string
      movedTokenIds: string[]
    }
  | { ok: false; reason: 'source-map-missing' | 'destination-map-missing' | 'traveler-missing' }

export function settleDnd5eWordOfRecallTeleport(input: {
  maps: readonly BattleMap[]
  sourceMapId: string
  actorTokenId: string
  declaration: Extract<Dnd5eWordOfRecallDeclarationV1, { mode: 'recall' }>
  sanctuary: Dnd5eRecallSanctuaryAuthorityRecordV1
}): Dnd5eWordOfRecallTeleportResult {
  const source = input.maps.find((map) => map.id === input.sourceMapId)
  if (!source) return { ok: false, reason: 'source-map-missing' }
  const destination = input.maps.find((map) => map.id === input.sanctuary.destinationMapId)
  if (!destination) return { ok: false, reason: 'destination-map-missing' }
  const travelerIds = [input.actorTokenId, ...input.declaration.targets.map((target) => target.tokenId)]
  const travelers = travelerIds.map((tokenId) => source.tokens.find((token) => token.id === tokenId))
  if (travelers.some((token) => !token)) return { ok: false, reason: 'traveler-missing' }
  const movingTokens = travelers as Token[]
  const movingCharacterIds = new Set(movingTokens.flatMap((token) => token.characterId ? [token.characterId] : []))
  const movingTokenIds = new Set(travelerIds)
  const destinationBaseTokens = destination.tokens.filter((token) =>
    !movingTokenIds.has(token.id) && !(token.characterId && movingCharacterIds.has(token.characterId)))
  const placed: Token[] = []
  for (const token of movingTokens) {
    const placementMap: BattleMap = {
      ...destination,
      tokens: [...destinationBaseTokens, ...placed, token],
    }
    const position = resolveFreeDropCell(
      input.sanctuary.destinationX,
      input.sanctuary.destinationY,
      token.id,
      placementMap,
    )
    placed.push({
      ...token,
      ...position,
      elevationFeet: input.sanctuary.destinationElevationFeet,
      movementAnimation: undefined,
    })
  }
  const nextDestination: BattleMap = {
    ...destination,
    tokens: [...destinationBaseTokens, ...placed],
  }
  const sameMap = source.id === destination.id
  const nextSource: BattleMap = sameMap
    ? nextDestination
    : { ...source, tokens: source.tokens.filter((token) => !movingTokenIds.has(token.id)) }
  return {
    ok: true,
    destinationMapId: destination.id,
    movedTokenIds: travelerIds,
    maps: input.maps.map((map) => map.id === nextSource.id
      ? nextSource
      : map.id === nextDestination.id
        ? nextDestination
        : map),
  }
}
