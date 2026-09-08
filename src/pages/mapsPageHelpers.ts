import type { InitiativeEntry } from '../components/map/InitiativeTracker'
import type { DeleteSelectionRect } from '../components/map/MapCanvas'
import { dnd5eAbilityCheckMode, resolveDnd5eInitiative } from '../rulesets/dnd5e/checks'
import { dnd5eThiefReflexesInitiative } from '../rulesets/dnd5e/classes'
import { abilityMod } from '../lib/dnd'
import { getEnemyStatBlock } from '../lib/enemyStatBlocks'
import type { Token } from '../store/maps'
import type { Character } from '../types/character'
import type { RoomSession } from '../lib/roomSession'
import { resolveInitiativePortrait } from '../lib/portraitPresentation'
import { migrateCharacterToDnd5e } from '../rulesets/dnd5e/character'
import { dnd5eActiveCannotBeSurprisedWhileConscious } from '../rulesets/dnd5e/activeEffects'

export function placeableRoomCharacters(
  characters: readonly Character[],
  session: RoomSession | null,
  roomPlayerMemberIds?: ReadonlySet<string>,
): Character[] {
  if (!session) return [...characters]
  const inRoom = characters.filter((character) => character.roomId === session.roomId)
  if (session.role === 'player') {
    return inRoom.filter((character) => character.roomMemberId === session.memberId)
  }
  if (!roomPlayerMemberIds) return inRoom
  return inRoom.filter((character) =>
    !!character.roomMemberId && roomPlayerMemberIds.has(character.roomMemberId))
}

export function rollInitiative(token: Token, character?: Character): number {
  return resolveInitiativeCalculation(token, character).total
}

export function dnd5eTokenCannotBeMarkedSurprised(
  token: Token,
  characters: readonly Character[],
): boolean {
  const character = token.characterId
    ? characters.find((candidate) => candidate.id === token.characterId)
    : undefined
  if (character) {
    const snapshot = migrateCharacterToDnd5e(character)
    const protectedWhileConscious = snapshot.cannotBeSurprisedWhileConscious ||
      dnd5eActiveCannotBeSurprisedWhileConscious(snapshot.classState.activeEffects)
    return protectedWhileConscious && snapshot.currentHp > 0 &&
      !snapshot.deathSaves.dead && !snapshot.conditions.includes('unconscious')
  }
  const state = token.dnd5eCombatState
  return dnd5eActiveCannotBeSurprisedWhileConscious(state?.activeEffects) &&
    (token.hp ?? token.maxHp ?? 1) > 0 && !(state?.conditions ?? []).includes('unconscious')
}

export function eligibleDnd5eSurprisedTokenIds(
  tokens: readonly Token[],
  characters: readonly Character[],
  requestedTokenIds: readonly string[],
): string[] {
  const requested = new Set(requestedTokenIds)
  return tokens.filter((token) =>
    requested.has(token.id) &&
    (token.type === 'player' || token.type === 'enemy') &&
    !dnd5eTokenCannotBeMarkedSurprised(token, characters),
  ).map((token) => token.id)
}

const DND5E_SHARED_INITIATIVE_SUMMON_FEATURE_IDS = new Set([
  'spell:conjure-animals',
  'spell:conjure-minor-elementals',
  'spell:conjure-woodland-beings',
])

function dnd5eSharedSummonInitiativeGroupKey(token: Token): string | undefined {
  const summon = token.dnd5eSummon
  if (!summon || !DND5E_SHARED_INITIATIVE_SUMMON_FEATURE_IDS.has(summon.featureId)) return undefined
  return JSON.stringify([
    summon.pluginId,
    summon.featureId,
    summon.sourceCharacterId,
    summon.sourceTokenId,
    summon.concentrationId ?? `round:${summon.createdRound}`,
  ])
}

