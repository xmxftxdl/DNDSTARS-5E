import type { Token, BattleMap } from '../src/store/maps'
export interface Dnd5eSummonLingerPolicy {
  count: number
  sides: number
  unit: 'round' | 'minute'
  capAtOriginalExpiry?: boolean
}
export function isDnd5eSummonLingerPolicy(value: unknown): value is Dnd5eSummonLingerPolicy
export function dnd5eSummonDurationExpired(summon: Token['dnd5eSummon'], round: number, worldMinute?: number): boolean
export function detachDnd5eUncontrolledSummon(token: Token, round: number, roll?: number | readonly number[], worldMinute?: number): Token
export function expireDnd5eSummonLingerAtWorldMinute(map: BattleMap, worldMinute: number): BattleMap
