// [T15/G3] MapsPage 纯 helper 抽取。从 MapsPage.tsx 原样搬出——不改名、不改逻辑。
// 这些是 god-object 中无闭包依赖的模块级纯函数，搬到独立边界后 MapsPage 直接 import 回去。
import type { InitiativeEntry } from '../components/map/InitiativeTracker'
import type { DeleteSelectionRect } from '../components/map/MapCanvas'
import { getEffectiveAbilityMod } from '../lib/archerCombat'
import { singleTargetRangeFeet } from '../lib/skillRangeRegistry'
import type { Token } from '../store/maps'
import type { Character, CombatSkill } from '../types/character'
import type { StatusType } from '../lib/sharedCombatTypes'

export { singleTargetRangeFeet }

export function statusDuration(skill: CombatSkill, type: StatusType): number | undefined {
  if (skill.statusOnHit === type) return skill.statusDuration ?? (type === 'burning' ? 3 : 4)
  if (type === 'burning' && skill.name === '火球术') return skill.statusDuration ?? 3
  if (type === 'poison' && skill.name === '毒云术') return skill.statusDuration ?? 4
  return undefined
}

export function rollInitiative(_token: Token, character?: Character): number {
  const d20 = 1 + Math.floor(Math.random() * 20)
  if (character) {
    return d20 + getEffectiveAbilityMod(character, 'dex') + character.initiativeBonus
  }
  return d20 + Math.floor(Math.random() * 5)
}

export function buildInitiativeOrder(tokens: Token[], characters: Character[]): InitiativeEntry[] {
  return tokens
    .filter((token) => token.type !== 'obstacle')
    .map((token) => {
      const ch = token.characterId ? characters.find((c) => c.id === token.characterId) : undefined
      return {
        tokenId: token.id,
        label: token.label,
        emoji: token.emoji,
        color: token.color,
        accent: ch?.accent,
        roll: rollInitiative(token, ch),
      }
    })
    .sort((a, b) => b.roll - a.roll)
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

// [T15/G3] 骰子种子 RNG。纯函数对，从 MapsPage 组件内闭包原样搬出（无 state/ref 捕获）。
// hashDiceSeed 仅供 seededDieValue 内部使用；后者用于 d20 超时兜底面值与 fly 索引派生。
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