function resolveInitiativeCalculation(token: Token, character?: Character, sharedMonsterD20?: number): {
  total: number
  calculation: NonNullable<InitiativeEntry['initiativeCalculation']>
} {
  if (character) {
    // Initiative is a Dexterity ability check.  Pass the ability through while
    // deciding how many d20s to generate so effects such as Foresight do not
    // ask the resolver to apply advantage to a single die.
    const mode = dnd5eAbilityCheckMode(character, { initiative: true, ability: 'dex' })
    const rollCount = mode === 'normal' ? 1 : 2
    const rolls = Array.from({ length: rollCount }, () => 1 + Math.floor(Math.random() * 20))
    const resolved = resolveDnd5eInitiative({ character, rolls }).roll
    return {
      total: resolved.total,
      calculation: {
        rolls,
        d20: resolved.d20,
        modifier: resolved.modifier,
        mode: resolved.mode,
      },
    }
  }
  const d20 = sharedMonsterD20 ?? 1 + Math.floor(Math.random() * 20)
  const monster = token.poolId ? getEnemyStatBlock(token.poolId) : undefined
  const modifier = abilityMod(monster?.abilities.dex ?? 10)
  return {
    total: d20 + modifier,
    calculation: { rolls: [d20], d20, modifier, mode: 'normal' },
  }
}

/**
 * Shared combat logs survive hot reloads and can therefore still contain text
 * written by the retired AP route. Preserve the useful action description while
 * removing AP expenditure/balance claims that are not part of D&D 5e.
 */
export function migrateLegacyApCombatLogText(text: string): string {
  return text
    .replace(/(?:花费|消耗)\s*\d+\s*(?:点\s*)?AP\s*(?:[：:]\s*)?/giu, '')
    .replace(/(?:未|不|无需)消耗\s*AP\s*(?:[：:]\s*)?/giu, '')
    .replace(/\s*[；;,，]?\s*(?:本回合)?剩余\s*AP\s*\d+\s*\/\s*\d+/giu, '')
    .replace(/\s*[；;,，]?\s*AP\s*\d+\s*\/\s*\d+/giu, '')
    .replace(/AP\s*回满为\s*\d+\s*\/\s*\d+/giu, '')
    .replace(/保留\s*AP\s*(?:[：:]\s*)?/giu, '')
    .replace(/AP\s*不足/giu, '行动资源不足')
    // 清理未知旧格式中残留的 AP 字样。
    .replace(/\bAP\b/giu, '')
    .replace(/\s+([，。；：,.;:])/gu, '$1')
    .replace(/([，,]){2,}/gu, '$1')
    .replace(/\s{2,}/gu, ' ')
    .trim()
}

export function buildInitiativeOrder(tokens: Token[], characters: Character[]): InitiativeEntry[] {
  const combatTokens = tokens.filter((token) => token.type !== 'obstacle')
  const sharedSummonD20ByGroup = new Map<string, number>()
  const sharedSummonD20 = (token: Token): number | undefined => {
    const groupKey = dnd5eSharedSummonInitiativeGroupKey(token)
    if (!groupKey) return undefined
    const existing = sharedSummonD20ByGroup.get(groupKey)
    if (existing != null) return existing
    const d20 = 1 + Math.floor(Math.random() * 20)
    sharedSummonD20ByGroup.set(groupKey, d20)
    return d20
  }
  const ordinaryEntries = combatTokens
    .filter((token) => !token.dnd5eSimulacrum)
    .map((token) => {
      const ch = token.characterId ? characters.find((c) => c.id === token.characterId) : undefined
      const initiative = resolveInitiativeCalculation(token, ch, ch ? undefined : sharedSummonD20(token))
      const roll = initiative.total
      const normal: InitiativeEntry = {
        slotId: `${token.id}:normal`,
        tokenId: token.id,
        label: ch?.name || token.label,
        emoji: ch?.avatar || token.emoji,
        portrait: resolveInitiativePortrait(ch, token),
        portraitImageId: token.portraitImageId,
        color: token.color,
        accent: ch?.accent,
        roll,
        initiativeCalculation: initiative.calculation,
      }
      const surprised = ch?.dnd5eCombatState?.surprisedCombatId != null &&
        ch.dnd5eCombatState.surpriseResolvedCombatId !== ch.dnd5eCombatState.surprisedCombatId
      const reflexesInitiative = ch ? dnd5eThiefReflexesInitiative(ch, roll, surprised) : undefined
      return reflexesInitiative == null
        ? [normal]
        : [normal, {
            ...normal,
            slotId: `${token.id}:thief-reflexes`,
            firstRoundOnly: true,
            turnKind: 'thief-reflexes' as const,
            roll: reflexesInitiative,
          }]
    })
    .flat()
  const ordinaryByTokenId = new Map(ordinaryEntries
    .filter((entry) => entry.turnKind !== 'thief-reflexes')
    .map((entry) => [entry.tokenId, entry]))
  const simulacrumEntries = combatTokens.flatMap((token): InitiativeEntry[] => {
    const simulacrum = token.dnd5eSimulacrum
    if (!simulacrum) return []
    const source = ordinaryByTokenId.get(simulacrum.sourceTokenId)
    if (!source) return []
    const ch = token.characterId ? characters.find((candidate) => candidate.id === token.characterId) : undefined
    return [{
      slotId: `${token.id}:source-companion`,
      tokenId: token.id,
      label: token.label,
      emoji: ch?.avatar || token.emoji,
      portrait: resolveInitiativePortrait(ch, token),
      portraitImageId: token.portraitImageId,
      color: token.color,
      accent: ch?.accent,
      roll: source.roll,
      turnKind: 'source-companion',
    }]
  })
  return [...ordinaryEntries, ...simulacrumEntries]
    .sort((a, b) => b.roll - a.roll)
}

