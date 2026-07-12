import type {
  HeadlessCombatAction,
  HeadlessCombatEvent,
  HeadlessCombatResult,
  HeadlessDiceRoller,
  HeadlessDmCombatState,
} from './headlessDmCombatEngine'

export interface HeadlessClassCombatActionContext {
  state: HeadlessDmCombatState
  action: HeadlessCombatAction
  dice: HeadlessDiceRoller
  events: HeadlessCombatEvent[]
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
