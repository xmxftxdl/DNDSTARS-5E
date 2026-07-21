import { getDnd5eSrdMonster } from '../rulesets/dnd5e/monsters'
import type { BattleMap, Token } from '../store/maps'
import type { Character } from '../types/character'
import { getEnemyStatBlock } from './enemyStatBlocks'
import { getTokenCombatSide, isTokenDefeated } from './combatTokens'

export type CombatExperienceDistributionMode = 'even' | 'manual' | 'none'

export interface CombatExperienceDefeatedMonster {
  tokenId: string
  name: string
  monsterId?: string
  challengeRating?: string
  xp: number
}

export interface CombatExperienceParticipant {
  characterId: string
  name: string
  experienceBefore: number
}

export interface CombatExperienceDraft {
  combatId: string
  mapId: string
  defeatedMonsters: CombatExperienceDefeatedMonster[]
  participants: CombatExperienceParticipant[]
  totalXp: number
}

export interface CombatExperienceAward {
  characterId: string
  characterName: string
  xp: number
}

export interface CombatExperienceSettlement {
  combatId: string
  mapId: string
  mode: CombatExperienceDistributionMode
  totalXp: number
  awardedXp: number
  defeatedMonsters: CombatExperienceDefeatedMonster[]
  awards: CombatExperienceAward[]
  settledAt: number
}

/** SRD 5.1「Challenge Rating」表；仅供没有结构化 XP 的旧怪物模板回退。 */
export const DND5E_CHALLENGE_RATING_XP: Readonly<Record<string, number>> = {
  '0': 10,
  '1/8': 25,
  '1/4': 50,
  '1/2': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1_100,
  '5': 1_800,
  '6': 2_300,
  '7': 2_900,
  '8': 3_900,
  '9': 5_000,
  '10': 5_900,
  '11': 7_200,
  '12': 8_400,
  '13': 10_000,
  '14': 11_500,
  '15': 13_000,
  '16': 15_000,
  '17': 18_000,
  '18': 20_000,
  '19': 22_000,
  '20': 25_000,
  '21': 33_000,
  '22': 41_000,
  '23': 50_000,
  '24': 62_000,
  '25': 75_000,
  '26': 90_000,
  '27': 105_000,
  '28': 120_000,
  '29': 135_000,
  '30': 155_000,
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0
}

function defeatedMonster(token: Token): CombatExperienceDefeatedMonster {
  const srd = token.poolId ? getDnd5eSrdMonster(token.poolId) : undefined
  const legacy = !srd && token.poolId ? getEnemyStatBlock(token.poolId) : undefined
  const challengeRating = srd?.challenge.rating ?? legacy?.cr
  const xp = srd?.challenge.xp ?? (challengeRating ? DND5E_CHALLENGE_RATING_XP[challengeRating] : 0) ?? 0
  return {
    tokenId: token.id,
    name: token.label || srd?.name || token.poolId || '未命名敌人',
    ...(token.poolId ? { monsterId: token.poolId } : {}),
    ...(challengeRating ? { challengeRating } : {}),
    xp: nonNegativeInteger(xp),
  }
}

export function createCombatExperienceDraft(input: {
  combatId: string
  map: BattleMap
  characters: readonly Character[]
  initiativeTokenIds: readonly string[]
}): CombatExperienceDraft {
  const charactersById = new Map(input.characters.map((character) => [character.id, character]))
  const tokensById = new Map(input.map.tokens.map((token) => [token.id, token]))
  const defeatedMonsters = input.map.tokens
    .filter((token) =>
      getTokenCombatSide(token) === 'enemy' &&
      !token.dnd5eSummon &&
      isTokenDefeated(token, input.characters as Character[]),
    )
    .map(defeatedMonster)
  const participantIds = new Set<string>()
  const participants: CombatExperienceParticipant[] = []
  for (const tokenId of input.initiativeTokenIds) {
    const token = tokensById.get(tokenId)
    if (
      !token ||
      getTokenCombatSide(token) !== 'ally' ||
      !token.characterId ||
      participantIds.has(token.characterId)
    ) continue
    const character = charactersById.get(token.characterId)
    if (!character) continue
    participantIds.add(character.id)
    participants.push({
      characterId: character.id,
      name: character.name,
      experienceBefore: nonNegativeInteger(character.experience),
    })
  }
  return {
    combatId: input.combatId,
    mapId: input.map.id,
    defeatedMonsters,
    participants,
    totalXp: defeatedMonsters.reduce((total, monster) => total + monster.xp, 0),
  }
}

/** 保留全部整数 XP；不能整除的余数按先攻参与者顺序逐点分配。 */
export function evenCombatExperienceAwards(draft: CombatExperienceDraft): CombatExperienceAward[] {
  if (draft.participants.length === 0) return []
  const base = Math.floor(draft.totalXp / draft.participants.length)
  let remainder = draft.totalXp % draft.participants.length
  return draft.participants.map((participant) => ({
    characterId: participant.characterId,
    characterName: participant.name,
    xp: base + (remainder-- > 0 ? 1 : 0),
  }))
}

export function validateCombatExperienceAwards(
  draft: CombatExperienceDraft,
  awards: readonly CombatExperienceAward[],
): boolean {
  if (awards.length !== draft.participants.length) return false
  const participantIds = new Set(draft.participants.map((participant) => participant.characterId))
  const awardedIds = new Set<string>()
  let total = 0
  for (const award of awards) {
    if (
      !participantIds.has(award.characterId) ||
      awardedIds.has(award.characterId) ||
      !Number.isSafeInteger(award.xp) ||
      award.xp < 0
    ) return false
    awardedIds.add(award.characterId)
    total += award.xp
    if (!Number.isSafeInteger(total)) return false
  }
  return total === draft.totalXp
}

export function createCombatExperienceSettlement(input: {
  draft: CombatExperienceDraft
  mode: CombatExperienceDistributionMode
  awards?: readonly CombatExperienceAward[]
  settledAt?: number
}): CombatExperienceSettlement | undefined {
  const awards = input.mode === 'none' ? [] : [...input.awards ?? []]
  if (input.mode !== 'none' && !validateCombatExperienceAwards(input.draft, awards)) return undefined
  return {
    combatId: input.draft.combatId,
    mapId: input.draft.mapId,
    mode: input.mode,
    totalXp: input.draft.totalXp,
    awardedXp: awards.reduce((total, award) => total + award.xp, 0),
    defeatedMonsters: input.draft.defeatedMonsters.map((monster) => ({ ...monster })),
    awards: awards.map((award) => ({ ...award })),
    settledAt: input.settledAt ?? Date.now(),
  }
}
