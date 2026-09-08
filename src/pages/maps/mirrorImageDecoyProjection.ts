import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'

export interface MirrorImageDecoyProjectionResult {
  map: BattleMap
  createdTokenIds: string[]
  removedTokenIds: string[]
  changed: boolean
  signature: string
}

export function isMirrorImageDecoyToken(token: Token): boolean {
  return token.dnd5eSpellEffect?.spellId === 'mirror-image' &&
    token.dnd5eSpellEffect.projectionKind === 'attack-decoy'
}

function stableProjectionHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

export function mirrorImageDecoyTokenId(
  sourceTokenId: string,
  sourceEffectId: string,
  projectionIndex: number,
): string {
  return `mirror-image:${stableProjectionHash(sourceTokenId)}:${stableProjectionHash(sourceEffectId)}:${projectionIndex}`
}

function sourceActiveEffects(token: Token, characters: readonly Character[]) {
  if (!token.characterId) return token.dnd5eCombatState?.activeEffects ?? []
  return characters.find((character) => character.id === token.characterId)
    ?.dnd5eCombatState?.activeEffects ?? []
}

function initialDecoyPosition(
  source: Token,
  projectionIndex: number,
  map: BattleMap,
): { x: number; y: number } {
  const angle = [-Math.PI / 2, Math.PI / 6, (Math.PI * 5) / 6][(projectionIndex - 1) % 3] ?? 0
  const ring = Math.max(map.gridSize * 0.62, map.gridSize * source.size * 0.55)
  const halfSize = Math.max(map.gridSize * source.size * 0.5, map.gridSize * 0.5)
  return {
    x: Math.min(map.width - halfSize, Math.max(halfSize, source.x + Math.cos(angle) * ring)),
    y: Math.min(map.height - halfSize, Math.max(halfSize, source.y + Math.sin(angle) * ring)),
  }
}

function desiredMirrorImageDecoys(input: {
  map: BattleMap
  characters: readonly Character[]
  round: number
}): Token[] {
  const desired: Token[] = []
  for (const source of input.map.tokens) {
    if (isMirrorImageDecoyToken(source)) continue
    const effect = sourceActiveEffects(source, input.characters).find((candidate) =>
      (candidate.source.rulesId === 'mirror-image' || candidate.definitionId.includes('mirror-image')) &&
      (candidate.modifiers?.attackDecoys?.remaining ?? 0) > 0)
    const remaining = Math.min(20, Math.max(0, effect?.modifiers?.attackDecoys?.remaining ?? 0))
    if (!effect || remaining < 1) continue
    for (let projectionIndex = 1; projectionIndex <= remaining; projectionIndex += 1) {
      const position = initialDecoyPosition(source, projectionIndex, input.map)
      desired.push({
        id: mirrorImageDecoyTokenId(source.id, effect.id, projectionIndex),
        label: `镜影分身 ${projectionIndex}`,
        x: position.x,
        y: position.y,
        color: source.color,
        emoji: source.emoji,
        portrait: source.portrait,
        tokenPortrait: source.tokenPortrait,
        portraitImageId: source.portraitImageId,
        tokenPortraitImageId: source.tokenPortraitImageId,
        size: source.size,
        type: 'obstacle',
        obstacleKind: 'marker',
        elevationFeet: source.elevationFeet,
        visibilityMode: source.visibilityMode,
        showHpOnToken: false,
        showDetailOnToken: false,
        dnd5eSpellEffect: {
          schemaVersion: 1,
          spellId: 'mirror-image',
          sourceCharacterId: source.characterId ?? source.id,
          sourceTokenId: source.id,
          sourceEffectId: effect.id,
          projectionKind: 'attack-decoy',
          projectionIndex,
          createdRound: input.round,
          expiresAfterRound: input.round + 10,
        },
      })
    }
  }
  return desired
}

function syncExistingDecoy(existing: Token, desired: Token): Token {
  const desiredEffect = desired.dnd5eSpellEffect!
  const existingEffect = existing.dnd5eSpellEffect
  const candidate: Token = {
    ...existing,
    label: desired.label,
    color: desired.color,
    emoji: desired.emoji,
    portrait: desired.portrait,
    tokenPortrait: desired.tokenPortrait,
    portraitImageId: desired.portraitImageId,
    tokenPortraitImageId: desired.tokenPortraitImageId,
    size: desired.size,
    type: 'obstacle',
    obstacleKind: 'marker',
    visibilityMode: desired.visibilityMode,
    showHpOnToken: false,
    showDetailOnToken: false,
    dnd5eSpellEffect: {
      ...desiredEffect,
      createdRound: existingEffect?.createdRound ?? desiredEffect.createdRound,
      expiresAfterRound: existingEffect?.expiresAfterRound ?? desiredEffect.expiresAfterRound,
    },
  }
  return JSON.stringify(candidate) === JSON.stringify(existing) ? existing : candidate
}

/**
 * Projects the authoritative Mirror Image pool into movable, non-creature map
 * Tokens. Existing coordinates are deliberately retained: DM placement is
 * independent and source movement never drags these projections along.
 */
export function reconcileMirrorImageDecoyProjections(input: {
  map: BattleMap
  characters: readonly Character[]
  round: number
}): MirrorImageDecoyProjectionResult {
  const desired = desiredMirrorImageDecoys(input)
  const desiredById = new Map(desired.map((token) => [token.id, token]))
  const createdTokenIds: string[] = []
  const removedTokenIds: string[] = []
  let changed = false
  const tokens: Token[] = []

  for (const token of input.map.tokens) {
    if (!isMirrorImageDecoyToken(token)) {
      tokens.push(token)
      continue
    }
    const desiredToken = desiredById.get(token.id)
    if (!desiredToken) {
      removedTokenIds.push(token.id)
      changed = true
      continue
    }
    desiredById.delete(token.id)
    const synced = syncExistingDecoy(token, desiredToken)
    if (synced !== token) changed = true
    tokens.push(synced)
  }

  for (const token of desiredById.values()) {
    tokens.push(token)
    createdTokenIds.push(token.id)
    changed = true
  }

  const signature = desired.map((token) => [
    token.dnd5eSpellEffect?.sourceTokenId,
    token.dnd5eSpellEffect?.sourceEffectId,
    token.dnd5eSpellEffect?.projectionIndex,
  ].join(':')).sort().join('|')
  return {
    map: changed ? { ...input.map, tokens } : input.map,
    createdTokenIds,
    removedTokenIds,
    changed,
    signature,
  }
}
