import type { InitiativeEntry } from '../components/map/InitiativeTracker'
import type { DeleteSelectionRect } from '../components/map/MapCanvas'
import { dnd5eAbilityCheckMode, resolveDnd5eInitiative } from '../rulesets/dnd5e/checks'
import { dnd5eThiefReflexesInitiative } from '../rulesets/dnd5e/classes'
import type { Token } from '../store/maps'
import type { Character } from '../types/character'
import type { RoomSession } from '../lib/roomSession'

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

export function rollInitiative(_token: Token, character?: Character): number {
  if (character) {
    const mode = dnd5eAbilityCheckMode(character, { initiative: true })
    const rollCount = mode === 'normal' ? 1 : 2
    const rolls = Array.from({ length: rollCount }, () => 1 + Math.floor(Math.random() * 20))
    return resolveDnd5eInitiative({ character, rolls }).roll.total
  }
  const d20 = 1 + Math.floor(Math.random() * 20)
  return d20 + Math.floor(Math.random() * 5)
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
  return tokens
    .filter((token) => token.type !== 'obstacle')
    .map((token) => {
      const ch = token.characterId ? characters.find((c) => c.id === token.characterId) : undefined
      const roll = rollInitiative(token, ch)
      const normal: InitiativeEntry = {
        slotId: `${token.id}:normal`,
        tokenId: token.id,
        label: token.label,
        emoji: token.emoji,
        color: token.color,
        accent: ch?.accent,
        roll,
      }
      const surprised = ch?.conditions.some((condition) =>
        ['surprised', '受突袭', '惊讶'].includes(condition.trim().toLowerCase()),
      ) === true
      const reflexesInitiative = ch ? dnd5eThiefReflexesInitiative(ch, roll, surprised) : undefined
      return reflexesInitiative == null
        ? [normal]
        : [normal, {
            ...normal,
            slotId: `${token.id}:thief-reflexes`,
            turnKind: 'thief-reflexes' as const,
            roll: reflexesInitiative,
          }]
    })
    .flat()
    .sort((a, b) => b.roll - a.roll)
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
