import type { HeadlessCombatEvent } from './headlessDmCombatEngine'

export type HeadlessEventOf<T extends HeadlessCombatEvent['type']> = Extract<HeadlessCombatEvent, { type: T }>

export function headlessEventsOf<T extends HeadlessCombatEvent['type']>(
  events: HeadlessCombatEvent[],
  type: T,
): HeadlessEventOf<T>[] {
  return events.filter((event): event is HeadlessEventOf<T> => event.type === type)
}

export function firstHeadlessEventOf<T extends HeadlessCombatEvent['type']>(
  events: HeadlessCombatEvent[],
  type: T,
): HeadlessEventOf<T> | undefined {
  return headlessEventsOf(events, type)[0]
}

export const attackResolvedEvent = (events: HeadlessCombatEvent[]) =>
  firstHeadlessEventOf(events, 'attack-resolved')

export const attackResolvedEvents = (events: HeadlessCombatEvent[]) =>
  headlessEventsOf(events, 'attack-resolved')

export const enemyAttackResolvedEvent = (events: HeadlessCombatEvent[]) =>
  firstHeadlessEventOf(events, 'enemy-attack-resolved')

export const targetDodgeResolvedEvent = (events: HeadlessCombatEvent[]) =>
  firstHeadlessEventOf(events, 'target-dodge-resolved')

export const aoeTargetResolvedEvents = (events: HeadlessCombatEvent[]) =>
  headlessEventsOf(events, 'aoe-target-resolved')

export const opportunityResolvedEvent = (events: HeadlessCombatEvent[]) =>
  firstHeadlessEventOf(events, 'opportunity-resolved')

export function apSpentEvent(
  events: HeadlessCombatEvent[],
  filter: { tokenId?: string; characterId?: string | null } = {},
): HeadlessEventOf<'ap-spent'> | undefined {
  return headlessEventsOf(events, 'ap-spent').find((event) => {
    if (filter.tokenId != null && event.tokenId !== filter.tokenId) return false
    if (filter.characterId === null && event.characterId != null) return false
    if (filter.characterId != null && filter.characterId !== null && event.characterId !== filter.characterId) {
      return false
    }
    return true
  })
}