export function initiativeResultLogDetails(order: readonly InitiativeEntry[]): string[] {
  return order.map((entry, index) => {
    const calculation = entry.initiativeCalculation
    if (!calculation) {
      return `${index + 1}. ${entry.label}：先攻 ${entry.roll}${
        entry.turnKind === 'thief-reflexes'
          ? '（盗贼反射·首轮额外回合）'
          : entry.turnKind === 'source-companion'
            ? '（与施法者同轮行动）'
            : ''
      }`
    }
    const modifier = calculation.modifier >= 0
      ? `+${calculation.modifier}`
      : String(calculation.modifier)
    const d20 = calculation.mode === 'normal'
      ? `d20 ${calculation.d20}`
      : `d20（${calculation.rolls.join('、')}，${
        calculation.mode === 'advantage' ? '优势取高' : '劣势取低'
      } ${calculation.d20}）`
    const base = `${d20} + 先攻调整值（${modifier}）`
    return entry.turnKind === 'thief-reflexes'
      ? `${index + 1}. ${entry.label}：${base} - 盗贼反射 10 = ${entry.roll}（首轮额外回合）`
      : `${index + 1}. ${entry.label}：${base} = ${entry.roll}`
  })
}

export function abilityCheckRollLogDetail(input: {
  rolls: readonly number[]
  selectedD20: number
  mode: 'normal' | 'advantage' | 'disadvantage'
  modifier: number
  total: number
}): string {
  const modifier = input.modifier >= 0 ? `+${input.modifier}` : String(input.modifier)
  const d20 = input.mode === 'normal'
    ? `d20 ${input.selectedD20}`
    : `d20（${input.rolls.join('、')}，${
        input.mode === 'advantage' ? '优势取高' : '劣势取低'
      } ${input.selectedD20}）`
  return `${d20} + 调整值（${modifier}） = ${input.total}`
}

export function initiativeJoinLogMessage(
  entries: readonly InitiativeEntry[],
  sharedInitiative = false,
): string {
  const sourceCompanionCount = entries.filter((entry) => entry.turnKind === 'source-companion').length
  const independentlyRolledCount = entries.length - sourceCompanionCount
  if (sourceCompanionCount > 0 && independentlyRolledCount === 0) {
    return `拟像已加入施法者的先攻轮次（${sourceCompanionCount} 名）；不独立掷先攻。`
  }
  if (sourceCompanionCount > 0) {
    return `新生物已加入战斗（拟像沿用施法者先攻 ${sourceCompanionCount} 名；独立掷先攻 ${independentlyRolledCount} 名）。`
  }
  if (sharedInitiative && entries.length > 0) {
    return `召唤生物已共用一次先攻掷骰并加入同一先攻轮次（${entries.length} 名）。`
  }
  return `召唤生物已分别重掷先攻并加入战斗（${entries.length} 名）。`
}

export function initiativeOrderForRound(
  order: readonly InitiativeEntry[],
  round: number,
): InitiativeEntry[] {
  return round <= 1
    ? [...order]
    : order.filter((entry) => entry.firstRoundOnly !== true)
}

/**
 * Projects Host-owned initiative slots (including Activity one-shot turns)
 * back into the shared map tracker. The Headless engine stores only actor and
 * slot ids, so presentation fields are copied from that actor's ordinary
 * tracker entry without inventing another initiative roll.
 */
