import type { BattleMap, Token } from '../store/maps'
import type { Character } from '../types/character'

export interface PlayerActionResultBaseline {
  characters: Character[]
  map: BattleMap
  enemyApByToken: Record<string, { current: number; max: number }>
}

export interface PlayerActionCharacterChange {
  id: string
  name: string
  hp?: { before: number; after: number }
  tempHp?: { before: number; after: number }
  ap?: { before: number; after: number }
  qi?: { before: number; after: number }
  classResources?: Record<string, { before: number; after: number; max: number }>
  conditions?: { before: string[]; after: string[] }
  traitUses?: Array<{ featureKey?: string; name: string; before: number; after: number }>
  skillCooldowns?: Array<{ skillId: string; name: string; before: number; after: number }>
}

export interface PlayerActionTokenChange {
  id: string
  label: string
  hp?: { before?: number; after?: number }
  maxHp?: { before?: number; after?: number }
  position?: { before: { x: number; y: number }; after: { x: number; y: number } }
  statuses?: Record<string, { before?: number; after?: number }>
}

export interface PlayerActionResultSummary {
  actionType: string
  actorTokenId: string
  actorCharacterId: string
  changedCharacters: PlayerActionCharacterChange[]
  changedTokens: PlayerActionTokenChange[]
  changedEnemyAp: Array<{ tokenId: string; before?: number; after?: number; maxBefore?: number; maxAfter?: number }>
}

export function capturePlayerActionResultBaseline(input: PlayerActionResultBaseline): PlayerActionResultBaseline {
  return {
    characters: input.characters.map(cloneCharacterForResult),
    map: {
      ...input.map,
      tokens: input.map.tokens.map((token) => ({ ...token })),
    },
    enemyApByToken: Object.fromEntries(
      Object.entries(input.enemyApByToken).map(([tokenId, ap]) => [tokenId, { ...ap }]),
    ),
  }
}

export function summarizePlayerActionResult(
  action: { type: string; actorTokenId: string; characterId: string },
  before: PlayerActionResultBaseline,
  after: PlayerActionResultBaseline,
): PlayerActionResultSummary {
  return {
    actionType: action.type,
    actorTokenId: action.actorTokenId,
    actorCharacterId: action.characterId,
    changedCharacters: summarizeCharacterChanges(before.characters, after.characters),
    changedTokens: summarizeTokenChanges(before.map.tokens, after.map.tokens),
    changedEnemyAp: summarizeEnemyApChanges(before.enemyApByToken, after.enemyApByToken),
  }
}

function cloneCharacterForResult(character: Character): Character {
  return {
    ...character,
    conditions: [...character.conditions],
    traits: character.traits.map((trait) => ({ ...trait })),
    combatSkills: character.combatSkills.map((skill) => ({ ...skill })),
    combatBuffs: character.combatBuffs ? { ...character.combatBuffs } : undefined,
    classResources: character.classResources
      ? Object.fromEntries(Object.entries(character.classResources).map(([key, resource]) => [key, { ...resource }]))
      : undefined,
  }
}

