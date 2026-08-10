import type { Token } from '../../store/maps'
import { creatureSizeToTokenSize } from '../../lib/monsterTypes'
import type { Dnd5eMonsterStatBlock } from './monsters'

export type Dnd5eMonsterOverrideScope = 'instance' | 'same-template'

const OVERRIDE_PREFIX = 'room-monster:dm-override:'

function safeOverrideKey(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return (normalized || 'monster').slice(0, 80)
}

export function isDnd5eMonsterInstanceOverride(monsterId: string | undefined): boolean {
  return monsterId?.startsWith(OVERRIDE_PREFIX) === true
}

export function createDnd5eMonsterInstanceOverride(input: {
  monster: Dnd5eMonsterStatBlock
  tokenId: string
  scope: Dnd5eMonsterOverrideScope
}): Dnd5eMonsterStatBlock {
  if (isDnd5eMonsterInstanceOverride(input.monster.id)) return structuredClone(input.monster)
  const identity = input.scope === 'instance'
    ? `token-${input.tokenId}`
    : `template-${input.monster.id}-anchor-${input.tokenId}`
  const key = safeOverrideKey(identity)
  return {
    ...structuredClone(input.monster),
    id: `${OVERRIDE_PREFIX}${key}`,
    slug: `dm-override-${key}`,
    source: 'DM 自定义',
  }
}

export function dnd5eMonsterOverrideTargets(input: {
  tokens: readonly Token[]
  selectedTokenId: string
  sourceMonsterId: string
  scope: Dnd5eMonsterOverrideScope
}): Token[] {
  if (input.scope === 'instance') {
    const selected = input.tokens.find((token) => token.id === input.selectedTokenId)
    return selected ? [selected] : []
  }
  return input.tokens.filter((token) =>
    token.type === 'enemy' && token.poolId === input.sourceMonsterId)
}

export interface Dnd5eMonsterOverrideTokenPatch {
  poolId: string
  hp: number
  maxHp: number
  creatureSize: Dnd5eMonsterStatBlock['size']
  size: number
}

export function dnd5eMonsterOverrideTokenPatch(input: {
  monster: Dnd5eMonsterStatBlock
  currentHp: number
}): Dnd5eMonsterOverrideTokenPatch {
  const maxHp = input.monster.hitPoints.average
  return {
    poolId: input.monster.id,
    hp: Math.max(0, Math.min(Math.floor(input.currentHp), maxHp)),
    maxHp,
    creatureSize: input.monster.size,
    size: creatureSizeToTokenSize(input.monster.size),
  }
}