export function projectHeadlessInitiativeOrder(input: {
  current: readonly InitiativeEntry[]
  state: {
    round: number
    initiativeOrder: readonly string[]
    initiativeSlotIds?: readonly string[]
    oneShotInitiativeSlotIds?: readonly string[]
  }
}): InitiativeEntry[] {
  const slotIds = input.state.initiativeSlotIds
  if (!slotIds || slotIds.length !== input.state.initiativeOrder.length) {
    return initiativeOrderForRound(input.current, input.state.round)
  }
  const bySlotId = new Map(input.current.map((entry) => [
    entry.slotId ?? entry.tokenId,
    entry,
  ]))
  const templateByTokenId = new Map<string, InitiativeEntry>()
  for (const entry of input.current) {
    if (!templateByTokenId.has(entry.tokenId) || !entry.turnKind) {
      templateByTokenId.set(entry.tokenId, entry)
    }
  }
  return slotIds.flatMap((slotId, index) => {
    const tokenId = input.state.initiativeOrder[index]
    const existing = bySlotId.get(slotId)
    if (existing) return [{ ...existing, slotId }]
    const template = templateByTokenId.get(tokenId)
    if (!template) return []
    return [{
      ...template,
      slotId,
      firstRoundOnly: undefined,
      turnKind: input.state.oneShotInitiativeSlotIds?.includes(slotId)
        ? 'activity-extra-turn'
        : undefined,
    }]
  })
}

export function insertInitiativeEntriesPreservingActive(
  order: readonly InitiativeEntry[],
  activeIndex: number,
  additions: readonly InitiativeEntry[],
): { order: InitiativeEntry[]; index: number } {
  if (additions.length === 0) return { order: [...order], index: activeIndex }
  const activeSlotId = order[activeIndex]?.slotId ?? order[activeIndex]?.tokenId
  const additionIds = new Set(additions.map((entry) => entry.slotId ?? entry.tokenId))
  const next = [
    ...order.filter((entry) => !additionIds.has(entry.slotId ?? entry.tokenId)),
    ...additions,
  ].sort((left, right) => right.roll - left.roll)
  const index = activeSlotId == null
    ? Math.min(Math.max(0, activeIndex), Math.max(0, next.length - 1))
    : Math.max(0, next.findIndex((entry) => (entry.slotId ?? entry.tokenId) === activeSlotId))
  return { order: next, index }
}

export function insertMapTokensIntoInitiativePreservingActive(input: {
  order: readonly InitiativeEntry[]
  activeIndex: number
  tokens: readonly Token[]
  characters: readonly Character[]
  round: number
}): { order: InitiativeEntry[]; index: number; additions: InitiativeEntry[] } {
  const existingTokenIds = new Set(input.order.map((entry) => entry.tokenId))
  const freshCombatTokens = input.tokens.filter((token) =>
    (token.type === 'player' || token.type === 'enemy') &&
    !existingTokenIds.has(token.id)
  )
  const additions = initiativeOrderForRound(
    buildInitiativeOrder([...freshCombatTokens], [...input.characters]),
    input.round,
  )
  return {
    ...insertInitiativeEntriesPreservingActive(input.order, input.activeIndex, additions),
    additions,
  }
}

export function tokenIntersectsDeleteRect(token: Token, rect: DeleteSelectionRect, gridSize: number): boolean {
  const tokenSize = Math.max(1, token.size || 1) * gridSize
  const half = tokenSize / 2
  const left = token.x - half
  const right = token.x + half
  const top = token.y - half
  const bottom = token.y + half
  return right >= rect.x && left <= rect.x + rect.width && bottom >= rect.y && top <= rect.y + rect.height
}

function hashDiceSeed(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function seededDieValue(seed: string, sides: number): number {
  let state = hashDiceSeed(seed) || 1
  state = (state + 0x6d2b79f5) | 0
  let next = Math.imul(state ^ (state >>> 15), 1 | state)
  next ^= next + Math.imul(next ^ (next >>> 7), 61 | next)
  const unit = ((next ^ (next >>> 14)) >>> 0) / 4294967296
  return 1 + Math.floor(unit * Math.max(2, Math.round(sides)))
}
