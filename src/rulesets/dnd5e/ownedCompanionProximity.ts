import type { BattleMap, Token } from '../../store/maps'
import { mapGeometryRuntimeForMap, type MapGeometryState } from '../../lib/mapGeometry'
import { dnd5eMapTokenDistanceFeet } from './verticalCombatGeometry'

export interface Dnd5eOwnedCompanionProximity {
  maximumDistanceFeet: number
  bondKey?: string
  source?: { packageId: string; activityId: string }
}

const id = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(value)

export function validDnd5eOwnedCompanionProximity(value: unknown): value is Dnd5eOwnedCompanionProximity {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const query = value as Dnd5eOwnedCompanionProximity
  return Object.keys(query).every(key => ['maximumDistanceFeet', 'bondKey', 'source'].includes(key)) &&
    Number.isFinite(query.maximumDistanceFeet) && query.maximumDistanceFeet >= 0 && query.maximumDistanceFeet <= 5280 &&
    (query.bondKey === undefined || id(query.bondKey)) &&
    (query.source === undefined || (!!query.source && !Array.isArray(query.source) &&
      Object.keys(query.source).every(key => ['packageId', 'activityId'].includes(key)) &&
      id(query.source.packageId) && id(query.source.activityId))) &&
    (query.bondKey !== undefined || query.source !== undefined)
}

export function normalizeDnd5eOwnedCompanionProximityRules(value: unknown): Dnd5eOwnedCompanionProximity[] | undefined {
  if (!Array.isArray(value) || value.length < 1 || value.length > 32 || !value.every(validDnd5eOwnedCompanionProximity)) return undefined
  return value.map(query => ({ ...query, ...(query.source ? { source: { ...query.source } } : {}) }))
}

export type Dnd5eOwnedCompanionMapContext = Omit<Parameters<typeof dnd5eNearbyOwnedCompanions>[0], 'query'>

/** Read current map inhabitants, including companions without initiative slots.
 * The query is rules data, never a remembered yes/no capability on the character.
 */
export function dnd5eNearbyOwnedCompanions(input: {
  map: BattleMap
  ownerTokenId: string
  query: Dnd5eOwnedCompanionProximity
  round: number
  worldMinute?: number
  geometry?: MapGeometryState | null
}): readonly Token[] {
  if (!validDnd5eOwnedCompanionProximity(input.query) || !Number.isInteger(input.round) || input.round < 0) return []
  const owner = input.map.tokens.find(token => token.id === input.ownerTokenId)
  if (!owner) return []
  const geometry = input.geometry === undefined ? mapGeometryRuntimeForMap(input.map.id) : input.geometry ?? undefined
  return input.map.tokens.filter(token => {
    const summon = token.dnd5eSummon
    if (!summon || token.id === owner.id || summon.sourceTokenId !== owner.id ||
      (owner.characterId != null && summon.sourceCharacterId !== owner.characterId) || summon.dismissed || summon.controlEnded ||
      !['player', 'enemy', 'npc'].includes(token.type) || token.dnd5eSpellEffect ||
      !Number.isFinite(token.hp) || token.hp! <= 0) return false
    if (!summon.persistent && (!Number.isFinite(summon.expiresAfterRound) || input.round > summon.expiresAfterRound)) return false
    for (const deadline of [summon.dismissAtWorldMinute, summon.controlExpiresAtWorldMinute]) {
      if (deadline !== undefined && (!Number.isFinite(input.worldMinute) || !Number.isFinite(deadline) || input.worldMinute! >= deadline)) return false
    }
    if (input.query.bondKey !== undefined && summon.bondKey !== input.query.bondKey) return false
    if (input.query.source && (summon.pluginId !== input.query.source.packageId || summon.featureId !== input.query.source.activityId)) return false
    const distance = dnd5eMapTokenDistanceFeet({ map: input.map, geometry, left: owner, right: token })
    return Number.isFinite(distance) && distance <= input.query.maximumDistanceFeet
  })
}

/** Reject a context belonging to the healer or to another body of the recipient. */
export function dnd5eCompanionContextForCharacter(
  characterId: string | undefined,
  context: Dnd5eOwnedCompanionMapContext | undefined,
): Dnd5eOwnedCompanionMapContext | undefined {
  return characterId && context?.map.tokens.some(token =>
    token.id === context.ownerTokenId && token.characterId === characterId)
    ? context : undefined
}
