export interface Dnd5eEffectiveVisionProfileV1 {
  schemaVersion: 1
  normalRangeFeet: number
  darkvisionRangeFeet: number
  /** Sees normally in nonmagical darkness, such as Devil's Sight. */
  darknessSightRangeFeet: number
  /** Sees normally through magical darkness, such as Devil's Sight. */
  magicalDarknessSightRangeFeet: number
  blindsightRangeFeet: number
  tremorsenseRangeFeet: number
  truesightRangeFeet: number
}

export const DND5E_EFFECTIVE_VISION_PROFILE_SCHEMA_VERSION: 1

export function dnd5eCharacterHasDevilsSight(character: unknown): boolean
export function dnd5eCoreRaceDarkvisionRangeFeet(character: unknown): number
export function compileDnd5eEffectiveVisionProfile(input?: {
  token?: unknown
  character?: unknown
  monster?: unknown
  fallbackRangeFeet?: number
}): Dnd5eEffectiveVisionProfileV1
export function applyDnd5eEffectiveVisionProfile<T extends object>(
  token: T,
  profile: Dnd5eEffectiveVisionProfileV1,
): T & {
  darkvisionRangeFeet?: number
  darknessSightRangeFeet?: number
  magicalDarknessSightRangeFeet?: number
  blindsightRangeFeet?: number
  tremorsenseRangeFeet?: number
  truesightRangeFeet?: number
}
