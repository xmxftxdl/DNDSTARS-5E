import type {
  HeadlessCombatAction,
  HeadlessCombatEvent,
  HeadlessCombatResult,
  HeadlessDiceRoller,
  HeadlessDmCombatState,
} from './headlessDmCombatEngine'
import type { Character } from '../types/character'

export interface HeadlessClassCombatActionContext {
  state: HeadlessDmCombatState
  action: HeadlessCombatAction
  dice: HeadlessDiceRoller
  events: HeadlessCombatEvent[]
  services: HeadlessClassCombatActionServices
}

export interface HeadlessClassCombatActionServices {
  fail(reason: 'invalid-actor' | 'invalid-action' | 'stale-turn' | 'insufficient-ap'): HeadlessCombatResult
  succeed(): HeadlessCombatResult
  findCharacter(characterId: string): Character | undefined
  currentTurnTokenId(): string | undefined
  spendCharacterAp(characterId: string, tokenId: string, amount: number): boolean
  updateCharacter(characterId: string, update: (character: Character) => Character): void
}

export type HeadlessClassCombatActionResolver = (
  context: HeadlessClassCombatActionContext,
) => HeadlessCombatResult

const resolvers = new Map<string, HeadlessClassCombatActionResolver>()

export function registerHeadlessClassCombatActionResolver(
  actionType: string,
  resolver: HeadlessClassCombatActionResolver,
): () => void {
  const previous = resolvers.get(actionType)
  resolvers.set(actionType, resolver)
  return () => {
    if (resolvers.get(actionType) !== resolver) return
    if (previous) resolvers.set(actionType, previous)
    else resolvers.delete(actionType)
  }
}

export function headlessClassCombatActionResolver(
  actionType: string,
): HeadlessClassCombatActionResolver | undefined {
  return resolvers.get(actionType)
}