function summarizeCharacterChanges(before: Character[], after: Character[]): PlayerActionCharacterChange[] {
  const beforeById = new Map(before.map((character) => [character.id, character]))
  const changes: PlayerActionCharacterChange[] = []
  for (const current of after) {
    const prev = beforeById.get(current.id)
    if (!prev) continue
    const change: PlayerActionCharacterChange = { id: current.id, name: current.name }
    if (prev.currentHp !== current.currentHp) change.hp = { before: prev.currentHp, after: current.currentHp }
    if ((prev.tempHp ?? 0) !== (current.tempHp ?? 0)) {
      change.tempHp = { before: prev.tempHp ?? 0, after: current.tempHp ?? 0 }
    }
    if (prev.currentAP !== current.currentAP) change.ap = { before: prev.currentAP, after: current.currentAP }
    if ((prev.qi ?? 0) !== (current.qi ?? 0)) change.qi = { before: prev.qi ?? 0, after: current.qi ?? 0 }
    const resourceKeys = new Set([
      ...Object.keys(prev.classResources ?? {}),
      ...Object.keys(current.classResources ?? {}),
    ])
    const classResources = Object.fromEntries(
      [...resourceKeys]
        .map((key) => {
          const beforeResource = prev.classResources?.[key]
          const afterResource = current.classResources?.[key]
          const beforeValue = beforeResource?.current ?? 0
          const afterValue = afterResource?.current ?? 0
          if (beforeValue === afterValue && beforeResource?.max === afterResource?.max) return null
          return [
            key,
            { before: beforeValue, after: afterValue, max: afterResource?.max ?? beforeResource?.max ?? 0 },
          ] as const
        })
        .filter((entry): entry is NonNullable<typeof entry> => !!entry),
    )
    if (Object.keys(classResources).length > 0) change.classResources = classResources
    if (JSON.stringify(prev.conditions) !== JSON.stringify(current.conditions)) {
      change.conditions = { before: [...prev.conditions], after: [...current.conditions] }
    }

    const traitUses = current.traits
      .map((trait) => {
        const beforeTrait = prev.traits.find((item) => item.id === trait.id)
        if (!beforeTrait || beforeTrait.uses === trait.uses) return null
        return {
          featureKey: trait.featureKey,
          name: trait.name,
          before: beforeTrait.uses,
          after: trait.uses,
        }
      })
      .filter((item): item is NonNullable<typeof item> => !!item)
    if (traitUses.length > 0) change.traitUses = traitUses

    const skillCooldowns = current.combatSkills
      .map((skill) => {
        const beforeSkill = prev.combatSkills.find((item) => item.id === skill.id)
        if (!beforeSkill || beforeSkill.remaining === skill.remaining) return null
        return {
          skillId: skill.id,
          name: skill.name,
          before: beforeSkill.remaining,
          after: skill.remaining,
        }
      })
      .filter((item): item is NonNullable<typeof item> => !!item)
    if (skillCooldowns.length > 0) change.skillCooldowns = skillCooldowns

    if (Object.keys(change).length > 2) changes.push(change)
  }
  return changes
}

function summarizeTokenChanges(before: Token[], after: Token[]): PlayerActionTokenChange[] {
  const beforeById = new Map(before.map((token) => [token.id, token]))
  const changes: PlayerActionTokenChange[] = []
  for (const current of after) {
    const prev = beforeById.get(current.id)
    if (!prev) continue
    const change: PlayerActionTokenChange = { id: current.id, label: current.label }
    if (prev.hp !== current.hp) change.hp = { before: prev.hp, after: current.hp }
    if (prev.maxHp !== current.maxHp) change.maxHp = { before: prev.maxHp, after: current.maxHp }
    if (prev.x !== current.x || prev.y !== current.y) {
      change.position = { before: { x: prev.x, y: prev.y }, after: { x: current.x, y: current.y } }
    }

    const statuses = summarizeTokenStatuses(prev, current)
    if (Object.keys(statuses).length > 0) change.statuses = statuses

    if (Object.keys(change).length > 2) changes.push(change)
  }
  return changes
}

function summarizeTokenStatuses(before: Token, after: Token): Record<string, { before?: number; after?: number }> {
  const statusKeys = [
    'burningTurns',
    'igniteTurns',
    'poisonTurns',
    'knockbackTurns',
    'stunTurns',
    'restrainedTurns',
    'vulnerableTurns',
    'noMoveTurns',
    'illusionDanceTurns',
    'huntingMarkStacks',
  ] as const
  const statuses: Record<string, { before?: number; after?: number }> = {}
  for (const key of statusKeys) {
    if (before[key] !== after[key]) statuses[key] = { before: before[key], after: after[key] }
  }
  return statuses
}

function summarizeEnemyApChanges(
  before: Record<string, { current: number; max: number }>,
  after: Record<string, { current: number; max: number }>,
): PlayerActionResultSummary['changedEnemyAp'] {
  const tokenIds = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort()
  return tokenIds
    .map((tokenId) => {
      const prev = before[tokenId]
      const current = after[tokenId]
      if (prev?.current === current?.current && prev?.max === current?.max) return null
      return {
        tokenId,
        before: prev?.current,
        after: current?.current,
        maxBefore: prev?.max,
        maxAfter: current?.max,
      }
    })
    .filter((item): item is NonNullable<typeof item> => !!item)
}
