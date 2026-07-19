import type { BattleMap, Token } from '../store/maps'
import type { Character } from '../types/character'

export interface PlayerActionResultBaseline {
  characters: Character[]
  map: BattleMap
}

export interface PlayerActionCharacterChange {
  id: string
  name: string
  hp?: { before: number; after: number }
  tempHp?: { before: number; after: number }
  classResources?: Record<string, { before: number; after: number; max: number }>
  conditions?: { before: string[]; after: string[] }
  concentration?: { before: boolean; after: boolean }
  deathSaves?: {
    before: { successes: number; failures: number; stable: boolean }
    after: { successes: number; failures: number; stable: boolean }
  }
}

export interface PlayerActionTokenChange {
  id: string
  label: string
  hp?: { before?: number; after?: number }
  maxHp?: { before?: number; after?: number }
  position?: { before: { x: number; y: number }; after: { x: number; y: number } }
  conditions?: { before: string[]; after: string[] }
}

export interface PlayerActionResultSummary {
  actionType: string
  actorTokenId: string
  actorCharacterId: string
  changedCharacters: PlayerActionCharacterChange[]
  changedTokens: PlayerActionTokenChange[]
}

export function capturePlayerActionResultBaseline(input: PlayerActionResultBaseline): PlayerActionResultBaseline {
  return {
    characters: input.characters.map(cloneCharacterForResult),
    map: {
      ...input.map,
      tokens: input.map.tokens.map((token) => ({
        ...token,
        dnd5eCombatState: token.dnd5eCombatState
          ? { ...token.dnd5eCombatState, activeEffects: structuredClone(token.dnd5eCombatState.activeEffects) }
          : undefined,
      })),
    },
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
  }
}

function cloneCharacterForResult(character: Character): Character {
  return {
    ...character,
    conditions: [...character.conditions],
    classResources: character.classResources ? structuredClone(character.classResources) : undefined,
    dnd5eCombatState: character.dnd5eCombatState
      ? { ...character.dnd5eCombatState, activeEffects: structuredClone(character.dnd5eCombatState.activeEffects) }
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
    if (prev.tempHp !== current.tempHp) change.tempHp = { before: prev.tempHp, after: current.tempHp }

    const keys = new Set([...Object.keys(prev.classResources ?? {}), ...Object.keys(current.classResources ?? {})])
    const resourceChanges = Object.fromEntries([...keys].flatMap((key) => {
      const beforeResource = prev.classResources?.[key]
      const afterResource = current.classResources?.[key]
      if (beforeResource?.current === afterResource?.current && beforeResource?.max === afterResource?.max) return []
      return [[key, {
        before: beforeResource?.current ?? 0,
        after: afterResource?.current ?? 0,
        max: afterResource?.max ?? beforeResource?.max ?? 0,
      }]]
    }))
    if (Object.keys(resourceChanges).length > 0) change.classResources = resourceChanges
    if (JSON.stringify(prev.conditions) !== JSON.stringify(current.conditions)) {
      change.conditions = { before: [...prev.conditions], after: [...current.conditions] }
    }
    if (!!prev.concentrating !== !!current.concentrating) {
      change.concentration = { before: !!prev.concentrating, after: !!current.concentrating }
    }
    const beforeDeathSaves = deathSaves(prev)
    const afterDeathSaves = deathSaves(current)
    if (JSON.stringify(beforeDeathSaves) !== JSON.stringify(afterDeathSaves)) {
      change.deathSaves = { before: beforeDeathSaves, after: afterDeathSaves }
    }
    if (Object.keys(change).length > 2) changes.push(change)
  }
  return changes
}

function deathSaves(character: Character) {
  return {
    successes: character.deathSaveSuccesses ?? 0,
    failures: character.deathSaveFailures ?? 0,
    stable: character.deathSaveStable ?? false,
  }
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
    const beforeConditions = prev.dnd5eCombatState?.conditions ?? []
    const afterConditions = current.dnd5eCombatState?.conditions ?? []
    if (JSON.stringify(beforeConditions) !== JSON.stringify(afterConditions)) {
      change.conditions = { before: [...beforeConditions], after: [...afterConditions] }
    }
    if (Object.keys(change).length > 2) changes.push(change)
  }
  return changes
}
